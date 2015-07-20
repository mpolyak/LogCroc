/** @jsx React.DOM */

/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var url = require("url");

var React = require("react");

var Demo      = require("./views/demo.js");
var Meta      = require("./views/meta.js");
var Index     = require("./views/index.js");
var Report    = require("./views/report.js");
var Dashboard = require("./views/dashboard.js");

var query = url.parse(document.location.href, true).query;

var view;

if (query.eat) {
    view = <Dashboard token={query.eat} />;
}
else if (query.report) {
    view = <Report token={query.report} start={query.start} />;
}
else if (query.hasOwnProperty("demo")) {
    view = <Demo />;
}
else if (query.hasOwnProperty("meta")) {
    view = <Meta />;
}
else
    view = <Index />;

React.renderComponent(view, document.body);