/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var http = require("http");

var Promise = require("promise");

var Report =
{
    load: function (token, days, start)
    {
        return new Promise(function (resolve, reject)
        {
            var path = "/eat/" + token + "/report/" + days;

            if (start)
                path += "/" + start.replace(new RegExp("/", "g"), "-");

            http.get({path: path},
                function (result)
            {
                var data = "";

                result.on("data", function (buffer)
                {
                    data += buffer;
                });

                result.on("end", function ()
                {
                    if (result.statusCode === 200)
                    {
                        try {
                            resolve(JSON.parse(data));
                        }
                        catch (error) {
                            reject(error);
                        }
                    }
                    else
                        reject(new Error(data));
                });
            });
        });
    }
};

module.exports = Report;