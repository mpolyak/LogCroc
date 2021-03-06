/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

if (!Array.prototype.find)
{
    Array.prototype.find = function (callback)
    {
        if (typeof callback !== "function")
            throw new TypeError((callback ? callback.toString() : "null") + " is not a function");

        for (var i = 0; i < this.length; i ++)
        {
            if (callback.call(arguments[1], this[i], i, this))
                return this[i];
        }

        return undefined;
    };
}

exports.find = Array.prototype.find;

if (!Array.prototype.findIndex)
{
    Array.prototype.findIndex = function (callback)
    {
        if (typeof callback !== "function")
            throw new TypeError((callback ? callback.toString() : "null") + " is not a function");

        for (var i = 0; i < this.length; i ++)
        {
            if (callback.call(arguments[1], this[i], i, this))
                return i;
        }

        return -1;
    };
}

exports.findIndex = Array.prototype.findIndex;

if (!Date.prototype.getTimezoneOffsetDST)
{
    Date.prototype.getTimezoneOffsetDST = function ()
    {
        return Math.max(
            (new Date(this.getFullYear(), 0, 1)).getTimezoneOffset(),
            (new Date(this.getFullYear(), 6, 1)).getTimezoneOffset());
    };
}

exports.getTimezoneOffsetDST = Date.prototype.getTimezoneOffsetDST;