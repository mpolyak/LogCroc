/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var cheerio = require("cheerio");
var moment  = require("moment");
var redis   = require("redis");

var Promise = require("promise");

var polyfill = require("./polyfill.js");
var download = require("./download.js");
var checksum = require("./checksum.js");
var template = require("./template.js");
var log      = require("./log.js");

var ACCOUNTS = require("../accounts.json").accounts;

var EXPIRE_SOURCE = 5;
var EXPIRE_EVENT  = 24 * 60;

var TIMEOUT = 60 * 60 * 1000;

function saveEvents(client, dashboard, server, type, list)
{
    var groups = [];

    var multi = client.multi();

    list.forEach(function (event)
    {
        var group = "events:" + moment(event.timestamp).startOf("day").valueOf();

        if (groups.indexOf(group) === -1)
            groups.push(group);

        var key = type + ":" + checksum(dashboard.name) + ":" + checksum(server.host) + ":" + event.timestamp;

        multi.sadd(group, key).hmset(key, event).expire(key, EXPIRE_EVENT * 60);
    });

    groups.forEach(function (group) {
        multi.expire(group, EXPIRE_EVENT * 60);
    });

    return new Promise(function (resolve)
    {
        multi.exec(function (error)
        {
            if (error)
                log.fatal("Redis error", error);

            resolve();
        });

    }).catch(function (error) {
        log.fatal("Exception", error);
    });
}

function updateSource(client, name, dashboard, server, source, value)
{
    var resource = checksum(dashboard.name) + ":" + checksum(server.host) + ":" + checksum(source.file);

    return new Promise(function (resolve)
    {
        client.hmset(name + ":" + resource, value, function (error)
        {
            if (error)
            {
                log.fatal("Redis error", error);

                resolve();
            }
            else
            {
                client.expire(name + ":" + resource, (source.refresh + EXPIRE_SOURCE) * 60, function (error)
                {
                    if (error)
                        log.fatal("Redis error", error);

                    client.publish(name, resource, function (error)
                    {
                        if (error)
                            log.fatal("Redis error", error);

                        resolve();
                    });
                });
            }
        });

    }).catch(function (error) {
        log.fatal("Exception", error);
    });
}

function deleteSource(client, name, dashboard, server, source)
{
    var resource = checksum(dashboard.name) + ":" + checksum(server.host) + ":" + checksum(source.file);

    return new Promise(function (resolve)
    {
        client.del(name + ":" + resource, function (error, result)
        {
            if (error)
            {
                log.fatal("Redis error", error);

                resolve();
            }
            else
            {
                client.publish(name, resource, function (error)
                {
                    if (error)
                        log.fatal("Redis error", error);

                    resolve();
                });
            }
        });

    }).catch(function (error) {
        log.fatal("Exception", error);
    });
}

function updateRanges(client, dashboard, server, source, range)
{
    return new Promise(function (resolve)
    {
        client.hset("ranges", checksum(dashboard.name) + ":" + checksum(server.host) + ":" + checksum(source.file), range, function (error)
        {
            if (error)
                log.fatal("Redis error", error);

            resolve();
        });

    }).catch(function (error) {
        log.fatal("Exception", error);
    });
}

