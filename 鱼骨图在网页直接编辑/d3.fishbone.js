/*
 The MIT License (MIT)

 Copyright (c) 2014 Nicholas Bollweg <nick.bollweg@gmail.com>

 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:

 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.

 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 */
;

(function (d3) {

    "use strict";

    d3.fishbone = function (srcSize, fnSrcData, fnFeedback, onDblClickBranch, onClickBranch) {

        // private variables
        var _margin = 50;

        // the data...
        var _nodes;
        var _links;

        // d3 selections and related things used in tick function
        var nods;
        var lnks;
        var _root;
        var _arrowId = function (d) {
            return "arrow";
        };

        var _feedback = function (k) {
            return fnFeedback().filter(function (r) {
                return r.k === k;
            });
        };

        // the children accessor
        var _children = function (d) {
            return fnSrcData().filter(function (row) {
                return row.path === (d.path + '/' + d.k);
            });
        };

        // the label accessor
        var _label = function (d) {
            return d.name;
        };

        // a custom tick accessor
        var _perNodeTick = function (d) {};

        // arbitrary "nice" values
        var _linkScale = d3.scale.log().domain([1, 5]).range([60, 30]);

        // the main workhorse of the layout engine
        var _force = d3
            .layout
            .force()
            .gravity(0)
            .size([srcSize.width, srcSize.height])
            .linkDistance(_linkDistance)
            .chargeDistance([10])
            .on('tick', _tick);

        var fb1 = function (root) {

            _links = [];
            _nodes = [];

            // populate the nodes and the links globals as a side effect
            _build_nodes(fnSrcData().sort(function (a, b) {
                return a.path.split('/').length - b.path.split('/').length
            })[0]);

            // set the nodes and the links of the force
            _force
                .nodes(_nodes)
                .links(_links);

            // create the links
            lnks = root
                .selectAll('.link')
                .data(_links);
            lnks.exit()
                .remove();
            lnks.enter()
                .append('line');
            lnks.attr({
                    "class": function (d) {
                        var r = d.source.tail ? (-1) : (d.source.rate || (+1));
                        var c = (r > 0) ? 'positive' : 'negative';
                        return "link link-" + d.depth + ' link-' + c;
                    },
                    "marker-end": function (d) {
                        return d.arrow ? "url(#" + _arrowId(d) + ")" : null;
                    }
                });

            // establish the node selection
            nods = root
                .selectAll('.node')
                .data(_nodes);
            nods.exit()
                .remove();
            nods.enter()
                .append('g')
                .attr({
                    "class": function (d) {
                        return 'node' + (d.root ? ' root' : '');
                    }
                })
                .call(function () {
                    this.append('text')
                        .attr({
                            "class": function (d) {
                                return 'label-' + d.depth;
                            },
                            "text-anchor": function (d) {
                                return !d.depth ? 'start' : d.horizontal ? 'end' : 'middle';
                            },
                            dy: function (d) {
                                return d.horizontal ? '.35em' : d.region === 1 ? '1em' : '-.2em';
                            },
                            dx: function (d) {
                                return !d.depth ? '0' : '-0.5em';
                            }
                        })
                        .text(_label)
                        .on('click', onClickBranch)
                        .on('dblclick', onDblClickBranch);

                    this.append('rect')
                        .attr({
                            'class': 'positive',
                            height: function (d) {
                                return (d.hasOwnProperty('name')) ? 2 : 0;
                            },
                            width: function (d) {
                                return (_feedback(d.k)
                                    .filter(function (row) {
                                        return row.rate > 0;
                                    })
                                    .length);
                            },
                            x: 0,
                            y: -2
                        });

                    this.append('rect')
                        .attr({
                            'class': 'negative',
                            height: function (d) {
                                return (d.hasOwnProperty('name')) ? 2 : 0;
                            },
                            width: function (d) {
                                return (_feedback(d.k)
                                    .filter(function (row) {
                                        return row.rate < 0;
                                    })
                                    .length);
                            },
                            x: function (d) {
                                return (-1) * (_feedback(d.k)
                                    .filter(function (row) {
                                        return row.rate < 0;
                                    })
                                    .length);
                            },
                            y: -2
                        });
                });

            // select this so we know its width in tick
            _root = root.select('.root').node();
        }; // fb1


        function _arrow(root) {
            // creates an svg:defs and marker with an arrow if needed...
            // really just an example, as they aren't very flexible
            var defs = root
                .selectAll("defs")
                .data([1]);

            defs.enter()
                .append("defs");

            // create the arrows
            defs.selectAll("marker#" + _arrowId())
                .data([1])
                .enter()
                .append("marker")
                .attr({
                    id: _arrowId(),
                    viewBox: "0 -5 10 10",
                    refX: 10,
                    refY: 0,
                    markerWidth: 10,
                    markerHeight: 10,
                    orient: "auto"
                })
                .append("path")
                .attr({d: "M0,-5L10,0L0,5"});
        }

        function _build_nodes(node) {

            _nodes.push(node);

            var cx = 0;

            var between = [node, node.connector];
            var nodeLinks = [
                {
                    source: node,
                    target: node.connector,
                    arrow: true,
                    depth: node.depth || 0
                }
            ];
            var prev;
            var childLinkCount;

            if (!node.parent) {
                _nodes.push(prev = {tail: true});
                between = [prev, node];
                nodeLinks[0].source = prev;
                nodeLinks[0].target = node;
                node.horizontal = true;
                node.vertical = false;
                node.depth = 0;
                node.root = true;
                node.totalLinks = []
            } else {
                node.connector.maxChildIdx = 0;
                node.connector.totalLinks = [];
            }

            node.linkCount = 1;

            (_children(node) || []).forEach(function (child, idx) {
                child.parent = node;
                child.depth = (node.depth || 0) + 1;
                child.childIdx = idx;
                child.region = node.region ? node.region : (idx & 1 ? 1 : -1);
                child.horizontal = !node.horizontal;
                child.vertical = !node.vertical;

                if (node.root && prev && !prev.tail) {
                    _nodes.push(child.connector = {
                        between: between,
                        childIdx: prev.childIdx
                    });
                    prev = null;
                } else {
                    _nodes.push(prev = child.connector = {between: between, childIdx: cx++});
                }

                nodeLinks.push({
                    source: child,
                    target: child.connector,
                    depth: child.depth
                });

                // recurse capturing number of links created
                childLinkCount = _build_nodes(child);
                node.linkCount += childLinkCount;
                between[1].totalLinks.push(childLinkCount);
            });

            between[1].maxChildIdx = cx;

            Array.prototype.unshift.apply(_links, nodeLinks);

            // the number of links created by this node and its children...
            // TODO: use `linkCount` and/instead of `childIdx` for spacing
            return node.linkCount;
        }


        function _linePosition($) {
            $.attr({
                x1: function (d) {
                    return d.source.x;
                },
                y1: function (d) {
                    return d.source.y;
                },
                x2: function (d) {
                    return d.target.x;
                },
                y2: function (d) {
                    return d.target.y;
                }
            })
        }


        function _nodePosition(root) {
            // uses an SVG `transform` to position nodes
            root.attr('transform', function (d) {
                return 'translate(' + d.x + ',' + d.y + ')';
            });
        }


        function _linkDistance(d) {
            // make longer links for nodes with more children, or of lower depth
            return (d.target.maxChildIdx + 1) * _linkScale(d.depth + 1);
        }


        function _tick(e) {
            /*
             the primary layout mechanism: a fair amount of the work is done
             by links, but override a lot of it here.

             TODO: enable tweaks to these individual rules
            */

            // this is a "little bit"
            var k = 6 * e.alpha;
            var size = _force.size();
            var width = size[0];
            var height = size[1];
            var a;
            var b;

            _nodes.forEach(function (d) {
                // handle the middle... could probably store the root width...
                if (d.root) {
                    d.x = width - (_margin + _root.getBBox().width);
                }
                if (d.tail) {
                    d.x = _margin;
                    d.y = height / 2;
                }

                // put the first-generation items at the top and bottom
                if (d.depth === 1) {
                    d.y = d.region === -1 ? _margin : (height - _margin);
                    d.x -= 10 * k;
                }

                // vertically-oriented tend towards the top and bottom of the page
                if (d.vertical) {
                    d.y += k * d.region;
                }

                // everything tends to the left
                if (d.depth) {
                    d.x -= k;
                }

                // position synthetic nodes at evently-spaced intervals...
                // TODO: do something based on the calculated size of each branch
                // since we don't have individual links anymore
                if (d.between) {
                    a = d.between[0];
                    b = d.between[1];

                    d.x = b.x - (1 + d.childIdx) * (b.x - a.x) / (b.maxChildIdx + 1);
                    d.y = b.y - (1 + d.childIdx) * (b.y - a.y) / (b.maxChildIdx + 1);
                }

                _perNodeTick(d);
            });

            // actually apply all changes
            nods.call(_nodePosition);
            lnks.call(_linePosition);
        }

        // the d3.fishbone() public API
        // read-only
        fb1.links = function () {
            return _links;
        };
        fb1.nodes = function () {
            return _nodes;
        };
        fb1.force = function () {
            return _force;
        };

        // callable
        fb1.defaultArrow = _arrow;

        // d3-style chainable
        fb1.margin = function (_) {
            // how big is the whitespace around the diagram?
            if (!arguments.length) {
                return _margin;
            }
            _margin = _;
        };

        fb1.children = function (_) {
            // how  will children be sought from each node?
            if (!arguments.length) {
                return _children;
            }
            _children = _;
        };

        fb1.label = function (_) {
            // how will a label be sought from each node?
            if (!arguments.length) {
                return _label;
            }
            _label = _;
        };

        fb1.perNodeTick = function (_) {
            // what custom rules should be done per node?
            if (!arguments.length) {
                return _perNodeTick;
            }
            _perNodeTick = _;
        };

        return fb1;
    };

}).call(this, d3);