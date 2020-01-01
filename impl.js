const CHARGE_STRENGTH = -25;
const NODE_RADIUS = 20;
const LINK_DISTANCE = 100;
const SIMULATION_ALPHA = 1;

// Instantiate svg element.
const LINK_ELEMENT_ID = 'link';
const NODE_ELEMENT_ID = 'node';
var svg = d3.select('body')
    .append('svg')
    .attr('width', window.innerWidth)
    .attr('height', window.innerHeight)
    .append('g');  // somehow this makes the zoom work better.
var node_elements = svg.selectAll(`.${NODE_ELEMENT_ID}`);
var link_elements = svg.selectAll(`.${LINK_ELEMENT_ID}`);

// Add zoom.
d3.select('body')
    .call(d3.zoom()
        .on('zoom', function () { svg.attr('transform', d3.event.transform); })
    );

// This is the root node of the graph.
// Populated directly by reading the graph json file.
// TODO: consider formatting the graph as array of nodes + array of links, instead of a tree.
var root_node;
var nodes;
var links = [];
var simulation = d3.forceSimulation();
var node_map = {};

d3.json('nodes.json').then(function(data) {
    let index = 0;
    nodes = data.map(n => {
        n.show = true;
        n.index = index++;
        return n;
    });
    nodes.map(n => node_map[n.id] = n);

    simulation.nodes(nodes)
        .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
        .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .on('tick', tick);
    update();
});

svg.append("svg:defs").append("svg:marker")
    .attr("id", "inheritance_triangle")
    .attr("refX", 6)
    .attr("refY", 6)
    .attr("markerWidth", 15)
    .attr("markerHeight", 15)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M 0 0 12 6 0 12 3 6")
    .style("fill", "green");

d3.json('parent_links.json').then(function(data) {
    links = links.concat(data.map(link => {
        link.source = node_map[link.parent].index;
        link.target = node_map[link.child].index;
        return link;
    }));
    simulation
        .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
        .force('link', d3.forceLink(links).distance(LINK_DISTANCE))
        .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .on('tick', tick);

    link_elements = link_elements.data(links, function(d) {
        return d.target;
    });
    link_elements.exit().remove();

    link_elements.enter()
        .append('line')
        .attr('color', 'green')
        .attr('marker-end', 'url(#inheritance_triangle)')
        .style('stroke-width', 2)
        .attr('class', LINK_ELEMENT_ID);

    // must update selection after changes.
    link_elements = svg.selectAll(`.${LINK_ELEMENT_ID}`);

    update();
});

svg.append("svg:defs").append("svg:marker")
    .attr("id", "shared_ptr_triangle")
    .attr("refX", 6)
    .attr("refY", 6)
    .attr("markerWidth", 15)
    .attr("markerHeight", 15)
    .attr("orient", "auto")
    .attr("stroke-width", 2)
    .append("path")
    .attr("d", "M 0 0 12 6 0 12 3 6")
    .style("stroke", "black")
    .style("stroke-width", 1)
    .style("fill", "none");

d3.json('shared_ptr_links.json').then(function(data) {
    links = links.concat(data.map(link => {
        link.source = node_map[link.owner].index;
        link.target = node_map[link.target].index;
        return link;
    }));
    simulation
        .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
        .force('link', d3.forceLink(links).distance(LINK_DISTANCE))
        .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .on('tick', tick);

    link_elements = link_elements.data(links, function(d) {
        return d.target;
    });
    link_elements.exit(); // .remove();

    link_elements.enter()
        .append('line')
        .attr('color', 'black')
        .attr('marker-end', 'url(#shared_ptr_triangle)')
        .style('stroke-width', 2)
        .attr('class', LINK_ELEMENT_ID);

    // must update selection after changes.
    link_elements = svg.selectAll(`.${LINK_ELEMENT_ID}`);

    update();
});