function updateTable(client, dashboard, server, table, file, text)
{
    var fields = {name: -1, version: -1, timestamp: -1, status: -1, message: -1};

    var columns = -1;

    for (var name in fields)
    {
        var column = table[name].column;

        if (column !== -1)
        {
            fields[name] = column;

            if (column >= columns)
                columns = column;
        }
    }

    if (columns === -1)
    {
        log.error("Invalid", server.host, "No table columns specified");

        return [deleteSource(client, "table", dashboard, server, table)];
    }

    if (!text)
    {
        log.warn("Unable to download table", server.host + file);

        return [deleteSource(client, "table", dashboard, server, table)];
    }

    var rows = [];

    var $ = cheerio.load(text);

    $("tbody").each(function (index, element)
    {
        if (!isNaN(table.index) && index !== table.index)
            return;

        $(element).find("tr").each(function (index, element)
        {
            var cols = $(element).find("td");

            if (cols.length <= columns)
                return;

            var row = {name: "", version: "", timestamp: "", status: "", message: ""};

            for (var name in fields)
            {
                var column = fields[name];

                if (column !== -1)
                    row[name] = $(cols[column]).text().trim();
            }

            rows.push(row);
        });
    });

    log.info("Table", dashboard.name, server.host + file, rows.length);

    var match = function (text) {
        return this.indexOf(text) !== -1;
    };

    var errors = []; var warnings = []; var versions = [];

    for (var i = 0; i < rows.length;)
    {
        var row = rows[i];

        if (row.name)
        {
            if (table.name.regex)
            {
                result = (new RegExp(table.name.regex, "gm")).exec(row.name);

                if (result && result.length >= 1)
                    row.name = result[1];

                if (!row.name)
                {
                    rows.splice(i, 1);

                    continue;
                }
            }
        }
        else
        {
            rows.splice(i, 1);

            continue;
        }

        if (row.timestamp)
        {
            if (table.timestamp.regex)
            {
                result = (new RegExp(table.timestamp.regex, "gm")).exec(row.timestamp);

                if (result && result.length >= 1)
                    row.timestamp = result[1];
            }

            row.timestamp = Date.parse(row.timestamp);
        }
        else
            row.timestamp = NaN;

        if (row.version)
        {
            if (table.version.regex)
            {
                result = (new RegExp(table.version.regex, "gm")).exec(row.version);

                if (result && result.length >= 1)
                    row.version = result[1];
            }

            if (moment(row.timestamp).isValid() && row.version)
                versions.push({file: table.file, timestamp: row.timestamp, version: row.version});

            log.info("Version", dashboard.name, server.host + file, moment(row.timestamp).format(), row.name, row.version);
        }

        if (row.message)
        {
            if (table.message.regex)
            {
                result = (new RegExp(table.message.regex, "gm")).exec(row.message);

                if (result && result.length >= 1)
                    row.message = result[1];
            }
        }

        if (row.status)
        {
            if (table.status.error.some(match.bind(row.status)))
            {
                if (moment(row.timestamp).isValid() && row.message)
                    errors.push({file: table.file, timestamp: row.timestamp, name: row.name, message: row.message});

                log.info("Error", dashboard.name, server.host + table.file, moment(row.timestamp).format(), row.name, row.status);

                row.status = "error";
            }
            else if (table.status.warning.some(match.bind(row.status)))
            {
                if (moment(row.timestamp).isValid() && row.message)
                    warnings.push({file: table.file, timestamp: row.timestamp, name: row.name, message: row.message});

                log.info("Warning", dashboard.name, server.host + file, moment(row.timestamp).format(), row.name, row.status);

                row.status = "warning";
            }
            else
                row.status = "";
        }

        i ++;
    }

    if (!rows.length)
        return [];

    var promises = [];

    if (errors.length)
        promises.push(saveEvents(client, dashboard, server, "error", errors));

    if (warnings.length)
        promises.push(saveEvents(client, dashboard, server, "warning", warnings));

    if (versions.length)
        promises.push(saveEvents(client, dashboard, server, "version", versions));

    var now = new Date(); now = new Date(now.getTime() +
        (now.getTimezoneOffset() * 60 * 1000) + (server.timezone * 60 * 1000));

    var save = {file: file, localtime: now.getTime(), rows: rows.length};

    rows.forEach(function (row, index)
    {
        for (var name in fields)
            save[name + "_" + index] = row[name];
    });

    promises.push(updateSource(client, "table", dashboard, server, table, save));

    return promises;
}

