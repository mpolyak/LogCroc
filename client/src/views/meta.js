/** @jsx React.DOM */

/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var React = require("flux-react");

var Meta = React.createClass(
{
    render: function ()
    {
        return (
            <section className="meta-view">
                <header>
                    <nav className="navbar navbar-default navbar-static-top" role="navigation">
                        <div className="container-fluid">
                            <div className="navbar-header">
                                <a className="navbar-brand" href="#">Meta</a>
                            </div>
                        </div>
                    </nav>
                </header>

                <article>
                    <div className="container-fluid">
                        <div className="row">
                            <h1>It's crocs all the way down.</h1>
                            <h3><strong>LogCroc</strong> is monitoring itself and keeping tabs on it's own usage and performance.</h3>
                        </div>
                    </div>

                    <div className="container-fluid">
                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>META</h1>

                                    <hr />

                                    <p><strong>LogCroc</strong> is feeding itself a sanitized version of it's own <a href="/meta/log">log file</a> for analysis, the result of which can be viewed with the following dashboard and report.</p>

                                    <ul>
                                        <li><a className="btn btn-primary" href="/?eat=meta">Dashboard</a></li>
                                        <li><a className="btn btn-primary" href="/?report=meta">Report</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>SERVER</h1>

                                    <hr />

                                    <p>Additionally, <strong>LogCroc</strong>&#39;s <a href="/meta/memwatch">memory usage</a> and <a href="/meta/cpuwatch">processor utilization</a> are monitored for tracking application responsiveness.</p>

                                    <ul>
                                        <li><a className="btn btn-primary" href="/?eat=meta-server">Dashboard</a></li>
                                        <li><a className="btn btn-primary" href="/?report=meta-server">Report</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>QUESTIONS</h1>

                                    <hr />

                                    <p>If you have any questions about <strong>LogCroc</strong> please don't hesistate to contact!</p>

                                    <a className="btn btn-success" href="mailto:logcroc@gmail.com?Subject=Questions">Send Questions</a>
                                </div>
                            </div>
                        </div>
                    </div>
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

module.exports = Meta;