/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var http = require("http");
var events = require("events");
var inherits = require("inherits");

var io = require("socket.io-client");

var Promise = require("promise");

inherits(Account, events.EventEmitter);

function Account()
{
    this.socket = io("/eat");

    this.tokens = [];

    this.socket.on("connect", function ()
    {
        for (var i = 0; i < this.tokens.length; i ++)
            this.socket.emit("subscribe", this.tokens[i]);
    }.bind(this));

    this.socket.on("token", function (data)
    {
        if (this.tokens.indexOf(data.token) !== -1)
            this.emit("token", data);
    }.bind(this));

    this.socket.on("dependency", function (data)
    {
        if (this.tokens.indexOf(data.token) !== -1)
            this.emit("dependency", data);
    }.bind(this));
}

Account.prototype.load = function (token)
{
    return new Promise(function (resolve, reject)
    {
        http.get({path: "/eat/" + token},
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

Account.prototype.subscribe = function (token)
{
    var index = this.tokens.indexOf(token);

    if (index !== -1)
        return;

    this.tokens.push(token);

    this.socket.emit("subscribe", token);
}

Account.prototype.unsubscribe = function (token)
{
    var index = this.tokens.indexOf(token);

    if (index === -1)
        return;

    this.tokens.splice(index, 1);

    this.socket.emit("unsubscribe", token);
}

module.exports = new Account();