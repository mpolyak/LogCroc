/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

exports.date = function (template, date)
{
    var year = date.getFullYear(); var month = date.getMonth() + 1; var day = date.getDate();
    
    return template
        .replace(/{yyyy}/g, year)
        .replace(/{mm}/g, (month < 10 ? "0" : "") + month)
        .replace(/{m}/g, month)
        .replace(/{dd}/g, (day < 10 ? "0" : "") + day)
        .replace(/{d}/g, day);
};