/** @jsx React.DOM */

/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var moment = require("moment");

var React = require("flux-react");

var DashboardStore = require("../stores/dashboard.js");

var Widget = require("./dashboard/widget.js");
var Report = require("./dashboard/report.js");

var REFRESH_INTERVAL = 60 * 60 * 1000;

var ALERT_WIDTH = 350;

function expandServers(servers)
{
    var list = [];

    for (var i = 0; i < servers.length; i ++)
    {
        var server = servers[i];

        if (server.table)
        {
            var table = server.table;

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

                list.push({expanded: true, name: table["name_" + j], host: server.host, timezone: server.timezone, dependencies: server.dependencies,
                    status: status, version: {file: table.file, value: table["version_" + j]}});
            }
        }
        else
            list.push(server);
    }

    return list;
}

var Dashboard = React.createClass(
{
    stores: [DashboardStore],

    propTypes:
    {
        token: React.PropTypes.string.isRequired,
    },

    getInitialState: function ()
    {
        return {account: null, report: null, width: 0, widget: -1, updated: (new Date()).getTime()};
    },

    resizeHandler: function ()
    {
        var node = this.refs.view.getDOMNode();

        this.setState({account: this.state.account, report: this.state.report, widget: this.state.widget, updated: this.state.updated,
            width: node.offsetWidth});
    },

    refreshHandler: function ()
    {
        React.dispatch({type: DashboardStore.REFRESH_TOKEN, token: this.props.token});
    },

    widgetHandler: function (index)
    {
        this.setState({account: this.state.account, report: this.state.report, updated: this.state.updated, width: this.state.width,
            widget: index === this.state.widget ? -1 : index});
    },

    componentDidMount: function ()
    {
        window.addEventListener("resize", this.resizeHandler);

        this.timer = setInterval(this.refreshHandler, REFRESH_INTERVAL);

        React.dispatch({type: DashboardStore.REGISTER_TOKEN, token: this.props.token});

        this.resizeHandler();
    },

    componentWillUnmount: function ()
    {
        window.removeEventListener("resize", this.resizeHandler);

        clearInterval(this.timer);

        React.dispatch({type: DashboardStore.UNREGISTER_TOKEN, token: this.props.token});
    },

    storesDidUpdate: function ()
    {
        var account = DashboardStore.getAccount(this.props.token);

        document.title = "LogCroc - " + (account && account.name ? account.name : "Crocs like Logs");

        var widget = this.state.widget;

        if (widget !== -1 && account && account.servers.length)
        {
            var servers = expandServers(account.servers).map(
                function (server, index) { return {index: index, server: server}; });

            for (var i = 0; i < servers.length; i ++)
            {
                if (servers[i].index === widget)
                {
                    var server = servers[i].server;

                    if (server.status)
                    {
                        if (!parseInt(server.status.errors) && !parseInt(server.status.warnings) && (!server.dependencies || !server.dependencies.length))
                            widget = -1;
                    }
                    else
                        widget = -1;

                    break;
                }
            }
        }
        else
            widget = -1;

        var report = DashboardStore.getReport(this.props.token);

        this.setState({account: account, report: report, widget: widget, width: this.state.width,
            updated: (new Date()).getTime()});
    },

    renderBrand: function ()
    {
        var account = this.state.account;

        if (account && account.name)
            return <a className="navbar-brand" href="#">{account.name}</a>;

        return <a className="navbar-brand" href="#">LogCroc</a>;
    },

    renderServers: function ()
    {
        var servers = this.state.account && this.state.account.servers.length ?
            this.state.account.servers : [];

        servers = expandServers(servers).map(function (server, index) { return {index: index, server: server}; })
            .sort(function (a, b)
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

        var cols = Math.min(Math.floor(Math.sqrt(servers.length) * (16 / 9)),
            Math.max(1, Math.floor(this.state.width / ALERT_WIDTH)));

        if (12 % cols)
            cols --;

        var rows = Math.floor(servers.length / cols);

        if (cols * rows < servers.length)
            rows ++;

        var size = "col-";

        if (this.state.width >= 1200) {
            size += "lg";
        }
        else if (this.state.width >= 992) {
            size += "md";
        }
        else if (this.state.width >= 768) {
            size += "sm";
        }
        else
            size += "xs";

        size += "-"; var col = Math.floor(12 / cols);

        var list = [];

        for (var i = 0; i < rows; i ++)
        {
            if (i * cols >= servers.length)
                break;

            var row = []; var indices = [];

            for (var j = 0; j < cols; j ++)
            {
                var index = (i * cols) + j;

                if (index >= servers.length)
                    break;

                var widget = (
                    <div className={size + (servers[index].index === this.state.widget ? 12 : col)} key={servers[index].index}>
                        <Widget server={servers[index].server} active={servers[index].index === this.state.widget}
                            onChange={this.widgetHandler.bind(this, servers[index].index)} />
                    </div>
                );

                if (servers[index].index === this.state.widget)
                {
                    list.push(<div className="row" key={servers[index].index + "_active"}>{widget}</div>);

                    row.push(
                        <div className={size + col} key={servers[index].index}>
                            <div />
                        </div>
                    );
                }
                else
                    row.push(widget);

                indices.push(servers[index].index);
            }

            if (row.length)
                list.push(<div className="row" key={indices.join("")}>{row}</div>);
        }

        return (
            <div className="container-fluid">
                {list}
            </div>
        );
    },

    renderReport: function ()
    {
        var report = this.state.report;

        if (!report || !report.days || !report.days.length)
            return <div />;

        return (
            <div className="container-fluid">
                <div className="row">
                    <div className="col-xs-12">
                        <Report days={report.days} />
                    </div>
                </div>
            </div>
        );
    },

    render: function ()
    {
        return (
            <section ref="view" className="dashboard-view">
                <header>
                    <nav className="navbar navbar-inverse navbar-static-top" role="navigation">
                        <div className="container-fluid">
                            <div className="navbar-header">
                                {this.renderBrand()}
                            </div>

                            <p className="navbar-text navbar-right">
                                {moment(this.state.updated).format("ddd MMM Do, H:mm")}
                            </p>
                        </div>
                    </nav>
                </header>

                <article>
                    {this.renderServers()}
                    {this.renderReport()}
                </article>

                <footer>
                    <nav className="navbar navbar-inverse navbar-static-bottom" role="navigation">
                        <div className="container-fluid">
                            <ul className="nav navbar-nav">
                                <li><a href="mailto:logcroc@gmail.com">CONTACT</a></li>
                                <li><a href="/?demo">DEMO</a></li>
                                <li><a href="/?meta">META</a></li>
                            </ul>

                            <p className="navbar-text navbar-right">Powered by <a className="navbar-link" href="http://logcroc.com">LogCroc</a></p>
                        </div>
                    </nav>
                </footer>
            </section>
        );
    }
});

module.exports = Dashboard;