function updateStatus(client, dashboard, server, status, file, text)
{
    if (status.timestamp.start === status.timestamp.end || status.status.start === status.status.end)
    {
        log.error("Invalid", server.host, "Timestamp or Status definition");

        return [deleteSource(client, "status", dashboard, server, status)];
    }

    var now = new Date(); now = new Date(now.getTime() +
        (now.getTimezoneOffset() * 60 * 1000) + (server.timezone * 60 * 1000));

    var warning = status.status.warning;
    var error = status.status.error;

    if (!text)
    {
        log.warn("Unable to download status", server.host + file);

        if (warning.persist < 0 || error.persist < 0)
        {
            return [
                saveEvents(client, dashboard, server, "error", [{file: status.file, timestamp: now.getTime(), name: "Error",
                        message: "Unable to download status " + server.host + file}]),

                updateSource(client, "status", dashboard, server, status, {file: file, localtime: now.getTime(), timestamp: now.getTime(), warnings: 0, errors: 1,
                    error_timestamp: now.getTime(), error_name: "Error", error_message: "Unable to download status " + server.host + file})
            ];
        }
        else
            return [deleteSource(client, "status", dashboard, server, status)];
    }

    var wpersist = warning.persist ? (now.getTime() - (Math.abs(warning.persist) * 60 * 1000)) : 0;
    var epersist = error.persist ? (now.getTime() - (Math.abs(error.persist) * 60 * 1000)) : 0;

    var size = Math.max(status.timestamp.end, status.status.end, status.message.end);

    var warnings = [];
    var errors = [];

    var message = "";

    var earliest = 0; var latest = 0;

    var range = 0;

    var lines = text.split(/[\n\r]/g);

    while (lines.length)
    {
        var line = lines.pop(); var _line = line;

        range += line.length + 2; line = line.trim();

        if (!line)
            continue;

        var fragments = line.split(/\s/g);

        if (fragments.length >= size)
        {
            var content = {timestamp: "", status: "", message: ""};

            for (var field in content)
            {
                content[field] = fragments.slice(status[field].start,
                    status[field].end === -1 ? fragments.length : status[field].end).join(" ");
            }

            var timestamp = Date.parse(content.timestamp);

            if (isNaN(timestamp))
            {
                message = _line + "\n" + message;

                continue;
            }

            if (!earliest || timestamp < earliest)
                earliest = timestamp;

            if (!latest || timestamp > latest)
                latest = timestamp;

            if (timestamp < wpersist && timestamp < epersist)
                break;

            if (warning.values.indexOf(content.status) !== -1)
            {
                message = message.trim();

                if (content.message && message)
                    message = "\n" + message;

                warnings.unshift({file: status.file, timestamp: timestamp, name: content.status,
                    message: content.message + message});

                message = "";
            }

            if (error.values.indexOf(content.status) !== -1)
            {
                message = message.trim();

                if (content.message && message)
                    message = "\n" + message;

                errors.unshift({file: status.file, timestamp: timestamp, name: content.status,
                    message: content.message + message});

                message = "";
            }
        }
    }

    if (earliest > wpersist || earliest > epersist)
    {
        range = Math.max(Math.floor(range * 1.1), Math.floor(text.length * 1.25));

        log.warn("Range bytes", server.host + file, text.length, "did not capture persist interval", moment(earliest).format(),
            "for warning", moment(wpersist).format(), "or error", moment(epersist).format(), "setting next range to", range);
    }
    else
        range = Math.floor(range * 1.1);

    var promises = [updateRanges(client, dashboard, server, status, -range)];

    var persist = function (event) {
        return event.timestamp >= Number(this);
    };

    if (warning.persist < 0)
    {
        if (earliest <= wpersist)
        {
            warnings = warnings.filter(persist.bind(wpersist));

            if (!warnings.length)
            {
                warnings = [{file: status.file, timestamp: wpersist, name: "Warning",
                    message: warning.message || "Heartbeat Not Found"}];
            }
            else
                warnings = [];
        }
        else
            warnings = [];
    }

    if (error.persist < 0)
    {
        if (earliest <= epersist)
        {
            errors = errors.filter(persist.bind(epersist));

            if (!errors.length)
            {
                errors = [{file: status.file, timestamp: epersist, name: "Error",
                    message: error.message || "Heartbeat Not Found"}];
            }
            else
                errors = [];
        }
        else
            errors = [];
    }

    log.info("Status", dashboard.name, server.host + file, "Warnings", warnings.length, "Errors", errors.length);

    var save = {file: file, localtime: now.getTime(), timestamp: latest, warnings: warnings.length, errors: errors.length};

    if (warnings.length)
    {
        promises.push(saveEvents(client, dashboard, server, "warning", warnings));

        warning = warnings[warnings.length - 1];

        log.info("Warning", server.host + file, moment(warning.timestamp).format(), warning.name, warning.message);

        save.warning_timestamp = warning.timestamp;
        save.warning_message = warning.message;
        save.warning_name = warning.name;
    }

    if (errors.length)
    {
        promises.push(saveEvents(client, dashboard, server, "error", errors));

        error = errors[errors.length - 1];

        log.info("Error", server.host + file, moment(error.timestamp).format(), error.name, error.message);

        save.error_timestamp = error.timestamp;
        save.error_message = error.message;
        save.error_name = error.name;
    }

    promises.push(updateSource(client, "status", dashboard, server, status, save));

    return promises;
}

