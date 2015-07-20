/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var nodemailer = require("nodemailer");
var moment     = require("moment");
var path       = require("path");
var ejs        = require("ejs");
var fs         = require("fs");

var Styliner = require("styliner");

var report = require("./report.js");
var log    = require("./log.js");

var ACCOUNTS = require("../accounts.json").accounts;

var EMAIL =
{
    service: "gmail",

    auth:
    {
        user: "",
        pass: ""
    }
};

var styliner = new Styliner(__dirname);

function truncate(text, limit)
{
    if (limit > 3 && text.length > limit)
        return text.slice(0, limit - 3) + "...";

    return text;
}

function serversToTable(servers)
{
    var html ="<table>" +
        "<thead>" +
            "<tr>" +
                "<th>Name</th>"     +
                "<th>Address</th>"  +
                "<th>Errors</th>"   +
                "<th>Warnings</th>" +
                "<th>Version</th>"  +
            "</tr>" +
        "</thead>" +
        "<tbody>";

    servers.forEach(function (server)
    {
        html += "<tr>" +
            "<td>" + truncate(server.name, 30) + "</td>" +
            "<td>" + server.host + "</td>";

        if (server.hasOwnProperty("errors")) {
            html += "<td>" + server.errors + "</td>";
        }
        else
            html += "<td></td>";

        if (server.hasOwnProperty("warnings")) {
            html += "<td>" + server.warnings + "</td>";
        }
        else
            html += "<td></td>";

        if (server.hasOwnProperty("version")) {
            html += "<td>" + server.version + "</td>";
        }
        else
            html += "<td></td>";

        html += "</tr>";
    });

    return html + "</tbody></table>";
}

function serversToList(servers)
{
    var html = "";

    servers.forEach(function (server)
    {
        var message = "";

        ["error", "warning"].forEach(function (type)
        {
            var event = server[type];

            if (event)
            {
                message += "<blockquote>" + "<cite>" + event.occurrences + " " + type.toUpperCase() + "S" +
                     (event.version ? ", " + event.version : "") + "</cite>" + event.message + "</blockquote>";
            }
        });

        if (message)
            html += "<h3>" + server.name + "</h3>" + message;
    });

    return html;
}

function send(transport, dashboard, html, resolve)
{
    transport.sendMail({from: "LogCroc <contact@logcroc.com>", to: dashboard.summary.join(","), subject: dashboard.name + " - 24H Summary", html: html},
        function (error, info)
    {
        if (error) {
            log.fatal("Email error", error, "for", dashboard.name);
        }
        else
            log.info("Email sent for", dashboard.name, "to", dashboard.summary.join(","));

        resolve();
    });
}

function mail(transport, dashboard, servers, resolve)
{
    fs.readFile(path.join(__dirname, "../email.ejs"), "utf8", function (error, template)
    {
        if (error)
        {
            log.fatal("File error", error);

            resolve();
        }
        else
        {
            var html = ejs.render(template, {table: serversToTable(servers), list: serversToList(servers),
                timestamp: moment().format("dddd, MMMM Do YYYY, h:mm:ss a")});

            styliner.processHTML(html).then(function (html) {
                send(transport, dashboard, html, resolve);

            }, function (error)
            {
                log.fatal("Styliner error", error);

                send(transport, dashboard, html, resolve);
            });
        }
    });
}

module.exports = function ()
{
    var timestamp = function (a, b) {
        return (a.timestamp > b.timestamp) - (a.timestamp < b.timestamp);
    };

    var match = function (server) {
        return server.host === this.host;
    };

    var summary = function (days)
    {
        if (days)
        {
            if (days.length)
            {
                var servers = [];

                days.reduce(function (servers, day) { return servers.concat(day.servers); }, []).sort(timestamp)
                    .forEach(function (server)
                {
                    if (!servers.some(match.bind(server)))
                        servers.push(server);
                });

                var transport = nodemailer.createTransport(EMAIL);

                mail(transport, this, servers.sort(function (a, b)
                {
                    if (a.errors == b.errors)
                    {
                        if (a.warnings == b.warnings)
                            return (a.name > b.name) - (a.name < b.name);

                        return a.warnings > b.warnings ? -1 : 1;
                    }

                    return a.errors > b.errors ? -1 : 1;

                }), function () { transport.close(); });
            }
            else
                log.warn("Empty report for", this.name);
        }
        else
            log.error("Unable to generate report for", this.name);
    };

    var today = moment();

    if (today.hours() === 0)
        today = today.subtract(1, "day");
    
    today = today.startOf("day").format();

    ACCOUNTS.forEach(function (account)
    {
        account.dashboards.forEach(function (dashboard)
        {
            if (dashboard.summary && dashboard.summary.length)
                report(dashboard, 1, today, summary.bind(dashboard));
        });
    });
};

module.exports();