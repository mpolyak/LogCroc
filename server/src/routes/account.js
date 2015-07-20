/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var moment = require("moment");
var redis  = require("redis");

var checksum = require("../checksum.js");
var report   = require("../report.js");
var log      = require("../log.js");

var ACCOUNTS = require("../../accounts.json").accounts;

var tokens = {};

var client = redis.createClient()
    .on("error", function (error)
    {
        log.fatal("Redis error", error);
    });

var pubsub = redis.createClient()
    .on("error", function (error)
    {
        log.fatal("Redis error", error);
    })
    .on("connect", function ()
    {
        log.info("Redis subscribe");

        pubsub.subscribe("status", "version", "table");
    })
    .on("message", function (channel, message)
    {
        var parts = message.split(":");

        if (parts.length !== 3)
        {
            log.error("Invalid", message, "message for channel", channel);

            return;
        }

        var name = parts[0];
        var host = parts[1];
        var file = parts[2];

        updateTokens(channel, name, host, file);
        updateDependencies(channel, name, host, file);
    });

function updateTokens(channel, name, host, file)
{
    var list = [];

    ACCOUNTS.forEach(function (account)
    {
        account.dashboards.forEach(function (dashboard)
        {
            if (checksum(dashboard.name) !== name)
                return;

            dashboard.servers.forEach(function (server)
            {
                if (!server[channel] || checksum(server.host) !== host || checksum(server[channel].file) !== file)
                    return;

                dashboard.access.map(function (access) { return access.token; })
                    .forEach(function (token)
                {
                    if (tokens[token])
                        list.push({token: token, name: dashboard.name, host: server.host, file: server[channel].file});
                });
            });
        });
    });

    if (!list.length)
        return;

    client.hgetall(channel + ":" + name + ":" + host + ":" + file, function (error, result)
    {
        if (error) {
            log.fatal("Redis error", error);
        }
        else
        {
            list.forEach(function (server)
            {
                var sockets = tokens[server.token];

                log.info("Publish", sockets.length, server.token, server.name, server.host, server.file);

                sockets.forEach(function (socket) {
                    socket.emit("token", {token: server.token, source: channel, name: server.name, host: server.host, file: server.file, value: result});
                });
            });
        }
    });
}

function listDependencies(servers)
{
    var channels = ["status", "version", "table"];

    var list = [];

    servers.filter(function (server) { return server.dependencies && server.dependencies.length; })
        .forEach(function (server)
    {
        server.dependencies.forEach(function (dependency)
        {
            channels.forEach(function (channel)
            {
                var source = dependency[channel];

                if (!source)
                    return;

                var host = source.host || server.host;

                var i;

                for (i = 0; i < list.length; i ++)
                {
                    if (list[i].source === channel && list[i].name === source.name && list[i].host === host && list[i].file === source.file)
                        break;
                }

                if (i === list.length)
                    list.push({source: channel, name: source.name, host: host, file: source.file, alias: dependency.alias});
            });
        });
    });

    return list;
}

function fillDependencies(servers, list)
{
    var channels = ["status", "version", "table"];

    servers.filter(function (server) { return server.dependencies && server.dependencies.length; })
        .forEach(function (server)
    {
        server.dependencies.forEach(function (dependency)
        {
            channels.forEach(function (channel)
            {
                var source = dependency[channel];

                if (!source)
                    return;

                var host = source.host || server.host;

                list.forEach(function (item)
                {
                    if (item.source === channel && item.name === source.name && item.host === host && item.file === source.file)
                        source.value = item.value;
                });
            });
        });
    });
}

function updateDependencies(channel, name, host, file)
{
    var list = []; var dependents = [];

    ACCOUNTS.forEach(function (account)
    {
        account.dashboards.forEach(function (dashboard)
        {
            var servers = [];

            dashboard.servers.forEach(function (server)
            {
                if (server.dependencies)
                    servers.push(server);

                if (server[channel] && checksum(dashboard.name) === name && checksum(server.host) === host && checksum(server[channel].file) === file)
                    list.push({dashboard: dashboard, server: server});
            });

            if (!servers.length)
                return;

            dashboard.access.map(function (access) { return access.token; })
                .forEach(function (token)
            {
                if (tokens[token])
                    dependents.push({token: token, servers: servers});
            });
        });
    });

    if (!list.length || !dependents.length)
        return;

    var handler = function (error, result)
    {
        if (error) {
            log.fatal("Redis error", error);
        }
        else
        {
            this.dependency.value = result;

            fillDependencies(this.dependent.servers, [this.dependency]);

            this.dependent.servers.forEach(function (server)
            {
                server.dependencies.map(function (dependency) { return dependency[channel]; }).filter(function (dependency) { return dependency ? true : false; })
                    .forEach(function (dependency)
                {
                    if (dependency.name !== this.dependency.name || this.dependency.host !== (dependency.host || server.host) || dependency.file !== this.dependency.file)
                        return;

                    var sockets = tokens[this.dependent.token];

                    log.info("Dependency", sockets.length, this.dependent.token, dependency.name, server.host, dependency.file);

                    sockets.forEach(function (socket)
                    {
                        socket.emit("dependency", {token: this.dependent.token, source: channel, name: dependency.name, host: server.host,
                            file: dependency.file, value: dependency.value});
                    }, this);
                }, this);
            }, this);
        }
    };

    dependents.forEach(function (dependent)
    {
        listDependencies(dependent.servers).forEach(function (dependency)
        {
            if (dependency.source !== channel)
                return;

            list.forEach(function (source)
            {
                var dashboard = source.dashboard; var server = source.server;

                if (!server[channel] || dashboard.name !== dependency.name || server.host !== dependency.host || server[channel].file !== dependency.file)
                    return;

                client.hgetall(channel + ":" + checksum(dependency.name) + ":" + checksum(dependency.host) + ":" + checksum(dependency.file),
                    handler.bind({dependent: dependent, dependency: dependency}));
            });
        });
    });
}

