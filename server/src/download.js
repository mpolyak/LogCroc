/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var superagent = require("superagent");

var TIMEOUT = 30 * 1000;

function rangeable(file, auth, callback)
{
    superagent.head(file).auth(auth).timeout(TIMEOUT).end(
        function (error, response)
    {
        if (error) {
            callback(error, NaN);
        }
        else
        {
            if (response.ok)
            {
                callback(null, response.headers["accept-ranges"] === "bytes" ?
                    Number(response.headers["content-length"]) : NaN);
            }
            else
                callback(new Error(response.status), NaN);
        }
    });
}

function download(file, auth, start, end, callback)
{
    var request = superagent.get(file).auth(auth).timeout(TIMEOUT);

    if (!isNaN(start) && !isNaN(end))
        request.set("Range", "bytes=" + start + "-" + end);

    request.end(function (error, response)
    {
        if (error) {
            callback(error, "");
        }
        else
        {
            if (response.ok) {
                callback(null, response.text);
            }
            else
                callback(new Error(response.status), "");
        }
    });
}

module.exports = function (file, auth, range, callback)
{
    range = Number(range);

    if (!isNaN(range) && range !== 0)
    {
        rangeable(file, auth, function (error, size)
        {
            if (error) {
                download(file, auth, NaN, NaN, callback);
            }
            else
            {
                var start = NaN; var end = NaN;

                if (!isNaN(size) && Math.abs(range) < size)
                {
                    if (range > 0) {
                        start = 0; end = range - 1;
                    }
                    else {
                        start = size + range; end = size - 1;
                    }
                }

                download(file, auth, start, end, callback);
            }
        });
    }
    else
        download(file, auth, NaN, NaN, callback);
};