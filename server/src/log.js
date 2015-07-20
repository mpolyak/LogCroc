/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var moment = require("moment");

function stringify(args)
{
    var str = "";

    for (var i = 0; i < args.length; i ++)
        str += (i ? " " : "") + args[i.toString()];

    return str;
}

function timestamp()
{
    return moment().format("YYYY/MM/DD HH:mm:ss.SSS");
}

exports.info = function ()
{
    console.info.call(null, timestamp(), "INFO", stringify(arguments));
};

exports.warn = function ()
{
    console.warn.call(null, timestamp(), "WARN", stringify(arguments));
};

exports.error = function ()
{
    console.error.call(null, timestamp(), "ERROR", stringify(arguments));
};

exports.fatal = function ()
{
    console.error.call(null, timestamp(), "FATAL", stringify(arguments));
};