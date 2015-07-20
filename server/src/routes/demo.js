/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var numeral = require("numeral");
var moment  = require("moment");
var seed    = require("seedrandom");
var path    = require("path");
var ejs     = require("ejs");
var fs      = require("fs");

var log = require("../log.js");

function lerp(a, b, t) {
    return ((1 - t) * a) + (t * b);
}

var SENSORS =
[
    {name: "Salinity", units: " g/kg", format: "", median: 27, range: [15, 40],
        error: {range: [21, 34], color: "#FF0000", message: "ERROR: Salinity <%= value %> is at a critical level (21 - 34 g/kg)"},
        warning: {range: [25, 30], color: "#FFFF00", message: "WARNING: Salinity <%= value %> is at a caution level (25 - 30 g/kg)"}
    },
    { name: "Temperature", units: " °C", format: "", median: 25, range: [15, 35],
        error: {range: [18, 30], color: "#FF0000", message: "ERROR: Temperature <%= value %> is at a critical level (18 - 30 °C)"},
        warning: {range: [21, 27], color: "#FFFF00", message: "WARNING: Temperature <%= value %> is at a caution level (21 - 27 °C)"}
    },
    {name: "pH", units: " pH", format: "0.0", median: 8.5, range: [6.5, 9.5],
        error: {range: [7.0, 9.0], color: "#FF0000", message: "ERROR: <%= value %> is is at a critical level (7.0 - 9.0 pH)"},
        warning: {range: [7.5, 8.5], color: "#FFFF00", message: "WARNING: <%= value %> is at a caution level (7.5 - 8.5 pH)"}
    }
];

function getSensors(req, res, next)
{
    var customer = Number(req.params.customer);

    if (isNaN(customer) || customer < 0 || customer > 4)
    {
        log.error("Customer", req.params.customer, "is invalid");
        
        next();

        return;
    }

    var now = new Date();

    var random = seed(customer + Math.floor(now.getTime() / (1 * 60 * 1000)), {entropy: true});

    var html = "<html><head><style>table, th, td {border-collapse: collapse;} th, td {padding: 10px; border: 1px solid black;}</style></head><body><table><thead>" +
        "<tr>" +
            "<th>Sensor</th>" +
            "<th>Time</th>" +
            "<th>Value</th>" +
            "<th></th>" +
        "</tr></thead><tbody>";

    SENSORS.forEach(function (sensor)
    {
        var value = lerp(sensor.range[0] + ((sensor.range[1] - sensor.range[0]) * random()),
            sensor.median, random());

        var style = ""; var message = "";

        if (value < sensor.error.range[0] || value > sensor.error.range[1])
        {
            style = "background-color: " + sensor.error.color;

            message = sensor.error.message;
        }
        else if (value < sensor.warning.range[0] || value > sensor.warning.range[1])
        {
            style = "background-color: " + sensor.warning.color;

            message = sensor.warning.message;
        }

        value = numeral(value).format(sensor.format) + sensor.units;

        if (message)
            message = ejs.render(message, {value: value});

        html += "<tr style='" + style + "'>" +
                "<td>" + sensor.name + "</td>" +
                "<td>" + moment(now).format() + "</td>" +
                "<td>" + value + "</td>" +
                "<td>" + message + "</td>" +
            "</tr>";
    });

    html += "</table></body></html>";

    res.set("Content-Type", "text/html").status(200).send(html);
}

function getVersion(req, res, next)
{
    var customer = Number(req.params.customer);

    if (isNaN(customer) || customer < 0 || customer > 4)
    {
        log.error("Customer", req.params.customer, "is invalid");

        next();

        return;
    }

    var now = new Date();

    var random = seed(customer.toString() + moment(now).startOf("day").toString(), {entropy: true});

    var version = (now.getFullYear() - 2013) + "." + ((now.getMonth() + 1) % 11) + "." + ((now.getDay() + 1) % 7) +
        "." + Math.floor(Number(moment(now).format("DDD")) * random());

    res.set("Content-Type", "text/plain").status(200).send(version);
}

