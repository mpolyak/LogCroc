/** @jsx React.DOM */

/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var React = require("flux-react");

var Index = React.createClass(
{
    render: function ()
    {
        return (
            <section className="index-view">
                <header>
                    <nav className="navbar navbar-default navbar-static-top" role="navigation">
                        <div className="container-fluid">
                            <div className="navbar-header">
                                <a className="navbar-brand" href="#">LogCroc</a>
                            </div>

                            <a href="https://github.com/mpolyak/LogCroc" className="navbar-brand navbar-right">
                                <img src="/img/github.png" width="24" height="24" />
                            </a>
                        </div>
                    </nav>
                </header>

                <article>
                    <div className="container-fluid">
                        <div className="row">
                            <h1>Because Crocs like Logs</h1>

                            <ul>
                                <li><img src="/img/logcroc.png" style={{marginBottom: "30px"}} /></li>
                            </ul>
                        </div>

                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>WHY</h1>

                                    <hr />

                                    <p>As the number of assets and complexity within your cloud infrastructure rises it becomes harder to stay on top of issues that impact your availability and performance.</p>
                                    <p><strong>LogCroc</strong> strives to eliminate the uncertainty of complex infrastructure and keep you ahead of the curve so you can meet your customers needs.</p>
                                </div>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>HOW</h1>

                                    <hr />

                                    <p><strong>LogCroc</strong> analyzes your servers log files determines the status of each of your assets and presents the results as a simple visual dashboard enabling you to take action in real-time.</p>
                                </div>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>WHAT</h1>

                                    <hr />

                                    <p>Gain clear visibility into the status of your cloud infrastructure with <strong>LogCroc</strong>.</p>

                                    <a className="btn btn-success" href="https://github.com/mpolyak/LogCroc">Project on GitHub</a>
                                </div>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>FAQ</h1>

                                    <hr />

                                    <p><strong>How does <em>LogCroc</em> get access to my logs?</strong></p>
                                    <p><strong>LogCroc</strong> provides pull capabilities for downloading publically accessible, or those that require authentication, log files and dynamic HTML tables. We are also working on a push agent for <strong>LogCroc</strong>.</p>

                                    <hr />

                                    <p><strong>What type of information can <em>LogCroc</em> extract from my logs?</strong></p>
                                    <p><strong>LogCroc</strong> can extract timestamps, warnings, errors and status messages as well as version information from log files or dynamic HTML tables. In addition, <strong>LogCroc</strong> can operate in heartbeat mode where it will look for periodic status indicators that signal that all is well.</p>

                                    <hr />

                                    <p><strong>How does <em>LogCroc</em> show the result of my log analysis?</strong></p>
                                    <p><strong>LogCroc</strong> provides a visual dashboard, a daily summary report and email notifications that present the status for each of your assets with warnings, errors and version information.</p>
                                </div>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-4 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>DEMO</h1>

                                    <hr />

                                    <p>Try our <strong>demo</strong> company dashboard!</p>

                                    <a className="btn btn-primary" href="/?demo">Try the Demo</a>
                                </div>
                            </div>

                            <div className="col-md-4">
                                <div className="well well-lg">
                                    <h1>META</h1>

                                    <hr />

                                    <p><strong>LogCroc</strong> is using itself, check it out!</p>

                                    <a className="btn btn-primary" href="/?meta">Check out Meta</a>
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

module.exports = Index;