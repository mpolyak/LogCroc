/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var moment = require("moment");
var redis  = require("redis");

var Promise = require("promise");

var checksum = require("./checksum.js");
var cursor   = require("./cursor.js");
var object   = require("./object.js");
var log      = require("./log.js");

var EXPIRE_REPORT = 3 * 24 * 60;

function aggregate(events, versions)
{
    var list = [];

    events.forEach(function (event)
    {
        var i;

        for (i = 0; i < list.length; i ++)
        {
            if (list[i].message === event.message)
                break;
        }

        if (i === list.length)
            list.push({message: event.message, occurrences: 0, versions: []});

        list[i].occurrences ++;

        if (versions.length)
        {
            var j;

            for (j = 0; j < versions.length; j ++)
            {
                if (Number(versions[j].timestamp) > Number(event.timestamp))
                    break;
            }

            var version = versions[j === 0 ? 0 : j - 1].version;

            if (list[i].versions.indexOf(version) === -1)
                list[i].versions.push(version);
        }
    });

    list.sort(function (a, b) {
        return (a.occurrences < b.occurrences) - (a.occurrences > b.occurrences);
    });

    return list;
}

function consolidate(server)
{
    var summary = {timestamp: server.timestamp};

    var data = server.data; server = server.server;

    summary.name = server.name;
    summary.host = server.host;

    if (data)
    {
        summary.version = data.versions.map(
            function (version) { return version.version; }).join(", ");

        summary.errors = data.errors.length;
        summary.warnings = data.warnings.length;

        ["error", "warning"].forEach(function (type)
        {
            var list = aggregate(data[type + "s"], data.versions);

            if (list.length)
            {
                summary[type] = {message: list[0].message, occurrences: list[0].occurrences,
                    version: list[0].versions.join(", ")};
            }
        });
    }

    return summary;
}

function save(client, name, day)
{
    var report = {timestamp: day.timestamp, servers: day.servers.length};

    object.serialize(report, "server", day.servers.map(function (server)
    {
        var save = {timestamp: server.timestamp, name: server.name, host: server.host, version: server.version,
            errors: server.errors, warnings: server.warnings};

        if (server.error)
            object.flatten(save, "error", server.error);

        if (server.warning)
            object.flatten(save, "warning", server.warning);

        return save;
    }));

    var key = "report:" + name + ":" + day.timestamp + ":" + (new Date()).getTime();

    return new Promise(function (resolve)
    {
        client.multi().del(key).hmset(key, report).exec(
            function (error)
        {
            if (error)
            {
                log.fatal("Redis error", error);

                resolve();
            }
            else
            {
                client.expire(key, EXPIRE_REPORT * 60, function (error)
                {
                    if (error)
                        log.fatal("Redis error", error);

                    resolve();
                });
            }
        });
    });
}

function report(client, name, servers)
{
    var timestamp = function (a, b) {
        return (a.timestamp > b.timestamp) - (a.timestamp < b.timestamp);
    };

    var file = function (event) {
        return !event.file || this.indexOf(event.file) !== -1;
    };

    var days = [];

    servers.forEach(function (server)
    {
        var list = server.days.sort(timestamp).map(function (day)
        {
            return {timestamp: day.timestamp,
                errors:   object.deserialize(day.data, "error",   Number(day.data.errors),   ["file", "timestamp", "name", "message"]).filter(file.bind(server.files)).sort(timestamp),
                warnings: object.deserialize(day.data, "warning", Number(day.data.warnings), ["file", "timestamp", "name", "message"]).filter(file.bind(server.files)).sort(timestamp),
                versions: object.deserialize(day.data, "version", Number(day.data.versions), ["file", "timestamp", "version"]        ).filter(file.bind(server.files)).sort(timestamp)};
        })
        .filter(function (day) {
            return day.errors.length || day.warnings.length || day.versions.length;
        })
        .forEach(function (day)
        {
            var i;

            for (i = 0; i < days.length; i ++)
            {
                if (days[i].timestamp === day.timestamp)
                    break;
            }

            if (i === days.length)
                days.push({timestamp: day.timestamp, servers: []});

            days[i].servers.push({timestamp: day.timestamp, server: server,
                data: {errors: day.errors, warnings: day.warnings, versions: day.versions}});
        });
    });

    var promises = [];

    days.forEach(function (day)
    {
        day.servers = day.servers.map(consolidate).sort(function (a, b)
        {
            if (a.errors == b.errors)
            {
                if (a.warnings == b.warnings)
                    return (a.name > b.name) - (a.name < b.name);

                return a.warnings > b.warnings ? -1 : 1;
            }

            return a.errors > b.errors ? -1 : 1;
        });

        promises.push(save(client, name, day));
    });

    return new Promise(function (resolve) {
        Promise.all(promises).then(function () { resolve(days); });
    });
}

function load(data)
{
    var day = {timestamp: Number(data.timestamp), servers: object.deserialize(data, "server", Number(data.servers),
        ["timestamp", "name", "host", "version", "errors", "warnings", "error_version", "error_occurrences", "error_message", "warning_version", "warning_occurrences", "warning_message"])};

    day.servers.forEach(function (server)
    {
        server.timestamp = Number(server.timestamp);
        server.errors    = Number(server.errors);
        server.warnings  = Number(server.warnings);

        object.inflate(server, "error");

        if (server.error)
            server.error.occurrences = Number(server.error.occurrences);

        object.inflate(server, "warning");

        if (server.warning)
            server.warning.occurrences = Number(server.warning.occurrences);
    });

    return day;
}

