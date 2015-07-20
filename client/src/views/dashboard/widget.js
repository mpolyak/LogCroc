/** @jsx React.DOM */

/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var moment = require("moment");

var React = require("react");

var polyfill = require("../../polyfill.js");

function expandServers(parent, servers)
{
    var list = [];

    for (var i = 0; i < servers.length; i ++)
    {
        var server = servers[i];

        if (server.table && server.table.value)
        {
            var table = server.table.value;

            for (var j = 0; j < table.rows; j ++)
            {
                var timestamp = table["timestamp_" + j];
                var message = table["message_" + j];

                var status = {file: table.file, errors: 0, warnings: 0};

                switch (table["status_" + j])
                {
                    case "error":
                        status.errors = 1;

                        status.error_timestamp = timestamp;
                        status.error_message = message;

                        break;

                    case "warning":
                        status.warnings = 1;

                        status.warning_timestamp = timestamp;
                        status.warning_message = message;

                        break;

                    default:
                        status.timestamp = timestamp;
                        break;
                }

                list.push({expanded: true, name: table["name_" + j], host: server.host, timezone: server.timezone,
                    status: status, version: {file: table.file, value: table["version_" + j]}});
            }
        }
        else
        {
            list.push({name: server.alias || parent.name, host: parent.host, timezone: parent.timezone,
                status: server.status, version: server.version});
        }
    }

    return list;
}

function serverDetails(server)
{
    var offset = isNaN(server.timezone) ? 0 :
        ((new Date()).getTimezoneOffsetDST() + parseInt(server.timezone)) * 60 * 1000;

    var error = false; var warning = false;

    var time = ""; var file = ""; var message = "";

    if (server.status)
    {
        var status = server.status;

        if (status.value)
            status = status.value;

        file = status.file;

        if (parseInt(status.errors))
        {
            error = true;

            time = parseInt(status.error_timestamp) - offset;

            message = status.error_message;
        }
        else if (parseInt(status.warnings))
        {
            warning = true;

            time = parseInt(status.warning_timestamp) - offset;

            message = status.warning_message;
        }
        else
            time = parseInt(status.timestamp) - offset;
    }
    else
        error = true;

    if (time) {
        time = moment(time).format("ddd MMM Do, H:mm");
    }
    else
        time = "";
    
    var version = "";

    if (server.version)
    {
        if (typeof server.version.value === "object")
        {
            if (server.version.value && server.version.value.value)
                version = server.version.value.value;
        }
        else
            version = server.version.value;
    }

    return {name: server.name, host: server.host, file: file, error: error, warning: warning,
        time: time, offset: offset, version: version, message: message};
}

function expandDependencies(server)
{
    var dependencies = server.dependencies;

    if (!dependencies || !dependencies.length)
        return [];

    dependencies = expandServers(server, dependencies).filter(function (server) { return server.status || server.version; })
        .map(function (server, index) { return {index: index, server: server}; }).sort(function (a, b)
    {
        a = a.server;
        b = b.server;

        if (a.status && b.status)
        {
            var countA = parseInt(a.status.errors);
            var countB = parseInt(b.status.errors);

            if ((countA || countB) && !(countA && countB))
                return countA ? -1 : 1;

            countA = parseInt(a.status.warnings);
            countB = parseInt(b.status.warnings);

            if ((countA || countB) && !(countA && countB))
                return countA ? -1 : 1;
        }
        else if (a.status || b.status)
            return a.status ? 1 : -1;

        if (a.expanded && b.expanded)
        {
            if (a.host !== b.host)
                return (a.host > b.host) - (a.host < b.host);
        }

        return (a.name > b.name) - (a.name < b.name);
    });

    return dependencies.map(function (server) {
        return {index: server.index, server: serverDetails(server.server)};
    });
}

var Widget = React.createClass(
{
    propTypes:
    {
        server: React.PropTypes.object.isRequired,
        active: React.PropTypes.bool,

        onChange: React.PropTypes.func.isRequired
    },

    getDefaultProps: function ()
    {
        return {active: false};
    },

    getInitialState: function ()
    {
        return {dependency: -1};
    },

    dependencyHandler: function (dependency)
    {
        this.setState({dependency: this.state.dependency === dependency ? -1 : dependency});
    },

    renderDependency: function (server)
    {
        var index = server.index; server = server.server;

        var style = "alert-success";

        if (server.error) {
            style = "alert-danger";
        }
        else if (server.warning) {
            style = "alert-warning";
        }

        if (index === this.state.dependency)
            style += " active";

        return <li key={index} className={style} onClick={this.dependencyHandler.bind(this, index)}>{server.name}</li>;
    },

    renderDependencies: function (dependencies)
    {
        if (!this.props.active || !dependencies.length)
            return <div />;

        return (
            <div>
                <ul>{dependencies.map(this.renderDependency)}</ul>

                <div className="clearfix" />
            </div>
        );
    },

    render: function ()
    {        
        var server = serverDetails(this.props.server);

        var alert = "alert alert-";

        if (server.error) {
            alert += "danger";
        }
        else if (server.warning) {
            alert += "warning";
        }
        else
            alert += "success";

        if (this.props.active)
            alert += " active";

        var offset = Math.floor(server.offset / (60 * 60 * 1000));

        if (offset) {
            offset = (offset > 0 ? "+ " : "- ") + Math.abs(offset);
        }
        else
            offset = "";

        var style = {};

        var message = server.message; var version = server.version; var time = server.time; var link = server.host + server.file;

        var dependencies = expandDependencies(this.props.server);

        if (dependencies.length && this.state.dependency !== -1)
        {
            var i;

            for (i = 0; i < dependencies.length; i ++)
            {
                if (dependencies[i].index === this.state.dependency)
                    break;
            }

            if (i < dependencies.length)
            {
                var dependency = dependencies[i].server;

                message = dependency.message; version = dependency.version; time = dependency.time;

                link = (dependency.host || server.host) + dependency.file;
            }
        }

        if ((message && (server.error || server.warning)) || dependencies.length)
        {
            var glyph = "glyphicon glyphicon-chevron-" +
                (this.props.active ? "down" : "up") + " link";

            offset = <span>{offset}  <i className={glyph} onClick={this.props.onChange} /></span>;

            if (message && this.props.active)
            {
                message = (
                    <code>
                        <a href={link} target="_blank">
                            <i className="glyphicon glyphicon-share-alt" />
                        </a>

                        {message}
                    </code>
                );

                style.top = "5px";
            }
            else
            {
                message = <span />;

                if (this.props.active && dependencies.length)
                    style.top = "5px";
            }
        }
        else
            message = <span />;

        var status = "";

        if (!this.props.active && !server.error && !server.warning && dependencies.length)
        {
            var errors = 0; var warnings = 0;

            dependencies.forEach(function (dependency)
            {
                if (dependency.server.error)
                    errors ++;

                if (dependency.server.warning)
                    warnings ++;
            });

            if (errors || warnings)
            {
                status = "status ";

                if (errors) {
                    status += "status-danger";
                }
                else
                    status += "status-warning";
            }
        }

        return (
            <div key={server.name} className={alert} role="alert">
                <strong className={status}>{server.name}</strong>

                <span className="timezone">{offset}</span>

                <div>
                    <a href={server.host} target="_blank">{server.host}</a>
                </div>

                {this.renderDependencies(dependencies)}

                {message}

                <small className="pull-left" style={style}>{version}</small>
                <small className="pull-right" style={style}>{time}</small>
            </div>
        );
    }
});

module.exports = Widget;