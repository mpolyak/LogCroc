/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var moment = require("moment");
var redis  = require("redis");

var Promise = require("promise");

var polyfill = require("./polyfill.js");
var checksum = require("./checksum.js");
var cursor   = require("./cursor.js");
var object   = require("./object.js");
var log      = require("./log.js");

var ACCOUNTS = require("../accounts.json").accounts;

var EXPIRE_SUMMARY = 3 * 24 * 60;

var TIMEOUT = 60 * 60 * 1000;

function update(client, name, server)
{
    var timestamp = function (a, b) {
        return (a.timestamp > b.timestamp) - (a.timestamp < b.timestamp);
    };

    var exists = function (version) {
        return version.version === this.version;
    };

    var match = function (record) {
        return record.timestamp === this.timestamp;
    };

    server.errors.sort(timestamp);
    server.warnings.sort(timestamp);

    var versions = [];

    server.versions.sort(timestamp).forEach(function (version)
    {
        if (!versions.some(exists.bind(version)))
            versions.push(version);
    });

    var key = "summary:" + name + ":" + server.checksum + ":" + server.today;

    return new Promise(function (resolve)
    {
        client.hgetall(key, function (error, result)
        {
            if (error)
            {
                log.fatal("Redis error", error);

                resolve();

                return;
            }

            if (result)
            {
                result = {
                    errors:   object.deserialize(result, "error",   Number(result.errors),   ["file", "timestamp", "name", "message"]).sort(timestamp),
                    warnings: object.deserialize(result, "warning", Number(result.warnings), ["file", "timestamp", "name", "message"]).sort(timestamp),
                    versions: object.deserialize(result, "version", Number(result.versions), ["file", "timestamp", "version"]        ).sort(timestamp)
                };

                server.errors.forEach(function (error)
                {
                    if (!result.errors.some(match.bind(error)))
                        result.errors.push(error);
                });

                server.warnings.forEach(function (warning)
                {
                    if (!result.warnings.some(match.bind(warning)))
                        result.warnings.push(warning);
                });

                versions.forEach(function (version)
                {
                    if (!result.versions.some(exists.bind(version)))
                        result.versions.push(version);
                });
            }
            else
                result = {errors: server.errors, warnings: server.warnings, versions: versions};

            var save = {timestamp: server.localtime, errors: result.errors.length, warnings: result.warnings.length, versions: result.versions.length};

            object.serialize(save, "error",   result.errors);
            object.serialize(save, "warning", result.warnings);
            object.serialize(save, "version", result.versions);

            client.multi().del(key).hmset(key, save).exec(
                function (error)
            {
                if (error)
                {
                    log.fatal("Redis error", error);

                    resolve();
                }
                else
                {
                    client.expire(key, EXPIRE_SUMMARY * 60, function (error)
                    {
                        if (error)
                            log.fatal("Redis error", error);

                        resolve();
                    });
                }
            });
        });
    });
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

function merge(servers)
{
    var groups = [];

    servers.forEach(function (server)
    {
        var i;

        for (i = 0; i < groups.length; i ++)
        {
            if (groups[i][0].host === server.host)
                break;
        }

        if (i === groups.length)
            groups.push([]);

        groups[i].push(server);
    });

    servers = groups.map(function (group)
    {
        if (group.length > 1)
        {
            var names = []; var files = [];

            group.forEach(function (server)
            {
                if (names.indexOf(server.name) === -1)
                    names.push(server.name);

                server.files.forEach(function (file)
                {
                    if (files.indexOf(file) === -1)
                        files.push(file);
                });
            });

            group[0].name = names.join(", "); group[0].files = files;
        }

        return group[0];
    });

    return servers;
}

function summarize(client, dashboard)
{
    var now = new Date();

    var servers = merge(dashboard.servers.map(function (server)
    {
        var localtime = new Date(now.getTime() +
            (now.getTimezoneOffsetDST() * 60 * 1000) + (server.timezone * 60 * 1000));

        return {name: server.name, host: server.host, checksum: checksum(server.host), files: sources(server),
            localtime: localtime.getTime(), today: moment(localtime).startOf("day").valueOf(), errors: [], warnings: [], versions: []};
    }));

    var name = checksum(dashboard.name);

    var groups;

    var events = [];

    var handle = function (error, results)
    {
        var index = groups.indexOf(this.group);

        if (index === -1) {
            log.fatal("Unable to find events group", this.group);
        }
        else
            groups.splice(index, 1);

        if (error) {
            log.fatal("Redis error", error);
        }
        else
        {
            results.filter(function (result) { return result ? true : false; }).forEach(function (result)
            {
                var parts = result.split(":");

                if (parts.length !== 4) {
                    log.error("Invalid event", result);
                }
                else
                {
                    var list = [];

                    for (var i = 0; i < servers.length; i ++)
                    {
                        if (servers[i].checksum === parts[2] && servers[i].today === moment(Number(parts[3])).startOf("day").valueOf())
                            list.push(servers[i]);
                    }

                    if (list.length)
                        events.push({event: result, group: this.group, type: parts[0] + "s", servers: list});
                }
            }.bind(this));
        }

        if (groups.length)
        {
            this.resolve();

            return;
        }

        var multi = client.multi();

        events.forEach(function (event) {
            multi.hgetall(event.event).del(event.event).srem(event.group, event.event);
        });

        multi.exec(function (error, replies)
        {
            if (error)
            {
                log.fatal("Redis error", error);

                this.resolve();

                return;
            }
            
            if (replies.length !== events.length * 3)
            {
                log.fatal("Events number mismatch", replies.length, "expecting", events.length);

                this.resolve();

                return;
            }

            events.forEach(function (event, index)
            {
                var reply = replies[index * 3];

                if (reply)
                {
                    event.servers.forEach(function (server)
                    {
                        if (!reply.file || server.files.indexOf(reply.file) !== -1)
                            server[event.type].push(reply);
                    });
                }
                else
                    log.error("Invalid event", event.event, "data for group", event.group);
            });

            Promise.all(servers.map(function (server) { return update(client, name, server); }))
                .then(function () { this.resolve(); }.bind(this));

        }.bind(this));
    };

    return new Promise(function (resolve)
    {
        cursor.scan(client, "events:*", function (error, results)
        {
            if (error)
            {
                log.fatal("Redis error", error);

                resolve();

                return;
            }

            var promises = [];

            (groups = results.filter(function (result)
            {
                if (result.split(":").length !== 2)
                {
                    log.error("Invalid events set", result);

                    return false;
                }

                return true;

            })).forEach(function (group)
            {
                promises.push(new Promise(function (resolve) {
                    cursor.sscan(client, group, "*:" + name + ":*", handle.bind({group: group, resolve: resolve}));
                }));
            });

            Promise.all(promises).then(function () { resolve(); });
        });
    });
}

module.exports = function ()
{
    var client = redis.createClient()
        .on("ready", function ()
        {
            var promises = [];

            ACCOUNTS.forEach(function (account)
            {
                account.dashboards.forEach(function (dashboard) {
                    promises = promises.concat(summarize(client, dashboard));
                });
            });

            var cleanup = function ()
            {
                clearTimeout(timeout);

                client.removeAllListeners().quit();
            };

            var timeout = setTimeout(function ()
            {
                log.fatal("Timeout suicide for summary");

                client.removeAllListeners().quit();

                process.exit(1);

            }, TIMEOUT);

            Promise.all(promises).then(cleanup).catch(function (error) {
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