// Read the graph, and initialize globals.
d3.json('graph.json').then(function(data) {
    return;
    root_node = data;
    var hierarchy = d3.hierarchy(root_node);
    var tree = d3.tree();
    var th = tree(hierarchy);
    nodes = th.descendants();
    nodes = nodes.map(n => {
        n.show = true;
        return n;
    });
    nodes.map(n => node_map[n.data.name] = n);

    links.concat(th.links(nodes));

    //simulation = d3.forceSimulation(nodes)
    simulation.nodes(nodes)
        .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
        .force('link', d3.forceLink(links).distance(LINK_DISTANCE))
        .force('center', d3.forceCenter(window.innerWidth / 2, window.innerHeight / 2))
        .on('tick', tick);
    update();
});

function update() {
    // Update nodes.
    // the key function makes one pass through data members of each node_element,
    // then makes one pass over nodes. Matching values determine pairing of an
    // element from nodes to an element from node_elements.
    display_nodes = nodes.filter(n => {
        return n.show;
    });
    node_elements = node_elements.data(display_nodes, function(d) { return d.id; });
    node_elements.exit().remove();

    var nodeEnter = node_elements.enter()
        .append('g')
        .attr('class', NODE_ELEMENT_ID)
        .call(drag_action())
        .on('click', click);

    nodeEnter
        .append('circle')
        .style('fill', color)
        .attr('r', function(d) { return NODE_RADIUS; })
    nodeEnter
        .append('text')
        .text(function(d) { return d.id; });

    // must update selection after changes.
    node_elements = svg.selectAll(`.${NODE_ELEMENT_ID}`);

    simulation.alpha(SIMULATION_ALPHA).restart();
}

function tick() {
    const TIP_OFFSET = 8;
    link_elements
        .attr('x1', function(d) {
            let dx = d.target.x - d.source.x;
            let dy = d.target.y - d.source.y;
            let mag = (dx ** 2 + dy ** 2) ** 0.5;
            return d.source.x + dx / mag * NODE_RADIUS;
        })
        .attr('y1', function(d) {
            let dx = d.target.x - d.source.x;
            let dy = d.target.y - d.source.y;
            let mag = (dx ** 2 + dy ** 2) ** 0.5;
            return d.source.y + dy / mag * NODE_RADIUS;
        })
        .attr('x2', function(d) {
            let dx = d.target.x - d.source.x;
            let dy = d.target.y - d.source.y;
            let mag = (dx ** 2 + dy ** 2) ** 0.5;
            return d.target.x - dx / mag * (NODE_RADIUS + TIP_OFFSET);
        })
        .attr('y2', function(d) {
            let dx = d.target.x - d.source.x;
            let dy = d.target.y - d.source.y;
            let mag = (dx ** 2 + dy ** 2) ** 0.5;
            return d.target.y - dy / mag * (NODE_RADIUS + TIP_OFFSET);
        });
    node_elements.attr('transform', function(d) { return 'translate(' + d.x + ',' + d.y + ')'; });
}

function color(d) {
    if (!d.parent) {
        return '#00ff00';  // root node
    }
    if (!d.children) {
        return '#fd8d3c';  // leaf node
    }
    if (all_children_hidden(d)) {
        return '#3182bd';  // collapsed package
    }
    return '#c6dbef';  // expanded package
}

function set_all(node, show_value) {
    node.show = show_value;
    if (node.children) { node.children.map(c => set_all(c, show_value)); }
}
function hide_all(node) { set_all(node, false); }

function all_children_hidden(node) {
    return node.children.every(n => !n.show);
}

// Toggle children on click.
function click(d) {
    if (d3.event.defaultPrevented) {
        return; // ignore clicks for dragging.
    }
    if (d.children) {
        if (all_children_hidden(d)) {
            d.children.map(c => c.show = true);
        } else {
            d.children.map(c => hide_all(c));
        }
    }
    update();
}

function drag_action() {
    function dragstarted(d) {
        d3.select(this).raise().attr('stroke', 'black');
    }
    function dragged(d) {
        d3.select(this).attr('cx', d.x = d3.event.x).attr('cy', d.y = d3.event.y);
    }
    function dragended(d) {
        d3.select(this).attr('stroke', null);
        simulation.alpha(SIMULATION_ALPHA).restart();
    }
    return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
}
