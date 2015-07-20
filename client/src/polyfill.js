/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

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