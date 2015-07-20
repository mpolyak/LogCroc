/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var compression = require("compression");
var express     = require("express");
var morgan      = require("morgan");
var moment      = require("moment");
var path        = require("path");

var CronJob = require("cron").CronJob;

var app = express();

app.use(compression());

morgan.token("time", function () {
    return moment().format("YYYY/MM/DD HH:mm:ss.SSS");
});

morgan.token("type", function (req, res) {
    return res.statusCode >= 500 ? "ERROR" : (res.statusCode >= 400 ? "WARN" : "INFO");
});

app.use(morgan(":time :type Remote :remote-addr :method :url :status :res[content-length] :response-time ms"));

app.use(express.static(path.join(__dirname, "../../client/static")));

var task = require("./task.js");

function refreshTask() {
    task(path.join(__dirname, "./refresh.js"));
}

function summaryTask() {
    task(path.join(__dirname, "./summary.js"));
}

function emailerTask() {
    task(path.join(__dirname, "./emailer.js"));
}

(new CronJob("* * * * *", function ()
    { refreshTask(); })).start();

(new CronJob("0 * * * *", function ()
    { summaryTask(); })).start();

(new CronJob("1 0 * * *", function ()
	{ emailerTask(); })).start();

refreshTask();
summaryTask();

var io = require("socket.io").listen(app.listen(process.env.NODE_ENV === "development" ? 3000 : 80));

require("./routes/account.js")(app, io);
require("./routes/report.js")(app);
require("./routes/demo.js")(app);
require("./routes/meta.js")(app);