function sources(server)
{
    var files = [];

    ["status", "version", "table"].forEach(function (source)
    {
        if (server[source] && files.indexOf(server[source].file) === -1)
            files.push(server[source].file);
    });

    return files;
}

function calculate(resolve)
{
    var client = this.client; var dashboard = this.dashboard; var days = this.days;

    if (!dashboard.servers.length)
    {
        log.fatal("No servers for report", dashboard.name);

        resolve();

        return;
    }

    var now = new Date(); var today = moment(now).startOf("day").valueOf();

    var offset = 0;

    if (this.start)
    {
        var start = moment(this.start);

        if (start.isValid())
            offset = today - start.startOf("day").valueOf();
    }

    var minToday = today; var maxToday = today;

    var servers = dashboard.servers.map(function (server)
    {
        var localtime = new Date(now.getTime() +
            (now.getTimezoneOffset() * 60 * 1000) + (server.timezone * 60 * 1000));

        today = moment(localtime).startOf("day").valueOf();

        if (today < minToday) minToday = today;
        if (today > maxToday) maxToday = today;

        return {name: server.name, host: server.host, checksum: checksum(server.host), files: sources(server),
            localtime: localtime.getTime(), today: today, days: []};
    });

    var name = checksum(dashboard.name);

    cursor.scan(client, "report:" + name + ":*", function (error, results)
    {
        if (error)
        {
            log.fatal("Redis error", error);

            resolve();

            return;
        }

        var reports = [];

        results.forEach(function (result)
        {
            var parts = result.split(":");

            if (parts.length !== 4)
            {
                log.error("Invalid report set", results[i]);

                // House keeping.
                client.del(result, function (error)
                {
                    if (error)
                        log.fatal("Redis error", error);
                });

                return;
            }

            var timestamp = Number(parts[2]); var localtime = Number(parts[3]);

            if (timestamp <= maxToday - offset && (minToday - offset) - timestamp < days * 24 * 60 * 60 * 1000)
            {
                // Check if report is stale.
                if ((timestamp === minToday || timestamp === maxToday) && now.getTime() - localtime > 60 * 60 * 1000)
                {
                    // House keeping.
                    client.del(result, function (error)
                    {
                        if (error)
                            log.fatal("Redis error", error);
                    });

                    return;
                }

                var i;

                for (i = 0; i < reports.length; i ++)
                {
                    if (reports[i].timestamp === timestamp)
                        break;
                }

                if (i < reports.length)
                {
                    if (reports[i].localtime < localtime) {
                        reports[i].report = result; reports[i].localtime = localtime;
                    }
                }
                else
                    reports.push({report: result, timestamp: timestamp, localtime: localtime});
            }
        });

        cursor.scan(client, "summary:" + name + ":*", function (error, results)
        {
            if (error)
            {
                log.fatal("Redis error", error);

                resolve();

                return;
            }

            var summaries = [];

            results.forEach(function (result)
            {
                var parts = result.split(":");

                if (parts.length !== 4)
                {
                    log.error("Invalid summary set", result);

                    // House keeping.
                    client.del(result, function (error)
                    {
                        if (error)
                            log.fatal("Redis error", error);
                    });

                    return;
                }

                var timestamp = Number(parts[3]);

                if (reports.some(function (report) { return report.timestamp === timestamp; }))
                    return;

                var list = servers.filter(function (server) {
                    return server.checksum === parts[2] && timestamp <= server.today - offset && (server.today - offset) - timestamp < days * 24 * 60 * 60 * 1000;
                });

                if (list.length)
                    summaries.push({summary: result, timestamp: timestamp, servers: list});
            });

            if (!reports.length && !summaries.length)
            {
                resolve();

                return;
            }

            var multi = client.multi();

            reports.forEach(function (report) {
                multi.hgetall(report.report);
            });

            summaries.forEach(function (summary) {
                multi.hgetall(summary.summary);
            });

            multi.exec(function (error, replies)
            {
                if (error)
                {
                    log.fatal("Redis error", error);

                    resolve();

                    return;
                }
                
                if (replies.length !== reports.length + summaries.length)
                {
                    log.fatal("Reports + Summaries number mismatch", replies.length, "expecting", reports.length + summaries.length);

                    resolve();

                    return;
                }

                var days = [];

                reports.forEach(function (report, index)
                {
                    var data = replies[index];

                    if (data) {
                        days.push(load(data));
                    }
                    else
                        log.error("Invalid report", report.report, "data");
                });

                summaries.forEach(function (summary, index)
                {
                    var data = replies[reports.length + index];

                    if (data)
                    {
                        summary.servers.forEach(function (server) {
                            server.days.push({timestamp: summary.timestamp, data: data});
                        });
                    }
                    else
                        log.error("Invalid summary", summary.summary, "data");
                });

                report(client, name, servers).then(function (result) {
                    resolve(days.concat(result));
                });
            });
        });
    });
}

module.exports = function (dashboard, days, start, callback)
{
    var client = redis.createClient()
        .on("ready", function ()
        {
            (new Promise(calculate.bind({client: client, dashboard: dashboard, days: days, start: start})))
                .then(function (result)
            {
                client.removeAllListeners().quit();

                callback(result);

            }).catch (function (error)
            {
                log.fatal("Exception", error);

                client.removeAllListeners().quit();

                callback(null);
            });
        })
        .on("error", function (error)
        {
            log.fatal("Redis error", error);
        });
};