/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

exports.flatten = function (target, name, value)
{
    for (var field in value)
        target[name + "_" + field] = value[field];
};

exports.inflate = function (target, name)
{
    var value = {};

    for (var field in target)
    {
        if (field.indexOf(name + "_") === 0)
        {
            if (target[field])
                value[field.slice(name.length + 1)] = target[field];

            delete target[field];
        }
    }

    if (Object.keys(value).length)
        target[name] = value;
};

exports.serialize = function (target, name, list)
{
    for (var i = 0; i < list.length; i ++)
    {
        var value = list[i];

        for (var field in value)
            target[name + "_" + field + "_" + i] = value[field];
    }
};

exports.deserialize = function (source, name, count, fields)
{
    var list = [];

    for (var i = 0; i < count; i ++)
    {
        var value = {};

        for (var j = 0; j < fields.length; j ++)
            value[fields[j]] = source[name + "_" + fields[j] + "_" + i];

        list.push(value);
    }

    return list;
};