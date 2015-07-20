/** @jsx React.DOM */

/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var React = require("flux-react");

var Demo = React.createClass(
{
    render: function ()
    {
        return (
            <section className="demo-view">
                <header>
                    <nav className="navbar navbar-default navbar-static-top" role="navigation">
                        <div className="container-fluid">
                            <div className="navbar-header">
                                <a className="navbar-brand" href="#">Demo</a>
                            </div>
                        </div>
                    </nav>
                </header>

                <article>
                    <div className="container-fluid">
                        <div className="row">
                            <h1>Our Demo Company</h1>
                            <h3>A free-range organic farmer of crocodiles, supplier to petting zoos and aquariums world wide.<br />System integrator and provider of reptilian habitates, including environmental controls and life cycle management.</h3>
                        </div>
                    </div>

                    <div className="container-fluid">
                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>DASHBOARD</h1>

                                    <hr />

                                    <p>The demo company has five customers to which it has supplied one of its systems for managing a crocodile enclosure. Each system is responsible for maintaing precise environmental conditions by measuring various sensors and regulating the habitat.</p>
                                    <p>The following <strong>dashboard</strong> allows the demo company's support engineers to monitor in real-time the operation of its customer systems and promptly address any issues that may arise.</p>

                                    <a className="btn btn-primary" href="/?eat=demo">Dashboard</a>

                                    <hr />

                                    <p>A seperate <strong>dashboard</strong> is available for monitoring the individual sensors feeding each of the demo customer systems.</p>

                                    <a className="btn btn-primary" href="/?eat=demo-sensors">Sensors</a>
                                </div>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>REPORT</h1>

                                    <hr />

                                    <p>In addition to a real-time dashboard there is also a daily summary <strong>report</strong> that aggreagates all the warnings and errors throughout the day and displays a summary of the most frequest offenders.</p>

                                    <a className="btn btn-primary" href="/?report=demo">Report</a>

                                    <hr />

                                    <p>A daily summary <strong>report</strong> is also available for the individual sensors feeding into the systems.</p>

                                    <a className="btn btn-primary" href="/?report=demo-sensors">Sensors</a>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="container-fluid highlight">
                        <div className="row">
                            <h3>TECHNICAL</h3>
                        </div>
                    </div>

                    <div className="container-fluid">
                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>FILES</h1>

                                    <hr />

                                    <p>We generate a simulated daily log file for each demo customer that provides the status of various subsystems and any warnings and errors that they may create. Each of the log files is then parsed by <strong>LogCroc</strong> and the result is used to drive the dashboard and summary report.</p>

                                    <hr />

                                    <p>You can view the generated log files directly by following these links.</p>

                                    <ul>
                                        <li><a className="btn btn-primary" href="/demo/0/customer">Customer 1</a></li>
                                        <li><a className="btn btn-primary" href="/demo/1/customer">Customer 2</a></li>
                                        <li><a className="btn btn-primary" href="/demo/2/customer">Customer 3</a></li>
                                        <li><a className="btn btn-primary" href="/demo/3/customer">Customer 4</a></li>
                                        <li><a className="btn btn-primary" href="/demo/4/customer">Customer 5</a></li>
                                    </ul>
                                </div>
                            </div>
                        </div>

                        <div className="row">
                            <div className="col-md-8 col-md-offset-2">
                                <div className="well well-lg">
                                    <h1>TABLES</h1>

                                    <hr />

                                    <p>In addition to parsing standard log files, <strong>LogCroc</strong> is able to parse dynamic HTML tables and treat each table row as an individual resource as can be seen by following the links to the tables that represent the simulated sensors of each demo customer.</p>

                                    <ul>
                                        <li><a className="btn btn-primary" href="/demo/0/sensors">Sensors 1</a></li>
                                        <li><a className="btn btn-primary" href="/demo/1/sensors">Sensors 2</a></li>
                                        <li><a className="btn btn-primary" href="/demo/2/sensors">Sensors 3</a></li>
                                        <li><a className="btn btn-primary" href="/demo/3/sensors">Sensors 4</a></li>
                                        <li><a className="btn btn-primary" href="/demo/4/sensors">Sensors 5</a></li>
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

module.exports = Demo;