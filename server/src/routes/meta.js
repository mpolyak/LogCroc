/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var heapdump = require("heapdump");
var memwatch = require("memwatch-next");
var moment   = require("moment");
var redis    = require("redis");
var path     = require("path");
var util     = require("util");
var fs       = require("fs");

var log = require("../log.js");

var INTERVAL = 500;
var SAMPLES  = 600;

function stringify(object) {
    return util.inspect(object).replace(/[\\{\\}\s]/g, " ").split(" ").filter(function (text) { return text.trim(); }).join(" ");
}

function getVersion(req, res, next)
{
    try {
        res.set("Content-Type", "text/plain").status(200).send(require("../../package.json").version);
    }
    catch (error)
    {
        log.fatal("Require error", error);

        next();
    }
}

var REGEX =
[
    {match: new RegExp("\\/\\?eat=[\\w\\-]+", "gi"), replace: "/?eat=*****"},
    {match: new RegExp("\\/eat\\/[\\w\\-]+", "gi"), replace: "/eat/*****"},
    {match: new RegExp("\\/\\?report=[\\w\\-]+", "gi"), replace: "/?report=*****"},
    {match: new RegExp("\\d+\\.\\d+\\.\\d+\\.\\d+", "gi"), replace: "X.X.X.X"},
    {match: new RegExp("http[s]?\\:\\/\\/[\\w\\d\\:\\/\\-\\.]+", "gi"), replace: "http://X.X.X.X"}
];

function sanitize(text)
{
    return REGEX.reduce(function (text, regex) {
        return text.replace(regex.match, regex.replace); }, text);
}

function scrub(text)
{
    return text.split(/[\n\r]/g).map(function (line)
    {
        var fragments = line.split(/\s/g);

        if (fragments.length < 5)
            return "";

        switch (fragments[2])
        {
            case "FATAL":
            case "ERROR":
                break;

            case "WARN":
                switch (fragments[3])
                {
                    case "Unable":
                        if (fragments.length > 7)
                            fragments[7] = sanitize(fragments[7]);

                        break;

                    case "Range":
                        if (fragments.length > 5)
                            fragments[5] = sanitize(fragments[5]);

                        break;

                    case "Download":
                        fragments = fragments.slice(0, 5).concat(["..."]);
                        break;
                }

                break;

            case "INFO":
                switch (fragments[3])
                {
                    case "Remote":
                        if (fragments.length > 4)
                        {
                            fragments[4] = sanitize(fragments[4]);

                            if (fragments.length > 6)
                                fragments[6] = sanitize(fragments[6]);
                        }

                        break;

                    case "Status":
                    case "Table":
                    case "Version":
                    case "Warning":
                    case "Error":
                        if (fragments.length > 4)
                            fragments = fragments.slice(0, 4).concat(["..."]);

                        break;

                    case "Socket":
                        if (fragments.length > 5)
                            fragments = fragments.slice(0, 5).concat(["..."]);

                        break;

                    case "Publish":
                    case "Dependency":
                        if (fragments.length > 6)
                        {
                            fragments[5] = "*****"; fragments[6] = "http://X.X.X.X";

                            if (fragments.length > 7)
                                fragments = fragments.slice(0, 7).concat(["..."]);
                        }

                        break;

                    case "Reply":
                        if (fragments.length > 4)
                            fragments[4] = "*****";

                        break;

                    case "Token":
                        if (fragments.length > 9) {
                            fragments[4] = "*****"; fragments[9] = "X.X.X.X";
                        }

                        break;

                    case "Email":
                        if (fragments.length > 5)
                            fragments = fragments.slice(0, 5).concat(["..."]);

                        break;
                }

                break;

            default:
                return "";
        }

        return fragments.join(" ");

    }).filter(function (line) { return line.length > 0; }).join("\n");
}

function read(callback)
{
    var file = process.env.NODE_ENV === "development" ?
        path.join(__dirname, "../../logcroc.log") : "/var/log/logcroc.log";

    fs.readFile(file, "utf8", function (error, text)
    {
        if (error) {
            callback(error, null);
        }
        else
            callback(null, scrub(text));
    });
}

function getLog(req, res, next)
{
    var file = path.join(__dirname, "../../temp/meta.log");

    fs.stat(file, function (error, stats)
    {
        if (stats && (new Date()).getTime() - stats.mtime.getTime() < 60 * 1000) {
            fs.createReadStream(file).pipe(res.set("Content-Type", "text/plain"));
        }
        else
        {
            read(function (error, text)
            {
                if (error)
                {
                    log.fatal("File error", error);

                    next();

                    return;
                }

                fs.writeFile(file, text, "utf8", function (error)
                {
                    if (error)
                        log.fatal("File error", error);
                });

                res.set("Content-Type", "text/plain").status(200).send(text);
            });
        }
    });
}

var database = {timestamp: 0, info: ""};

function getRedis(req, res, next)
{
    if ((new Date()).getTime() - database.timestamp >= 60 * 1000)
    {
        var client = redis.createClient()
            .on("ready", function ()
            {
                client.info([], function (error, result)
                {
                    if (error)
                    {
                        log.fatal("Redis error", error);

                        res.status(500).end();
                    }
                    else
                    {
                        client.removeAllListeners().quit();

                        database.timestamp = (new Date()).getTime();
                        
                        res.set("Content-Type", "text/plain").status(200).send(database.info = result);
                    }
                });
            })
            .on("error", function (error)
            {
                log.fatal("Redis error", error);

                res.status(500).end();
            });
    }
    else
        res.set("Content-Type", "text/plain").status(200).send(database.info);
}