var EQUIPMENT =
[
    {name: "Pump", units: " GPM", format: "", median: 120, range: [80, 120],
        error: {range: [95, 120], message: "Pump flow rate <%= value %> is below 95 GPM"},
        warning: {range: [105, 120], message: "Pump flow rate <%= value %> is below 105 GPM"}
    },
    {name: "Filter", units: " psi", format: "0.0", median: 7.0, range: [4.0, 7.0],
        error: {range: [5.0, 7.0], message: "Filter pressure <%= value %> is below 5.0 psi"},
        warning: {range: [5.5, 7.0], message: "Filter pressure <%= value %> is below 5.5 psi"}
    },
    {name: "Feeder", units: " kg/h", format: "0.0", median: 0.25, range: [0.0, 1.0],
        error: {range: [0.1, 0.9], message: "Feed amount <%= value %> is at critical level (0.1 - 0.9 kg/h)"},
        warning: {range: [0.15, 0.75], message: "Feed amount <%= value %> is at caution level (0.15 - 0.75 kg/h)"}
    },
    {name: "Heater", units: " MBTU/h", format: "", median: 5000, range: [1000, 5000],
        error: {range: [1500, 5000], message: "Heater output <%= value %> is below 1500 MBTU/h"},
        warning: {range: [2500, 5000], message: "Heater output <%= value %> is below 2500 MBTU/h"}
    }
];

function equipmentEvents(random, equipment)
{
    if (random() < 0.75)
        return [];

    var value = lerp(equipment.range[0] + ((equipment.range[1] - equipment.range[0]) * random()),
        equipment.median, random());

    var type = ""; var message = "";

    if (value < equipment.error.range[0] || value > equipment.error.range[1])
    {
        type = "Error";

        message = equipment.error.message;
    }
    else if (value < equipment.warning.range[0] || value > equipment.warning.range[1])
    {
        type = "Warn";

        message = equipment.warning.message;
    }
    else
    {
        type = "Info";

        message = equipment.name + " <%= value %>";
    }

    value = numeral(value).format(equipment.format) + equipment.units;

    if (message)
        message = ejs.render(message, {value: value});

    return [{type: type, message: message}];
}

function make(customer, timestamp)
{
    var equipment = function (equipment) {
        return equipmentEvents(this, equipment);
    };

    var concat = function (combined, list) {
        return combined.concat(list);
    };

    var string = function (event, index, events)
    {
        var time = Number(this) + Math.floor((index / events.length) * 60 * 1000);

        return moment(time).format() + " " + event.type + " " + event.message;
    };

    var now = (new Date()).getTime();

    var text = "";

    for (var time = moment(timestamp).startOf("minute").add(1, "minutes").valueOf();
        time <= now; time += 60 * 1000)
    {
        var random = seed(customer.toString() + moment(time).format("D h:mm"), {entropy: true});

        var events = (random() < 0.01 ? [{type: "Fatal", message: "Crocodile escaped enclosure!"}] : []).concat(
            EQUIPMENT.map(equipment.bind(random)).reduce(concat, [])).map(string.bind(time)).join("\n");

        if (events)
            text += events + "\n";
    }

    return text;
}

function getCustomer(req, res, next)
{
    var customer = Number(req.params.customer);

    if (isNaN(customer) || customer < 0 || customer > 4)
    {
        log.error("Customer", req.params.customer, "is invalid");

        next();

        return;
    }

    var file = path.join(__dirname, "../../temp/demo_" + customer + ".log");

    fs.stat(file, function (error, stats)
    {
        var now = new Date(); var today = moment(now).startOf("day").valueOf();

        var timestamp = stats && now.getDate() === stats.mtime.getDate() ?
            stats.mtime.getTime() : today;

        var action = timestamp === today ? fs.writeFile : fs.appendFile;

        action(file, make(customer, timestamp), "utf8", function (error)
        {
            if (error)
            {
                log.fatal("File error", error);

                res.status(500).end();
            }
            else
                fs.createReadStream(file).pipe(res.set("Content-Type", "text/plain"));
        });
    });
}

module.exports = function (app)
{
    app.get("/demo/:customer/sensors",  getSensors);
    app.get("/demo/:customer/version",  getVersion);
    app.get("/demo/:customer/customer", getCustomer);

    app.get("/demo/:customer", function (req, res, next) {
        res.redirect(process.env.NODE_ENV === "development" ? "http://localhost:3000" : "http://logcroc.com");
    });
};