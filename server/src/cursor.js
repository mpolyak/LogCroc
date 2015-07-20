/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

function command(name, client, key, pattern, callback)
{
    var results = [];

    var execute = function (cursor)
    {
        var args = [];

        if (key)
            args.push(key);

        args.push(cursor);

        client.send_command(name, args.concat(["MATCH", pattern, "COUNT", "1000"]),
            function (error, replies)
        {
            if (error) {
                callback(error, results);
            }
            else
            {
                if (replies.length !== 2) {
                    callback(new Error("Expected 2 replies but got " + replies.toString()), results);
                }
                else
                {
                    cursor = replies[0];

                    for (var i = 0; i < replies[1].length; i ++)
                    {
                        if (results.indexOf(replies[1][i]) === -1)
                            results.push(replies[1][i]);
                    }

                    if (cursor == "0") {
                        callback(null, results);
                    }
                    else
                        execute(cursor);
                }
            }
        });
    };

    execute(0);
}

exports.scan = function (client, pattern, callback)
{
    command("SCAN", client, null, pattern, callback);
};

exports.sscan = function (client, key, pattern, callback)
{
    command("SSCAN", client, key, pattern, callback);
};