function updateDependents(content, req, res)
{
    var list = listDependencies(content.servers);

    if (!list.length)
    {
        log.info("Reply", req.params.token);

        res.send(content);

        return;
    }

    var complete = 0;

    var handle = function (error, result)
    {
        if (error) {
            log.fatal("Redis error", error);
        }
        else
            this.value = result;

        complete ++;

        if (complete === list.length)
        {
            fillDependencies(content.servers, list);

            log.info("Reply", req.params.token);

            res.send(content);
        }
    };

    list.forEach(function (dependency)
    {
        client.hgetall(dependency.source + ":" + checksum(dependency.name) + ":" + checksum(dependency.host) + ":" + checksum(dependency.file),
            handle.bind(dependency));
    });
}

module.exports = function (app, io)
{
    app.get("/eat/:token", function (req, res, next)
    {
        var token = function (access) {
            return access.token === req.params.token;
        };

        var dashboard = ACCOUNTS.reduce(function (dashboard, account)
        {
            if (dashboard)
                return dashboard;

            return account.dashboards.reduce(function (dashboard, current)
            {
                if (dashboard)
                    return dashboard;

                return current.access.some(token) ? current : null;

            }, dashboard);

        }, null);

        if (!dashboard)
        {
            log.error("Account token", req.params.token, "not found");

            next();

            return;
        }

        var content = {name: dashboard.name, servers: dashboard.servers.map(function (server)
        {
            return {name: server.name, timezone: server.timezone, host: server.host, dependencies: server.dependencies,
                table: null, status: null, version: null, files: []};
        })};

        var sources = {table: 0, status: 0, version: 0};

        var handle = function (error, result)
        {
            if (error) {
                log.fatal("Redis error", error);
            }
            else
            {
                var server = content.servers[this.index];

                server[this.source] = result; server.files.push(this.file);
            }

            sources[this.source] ++;

            if (sources.table === dashboard.servers.length && sources.status === dashboard.servers.length && sources.version === dashboard.servers.length)
                updateDependents(content, req, res);
        };

        dashboard.servers.forEach(function (server, index)
        {
            for (var source in sources)
            {
                if (server[source])
                {
                    client.hgetall(source + ":" + checksum(dashboard.name) + ":" + checksum(server.host) + ":" + checksum(server[source].file),
                        handle.bind({index: index, source: source, file: server[source].file}));
                }
                else
                    sources[source] ++;
            }
        });

        if (sources.table === dashboard.servers.length && sources.status === dashboard.servers.length && sources.version === dashboard.servers.length)
            updateDependents(content, req, res);
    });

    io.of("/eat").on("connection", function ioToken(socket)
    {
        log.info("Socket connection", socket.handshake.address);

        socket.on("subscribe", function (token)
        {
            log.info("Socket subscribe", token, socket.handshake.address);

            if (tokens[token])
            {
                if (tokens[token].indexOf(socket) !== -1)
                {
                    log.info("Token", token, "is already subscribed for", socket.handshake.address);

                    return;
                }
            }
            else
                tokens[token] = [];

            tokens[token].push(socket);
        });

        socket.on("unsubscribe", function (token)
        {
            log.info("Socket unsubscribe", token, socket.handshake.address);

            if (tokens[token])
            {
                var index = tokens[token].indexOf(socket);

                if (index !== -1)
                {
                    tokens[token].splice(index, 1);

                    if (!tokens[token].length)
                        delete tokens[token];
                }
                else
                    log.error("Token", token, "no subscription found");
            }
            else
                log.error("Token", token, "no subscription found");
        });

        socket.on("disconnect", function ()
        {
            log.info("Socket disconnect", socket.handshake.address);

            for (var token in tokens)
            {
                var index = tokens[token].indexOf(socket);

                if (index !== -1)
                {
                    tokens[token].splice(index, 1);

                    if (!tokens[token].length)
                        delete tokens[token];
                }
            }
        });
    });
};