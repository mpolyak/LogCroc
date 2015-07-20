/** @jsx React.DOM */

/*
 * Copyright (c) Michael Polyak. All rights reserved.
 */

"use strict";

var React = require("react");

var Graph = React.createClass(
{
    propTypes:
    {
        width: React.PropTypes.number.isRequired,
        height: React.PropTypes.number.isRequired,

        onUpdate: React.PropTypes.func.isRequired
    },

    update: function (props)
    {
        var graph = this.getDOMNode();

        graph.setAttribute("width", props.width);
        graph.setAttribute("height", props.height);

        props.onUpdate(graph);
    },

    componentDidMount: function ()
    {
        this.update(this.props);
    },

    shouldComponentUpdate: function (props)
    {
        this.update(props);

        return false;
    },

    render: function ()
    {
        return <svg width={this.props.width} height={this.props.height} />;
    }
});

module.exports = Graph;