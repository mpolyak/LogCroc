/** @jsx React.DOM */

/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

var d3 = require("d3");

var React = require("react");

var Graph = require("../../components/graph.js");

var Report = React.createClass(
{
    propTypes:
    {
        days: React.PropTypes.arrayOf(React.PropTypes.object).isRequired
    },

    getInitialState: function ()
    {
        var allErrors = 0; var allWarnings = 0;

        var days = this.props.days.map(function (day)
        {
            var errors = 0; var warnings = 0;

            day.servers.forEach(function (server)
            {
                errors += server.errors;
                warnings += server.warnings;
            });

            allErrors += errors; allWarnings += warnings;

            return {timestamp: day.timestamp, errors: errors, warnings: warnings};
        }).sort(function (a, b) {
            return (a.timestamp > b.timestamp) - (a.timestamp < b.timestamp);
        });

        return {width: 0, height: 150, days: days, errors: allErrors, warnings: allWarnings};
    },

    resizeHandler: function ()
    {
        var node = this.refs.plot.getDOMNode();

        this.setState({width: node.offsetWidth, height: this.state.height,
            days: this.state.days, errors: this.state.errors, warnings: this.state.warnings});
    },

    componentDidMount: function ()
    {
        window.addEventListener("resize", this.resizeHandler);

        this.resizeHandler();
    },

    componentWillUnmount: function ()
    {
        window.removeEventListener("resize", this.resizeHandler);
    },

    updateHandler: function (graph)
    {
        var svg = d3.select(graph); svg.selectAll("*").remove();

        var width = this.state.width; var height = this.state.height; var days = this.state.days;

        var offset = Math.max((Math.log(days.reduce(function (max, day) {
            return Math.max(max, day.errors, day.warnings); }, 0)) / Math.log(10)) * 10, 5);

        var x = d3.time.scale()
            .domain(d3.extent(days, function (d) { return d.timestamp; }))
            .range([Math.max(30, offset + 20), width - 30]);

        var y = d3.scale.linear()
            .domain([0, d3.max(days, function (d) { return Math.max(d.errors, d.warnings); })])
            .range([height - 30, 10]);

        var xAxis = d3.svg.axis()
            .ticks(d3.time.day, 1)
            .innerTickSize(0)
            .outerTickSize(0)
            .tickPadding(8)
            .scale(x)
            .orient("bottom");

        var yAxis = d3.svg.axis()
            .ticks(days.length)
            .tickFormat(d3.format("d"))
            .innerTickSize(-width)
            .outerTickSize(0)
            .tickPadding(5)
            .scale(y)
            .orient("left");

        var errors = d3.svg.line()
            .interpolate("monotone")
            .x(function (d) { return x(d.timestamp); })
            .y(function (d) { return y(d.errors); });

        var warnings = d3.svg.line()
            .interpolate("monotone")
            .x(function (d) { return x(d.timestamp); })
            .y(function (d) { return y(d.warnings); });

        svg.append("g")
            .attr("class", "x axis")
            .attr("transform", "translate(0," + (height - 20) + ")")
            .call(xAxis);

        svg.append("g")
            .attr("class", "y axis")
            .attr("transform", "translate(" + (offset + 10) + ", 0)")
            .call(yAxis);

        svg.append("g").append("path")
            .attr("class", "line warning")
            .attr("d", warnings(days));

        svg.append("g").append("path")
            .attr("class", "line error")
            .attr("d", errors(days));

        svg.append("g").selectAll("circle warning")
            .data(days)
            .enter().append("circle")
            .attr("class", "warning")
            .attr("r", 5)
            .attr("cx", function (d) { return x(d.timestamp); })
            .attr("cy", function (d) { return y(d.warnings); });

        svg.append("g").selectAll("circle error")
            .data(days)
            .enter().append("circle")
            .attr("class", "error")
            .attr("r", 5)
            .attr("cx", function (d) { return x(d.timestamp); })
            .attr("cy", function (d) { return y(d.errors); });
    },

    render: function ()
    {
        return (
            <div className="panel panel-default">
                <div className="panel-heading">
                    <span className="panel-title">{this.props.days.length} DAYS</span>

                    <ul>
                        <li><span className="label label-danger">{this.state.errors} ERRORS</span></li>
                        <li><span className="label label-warning">{this.state.warnings} WARNINGS</span></li>
                    </ul>
                </div>
            
                <div ref="plot" className="panel-body">
                    <Graph width={this.state.width} height={this.state.height} onUpdate={this.updateHandler} />
                </div>
            </div>
        );
    }
});

module.exports = Report;