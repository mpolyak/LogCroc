/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var React = require("flux-react");
var Promise = require("promise");

var ReportData = require("../data/report.js");

var reports = {};

function parse(report)
{
    if (!report || !report.days || !report.days.length)
        return {name: "", days: []};

    var timestamp = function (a, b) {
        return (a.timestamp > b.timestamp) - (a.timestamp < b.timestamp);
    };

    var match = function (server) {
        return server.name === this.name && server.host === this.host;
    };

    var servers = [];

    report.days.reduce(function (servers, day) { return servers.concat(day.servers); }, []).sort(timestamp)
        .forEach(function (server)
    {
        if (!servers.some(match.bind(server)))
            servers.push(server);
    });

    return {name: report.name, servers: servers.sort(function (a, b)
    {
        if (a.errors == b.errors)
        {
            if (a.warnings == b.warnings)
                return (a.name > b.name) - (a.name < b.name);

            return a.warnings > b.warnings ? -1 : 1;
        }

        return a.errors > b.errors ? -1 : 1;

    })};
}

var Report = React.createStore(
{
    REPORT: "REPORT",

    getReport: function (token)
    {
        var report = reports[token];

        return report || {name: "", days: []};
    },

    report: function (token, start)
    {
        ReportData.load(token, 1, start).then(function (result)
        {
            reports[token] = parse(result);

            setTimeout(function () { this.flush(); }.bind(this), 0);
            
        }.bind(this),
            function (error)
        {
            console.log(error);
        });
    },

    dispatch: function (payload, waitFor)
    {
        switch (payload.type)
        {
            case this.REPORT:
                this.report(payload.token, payload.start);
                break;
        }
    }
});

module.exports = Report;