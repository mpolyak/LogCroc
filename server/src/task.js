/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var moment = require("moment");

var fork = require("child_process").fork;

var log = require("./log.js");

var children = {};

function stdoutHandler(data)
{
    process.stdout.write(data);
}

function stderrHandler(data)
{
    process.stderr.write(data);
}

function closeHandler()
{
	this.removeListener("close", closeHandler);
	
    this.stdout.removeListener("data", stdoutHandler);
    this.stderr.removeListener("data", stderrHandler);

    var now = (new Date()).getTime();

    log.info("Fork", this.pid, "of", children[this.pid].module,
        "ran for", moment.duration(now - children[this.pid].timestamp).humanize());

    delete children[this.pid];

    var kill = [];

    for (var pid in children)
    {
        if (now - children[pid].timestamp >= 60 * 60 * 1000)
        {
            log.error("Killing fork", pid, "of", children[pid].module);

            kill.push(children[pid].child);
        }
    }

    kill.forEach(function (child) {
        child.kill();
    });
}

module.exports = function (module)
{
    try
    {
        var child = fork(module, [], {silent: true});

        child.stdout.on("data", stdoutHandler);
        child.stderr.on("data", stderrHandler);

        child.on("close", closeHandler);

        children[child.pid] = {child: child, module: module, timestamp: (new Date()).getTime()};

        log.info("Forked", module, "as", child.pid);
    }
    catch (error) {
        log.fatal("Fork error", error, "for", module);
    }
};