function write(message)
{
    var file = path.join(__dirname, "../../temp/memwatch.log");

    fs.stat(file, function (error, stats)
    {
        var action = stats && (new Date()).getDate() === stats.mtime.getDate() ?
            fs.appendFile : fs.writeFile;

        action(file, message, "utf8", function (error)
        {
            if (error)
                log.fatal("File error", error);
        });
    });
}

memwatch.on("stats", function (stats)
{
    var usage = process.memoryUsage();

    write(moment().format() + " " + (stats.usage_trend > 0 ? "WARN" : "INFO") + " " +
        stringify(stats) + ", heap_total: " + usage.heapTotal + ", heap_used: " + usage.heapUsed + ", rss: " + usage.rss + "\n");
});

memwatch.on("leak", function (info)
{
    write(message = moment().format() + " ERROR " + stringify(info)  + "\n");
});

function getMemWatch(req, res, next)
{
    var file = path.join(__dirname, "../../temp/memwatch.log");

    fs.exists(file, function (exists)
    {
        if (exists) {
            fs.createReadStream(file).pipe(res.set("Content-Type", "text/plain"));
        }
        else
            res.set("Content-Type", "text/plain").status(200).send("");
    });
}

var cpuwatch = {hrtime: null, samples: [], timestamp: 0, result: {avg: 0, min: 0, max: 0, stdev: 0}};

function measure()
{
    if (cpuwatch.hrtime)
    {
        var diff = process.hrtime(cpuwatch.hrtime);

        cpuwatch.samples.push(((diff[0] * 1e9) + diff[1]) / 1e6);

        var timestamp = (new Date()).getTime();

        if (cpuwatch.samples.length === SAMPLES || (cpuwatch.samples.length && cpuwatch.timestamp && timestamp - cpuwatch.timestamp >= INTERVAL * SAMPLES))
        {
            var result = cpuwatch.result;

            result.avg = result.min = result.max = 0;

            cpuwatch.samples.forEach(function (milliseconds, index)
            {
                if (index)
                {
                    if (milliseconds < result.min)
                        result.min = milliseconds;

                    if (milliseconds > result.max)
                        result.max = milliseconds;
                }
                else
                    result.min = result.max = milliseconds;

                result.avg += milliseconds;
            });

            result.avg /= cpuwatch.samples.length;

            result.stdev = Math.sqrt(cpuwatch.samples.reduce(function (sum, milliseconds)
                { return sum + Math.pow(milliseconds - result.avg, 2); }, 0) / cpuwatch.samples.length);

            cpuwatch.samples = []; cpuwatch.timestamp = timestamp;

            var response = ((result.avg + result.stdev) / INTERVAL) * 100;

            var message = moment().format() + " " + (response > 300 ? "FATAL" : (response > 200 ? "ERROR" : (response > 150 ? "WARN" : "INFO"))) + " " +
                Object.keys(result).map(function (key) { return key + ": " + result[key]; }).join(", ") + "\n";

            var file = path.join(__dirname, "../../temp/cpuwatch.log");

            fs.stat(file, function (error, stats)
            {
                var action = stats && (new Date()).getDate() === stats.mtime.getDate() ?
                    fs.appendFile : fs.writeFile;

                action(file, message, "utf8", function (error)
                {
                    if (error)
                        log.fatal("File error", error);
                });
            });
        }
    }

    cpuwatch.hrtime = process.hrtime();

    setTimeout(measure, INTERVAL);
}

if (INTERVAL && SAMPLES)
    measure();

function getCpuWatch(req, res, next)
{
    var file = path.join(__dirname, "../../temp/cpuwatch.log");

    fs.exists(file, function (exists)
    {
        if (exists) {
            fs.createReadStream(file).pipe(res.set("Content-Type", "text/plain"));
        }
        else
            res.set("Content-Type", "text/plain").status(200).send("");
    });
}

var dump = {timestamp: 0};

function getHeapDump(req, res, next)
{
    if ((new Date()).getTime() - dump.timestamp >= 60 * 1000)
    {
        var file = path.join(__dirname, "../../temp/" + (new Date()).getTime() + ".heapsnapshot");

        heapdump.writeSnapshot(file, function(error, file)
        {
            dump.timestamp = (new Date()).getTime();

            if (error)
            {
                log.fatal("Snapshot error", error);

                res.status(500).end();
            }
            else
            {
                log.info("Heap Dump", file);

                res.sendFile(file, function (error)
                {
                    if (error)
                    {
                        log.fatal("Send file error", error);

                        res.status(error.status).end();
                    }
                    else
                    {
                        log.info("Sent file", file);

                        fs.unlink(file, function (error)
                        {
                            if (error)
                                log.fatal("File error", error);
                        });
                    }
                });
            }
        });
    }
    else
        res.status(503).end();
}

module.exports = function (app)
{
    app.get("/meta/version",  getVersion);
    app.get("/meta/log",      getLog);
    app.get("/meta/redis",    getRedis);
    app.get("/meta/memwatch", getMemWatch);
    app.get("/meta/cpuwatch", getCpuWatch);

    if (process.env.NODE_ENV === "development")
        app.get("/meta/heapdump", getHeapDump);

    app.get("/meta", function (req, res, next) {
        res.redirect(process.env.NODE_ENV === "development" ? "http://localhost:3000" : "http://logcroc.com");
    });
};