function updateVersion(client, dashboard, server, version, file, text)
{
    if (!text)
    {
        log.warn("Unable to download version", server.host + file);

        return [deleteSource(client, "version", dashboard, server, version)];
    }

    var value = "";

    var range = 0;

    var lines = text.split(/[\n\r]/g);

    while (lines.length)
    {
        var line = lines.pop();

        range += line.length + 2; line = line.trim();

        if (!line)
            continue;

        var start = version.prefix ? line.indexOf(version.prefix) : 0;

        if (start !== -1) {
            start += version.prefix.length;
        }
        else
            continue;

        var end = line.length;

        if (version.postfix)
        {
            end = line.indexOf(version.postfix, start);

            if (end === -1)
                continue;
        }

        value = line.slice(start, end);

        break;
    }

    var promises = [updateRanges(client, dashboard, server, version, -Math.floor(range * 2))];

    if (value)
    {
        var now = new Date(); now = new Date(now.getTime() +
            (now.getTimezoneOffset() * 60 * 1000) + (server.timezone * 60 * 1000));

        promises.push(saveEvents(client, dashboard, server, "version", [{file: version.file, timestamp: now.getTime(), version: value}]));

        log.info("Version", dashboard.name, server.host + file, value);

        promises.push(updateSource(client, "version", dashboard, server, version, {file: file, timestamp: now.getTime(), value: value}));
    }
    else
    {
        log.warn("Missing version", server.host + file);

        promises.push(deleteSource(client, "version", dashboard, server, version));
    }

    return promises;
}

function updateResource(client, dashboard, server, source)
{
    var resource = checksum(dashboard.name) + ":" + checksum(server.host) + ":" + checksum(server[source].file);

    var multi = client.multi().hget("refreshed", resource);

    if (source !== "table")
        multi.hget("ranges", resource);

    return new Promise(function (resolve)
    {
        multi.exec(function (error, results)
        {
            var refreshed = 0; var range = 0;

            if (error) {
                log.fatal("Redis error", error);
            }
            else
            {
                if (results[0])
                    refreshed = moment(results[0]);

                if (source !== "table")
                {
                    if (results[1])
                        range = results[1];
                }
            }

            var now = new Date(); var refresh = server[source].refresh;

            if (!refreshed || !refreshed.isValid() || !refresh || refreshed.add(refresh, "minutes").valueOf() <= now.getTime())
            {
                now = new Date(now.getTime() +
                    (now.getTimezoneOffset() * 60 * 1000) + (server.timezone * 60 * 1000));

                var file = template.date(server[source].file, now);

                download(server.host + file, server.auth, range, function (error, text)
                {
                    if (error)
                        log.warn("Download error", error, "for", server.host + file);

                    client.hset("refreshed", resource, moment().toISOString(), function (error)
                    {
                        if (error)
                            log.fatal("Redis error", error);

                        resolve({file: file, text: text});
                    });
                });
            }
            else
                resolve();
        });

    }).catch(function (error) {
        log.fatal("Exception", error);
    });
}

function refresh(client)
{
    var sources = ["table", "status", "version"]; var resources = [];

    ACCOUNTS.forEach(function (account)
    {
        account.dashboards.forEach(function (dashboard)
        {
            dashboard.servers.forEach(function (server)
            {
                sources.forEach(function (source)
                {
                    if (server[source])
                        resources.push({dashboard: dashboard, server: server, source: source});
                });
            });
        });
    });

    return new Promise(function (resolve)
    {
        if (!resources.length)
        {
            resolve();

            return;
        }

        var updated = 0;

        resources.forEach(function (resource)
        {
            updateResource(client, resource.dashboard, resource.server, resource.source).then(function (result)
            {
                var promises = [];

                if (result)
                {
                    switch (resource.source)
                    {
                        case "table":
                            promises = updateTable(client, resource.dashboard, resource.server, resource.server.table,
                                result.file, result.text);

                            break;

                        case "status":
                            promises = updateStatus(client, resource.dashboard, resource.server, resource.server.status,
                                result.file, result.text);

                            break;

                        case "version":
                            promises = updateVersion(client, resource.dashboard, resource.server, resource.server.version,
                                result.file, result.text);

                            break;
                    }
                }

                Promise.all(promises).then(function ()
                {
                    updated ++;

                    if (updated === resources.length)
                        resolve();
                });
            });
        });
    }).catch(function (error) {
        log.fatal("Exception", error);
    });
}

module.exports = function ()
{
    var client = redis.createClient()
        .on("ready", function ()
        {
            var cleanup = function ()
            {
                clearTimeout(timeout);

                client.removeAllListeners().quit();
            };

            var timeout = setTimeout(function ()
            {
                log.fatal("Timeout suicide for refresh");

                client.removeAllListeners().quit();

                process.exit(1);

            }, TIMEOUT);

            refresh(client).then(cleanup).catch(function (error) {
                log.fatal("Exception", error);
            });
        })
        .on("error", function (error)
        {
            log.fatal("Redis error", error);

            client.removeAllListeners().quit();

            process.exit(1);
        });
};

module.exports();