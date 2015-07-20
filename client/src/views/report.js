/** @jsx React.DOM */

/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var moment = require("moment");

var React = require("flux-react");

var ReportStore = require("../stores/report.js");

function truncate(text, limit)
{
    if (limit > 3 && text.length > limit)
        return text.slice(0, limit - 3) + "...";

    return text;
}

var Report = React.createClass(
{
    stores: [ReportStore],

    propTypes:
    {
        token: React.PropTypes.string.isRequired,
        start: React.PropTypes.string
    },

    storesDidUpdate: function ()
    {
        var report = ReportStore.getReport(this.props.token);

        document.title = "LogCroc - " + (report && report.name ? report.name : "Crocs like Logs");

        this.setState({name: report.name, servers: report.servers});
    },

    componentDidMount: function ()
    {
        React.dispatch({type: ReportStore.REPORT, token: this.props.token, start: this.props.start});
    },

    renderEmpty: function ()
    {
        if (!this.state || (this.state.servers && this.state.servers.length))
            return <div />;

        return (
            <div className="container-fluid">
                <div className="row">
                    <h1>EMPTY</h1>
                </div>
            </div>
        );
    },

    renderTable: function ()
    {
        if (!this.state || !this.state.servers || !this.state.servers.length)
            return <div />;

        var rows = this.state.servers.map(function (server, index)
        {
            return (
                <tr key={index}>
                    <td>{truncate(server.name, 30)}</td>
                    <td>{server.host}</td>
                    <td>{server.hasOwnProperty("errors")   ? server.errors   : ""}</td>
                    <td>{server.hasOwnProperty("warnings") ? server.warnings : ""}</td>
                    <td>{server.hasOwnProperty("version")  ? server.version  : ""}</td>
                </tr>
            );
        });

        return (
            <div className="container-fluid">
                <div className="row">
                    <div className="col-md-10 col-md-offset-1">
                        <div className="well well-lg">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Address</th>
                                        <th>Errors</th>
                                        <th>Warnings</th>
                                        <th>Version</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {rows}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    },

    renderList: function ()
    {
        if (!this.state || !this.state.servers || !this.state.servers.length)
            return <div />;

        var rows = [];

        this.state.servers.forEach(function (server, index)
        {
            var messages = [];

            ["error", "warning"].forEach(function (type)
            {
                var event = server[type];

                if (event)
                {
                    messages.push(
                        <blockquote key={type}>
                            <cite>{event.occurrences + " " + type.toUpperCase() + "S" + (event.version ? ", " + event.version : "")}</cite>

                            {event.message}
                        </blockquote>
                    );
                }
            });

            if (messages.length)
            {
                rows.push(
                    <div key={index} className="row">
                        <div className="col-md-10 col-md-offset-1">
                            <div className="well well-lg">
                                <h3>{server.name}</h3>

                                <hr />

                                {messages}
                            </div>
                        </div>
                    </div>
                );
            }
        });

        return <div className="container-fluid">{rows}</div>;
    },

    render: function()
    {
        var name = "";
        var time = "";

        if (this.state)
        {
            name = this.state.name;

            if (this.state.servers && this.state.servers.length)
            {
                if (this.props.start) {
                    time = moment(this.props.start).format("dddd, MMMM Do YYYY");
                }
                else
                    time = moment().startOf("hour").format("dddd, MMMM Do YYYY, h:mm:ss a");
            }
        }

        return (
            <section className="report-view">
                <header>
                    <nav className="navbar navbar-default navbar-static-top" role="navigation">
                        <div className="container-fluid">
                            <div className="navbar-header">
                                <a className="navbar-brand" href="/">{name}</a>
                            </div>

                            <p className="navbar-text navbar-right">{time}</p>
                        </div>
                    </nav>
                </header>

                <article>
                    {this.renderEmpty()}
                    {this.renderTable()}
                    {this.renderList()}
                </article>

                <footer>
                    <nav className="navbar navbar-default navbar-static-bottom" role="navigation">
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

module.exports = Report;