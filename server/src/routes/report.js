/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var moment = require("moment");

var report = require("../report.js");
var log    = require("../log.js");

var ACCOUNTS = require("../../accounts.json").accounts;

module.exports = function (app)
{
    app.get("/eat/:token/report/:days/:start*?", function (req, res, next)
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

        var days = Number(req.params.days);

        if (isNaN(days))
        {
            log.error("Report number of days", "\"" + req.params.days + "\"", "is invalid");

            next();

            return;
        }

        report(dashboard, days, req.params.start, function (days) {
            res.send({name: dashboard.name, days: days || []});
        });
    });
};