/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var React = require("flux-react");
var Promise = require("promise");

var AccountData = require("../data/account.js");
var ReportData = require("../data/report.js");

var tokens = []; var accounts = {}; var reports = {};

function tokenHandler(data)
{
    accounts[data.token].servers.forEach(function (server)
    {
        if (server.host === data.host && server.files.indexOf(data.file) !== -1)
            server[data.source] = data.value;
    });

    this.flush();
}

function dependencyHandler(data)
{
    accounts[data.token].servers.forEach(function (server)
    {
        if (server.dependencies)
        {
            server.dependencies.map(function (dependency) { return dependency[data.source]; })
                .forEach(function (dependency)
            {
                if (dependency && data.host === (dependency.host || server.host) && data.file === dependency.file)
                    dependency.value = data.value;
            });
        }
    });

    this.flush();
}

var Dashboard = React.createStore(
{
    REGISTER_TOKEN:   "DASHBOARD_REGISTER_TOKEN",
    UNREGISTER_TOKEN: "DASHBOARD_UNREGISTER_TOKEN",
    REFRESH_TOKEN:    "DASHBOARD_REFRESH_TOKEN",

    getAccount: function (token)
    {
        return accounts[token];
    },

    getReport: function (token)
    {
        return reports[token];
    },

    registerToken: function (token)
    {
        if (tokens.indexOf(token) === -1)
        {
            if (!tokens.length)
            {
                AccountData.on("token", tokenHandler.bind(this));
                AccountData.on("dependency", dependencyHandler.bind(this));
            }

            tokens.push(token);

            AccountData.subscribe(token);
        }

        this.refreshToken(token);
    },

    unregisterToken: function (token)
    {
        var index = tokens.indexOf(token);

        if (index === -1)
            return;

        tokens.splice(index, 1); delete accounts[token];

        AccountData.unsubscribe(token);

        if (!tokens.length)
            AccountData.removeAllListeners(["token", "dependency"]);
    },

    refreshToken: function (token)
    {
        AccountData.load(token).then(function (result)
        {
            accounts[token] = result;

            setTimeout(function () { this.flush(); }.bind(this), 0);

        }.bind(this),
            function (error)
        {
            console.log(error);
        });

        ReportData.load(token, 7).then(function (result)
        {
            reports[token] = result;

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
            case this.REGISTER_TOKEN:
                this.registerToken(payload.token);
                break;

            case this.UNREGISTER_TOKEN:
                this.unregisterToken(payload.token);
                break;

            case this.REFRESH_TOKEN:
                this.refreshToken(payload.token);
                break;
        }
    }
});

module.exports = Dashboard;
