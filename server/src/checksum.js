/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var crypto = require("crypto");

module.exports = function (value)
{
    var hash = crypto.createHash("md5");
    
    hash.write(value);

    return hash.digest("hex");
};