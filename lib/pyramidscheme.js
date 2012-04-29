var Scheme = require('./scheme');
var ScanlineScheme = require('./scanlinescheme');
var Tile = require('./tile').Tile;
var Metatile = require('./tile').Metatile;
var unserializeTiles = require('./tile').unserialize;
var Statistics = require('./statistics');

module.exports = PyramidScheme;
require('util').inherits(PyramidScheme, ScanlineScheme);
function PyramidScheme(options) {
    ScanlineScheme.call(this, options);
    this.type = 'pyramid';
    this.stack = [];

    // Using ScanlineScheme to iterate over the topmost zoom level.
    // The PyramidScheme internally checks maxdepth when it wants to descent.
    this.maxdepth = this.maxzoom;
    this.maxzoom = this.minzoom;
}

PyramidScheme.unserialize = function(state) {
    var scheme = Object.create(PyramidScheme.prototype);
    for (var key in state) scheme[key] = state[key];
    scheme.stack = unserializeTiles(state.stack);
    scheme.stats = Statistics.unserialize(state.stats);
    scheme.initialize();
    return scheme;
};

PyramidScheme.prototype.toJSON = function() {
    // Move pending items back to the stack, deduplicating metatiles along the way.
    // We need to do this on serialization because otherwise it becomes a hassle
    // to deduplicate this.
    var stack = [];
    var pending = [];
    for (var i = 0; i < this.pending.length; i++) {
        var tile = this.pending[i];
        if ('metatile' in tile) {
            var index = pending.indexOf(tile.metatile);
            if (index < 0) {
                pending[index = pending.length] = tile.metatile;
                // Create a *copy* of the metatile so we don't modify the original
                // one below.
                stack[index] = pending[index].toJSON();
            }
            // We're removing members from this metatile when we add it to pending.
            stack[index].members.push(tile);
        } else {
            pending.push(tile);
        }
    }

    return {
        type: this.type,
        concurrency: this.concurrency,
        minzoom: this.minzoom,
        maxzoom: this.maxzoom,
        maxdepth: this.maxdepth,
        metatile: this.metatile,
        bounds: this.bounds,
        stats: this.stats,
        pos: this.pos,
        stack: this.stack.concat(stack),
        box: [],
        finished: this.finished,
        pending: [],
        paused: true
    };
};

PyramidScheme.prototype.next = function() {
    // Spawn new render fibers when the current metatile still has members we
    // haven't processed yet, even if this goes above our concurrency.
    // The idea is that a metatile render only actually renders one image for
    // all of its members.
    var formats = (this.task.formats && this.task.formats.length > 0) ? this.task.formats : ['tile'];
    while (!this.finished && !this.paused && (this.pending.length < this.concurrency || this.box.length)) {
        var tile;
        if (this.box.length) {
            // Current metatile isn't exhausted yet.
            tile = this.box.shift();
        } else if (this.stack.length) {
            // We still have some tiles in the pipeline.
            tile = this.stack.pop();
            if ('members' in tile) {
                // This is actually a metatile.
                tile.pending = tile.members.length;
                this.box = tile.members;
                if (!this.box.length) continue;
                tile = this.box.shift();
            }
        } else if (this.metatile > 1) {
            // Next top level metatile (uses ScanlineScheme#nextMetatile).
            tile = this.nextMetatile();
        } else {
            // Next top level tile (uses ScanlineScheme#nextTile).
            tile = this.nextTile();
        }

        // Abort iteration when we iterated through the entire top level.
        // All remaining tiles will come from the stack.
        if (tile === false) break;

        if (tile) {
            for (var key in formats) {
                this.addPending(tile);
                this.task.render(tile,formats[key]);
            }
        }
    }

    if (!this.paused && !this.finished && !this.pending.length) {
        this.finished = true;
        this.task.finished();
    }
};

PyramidScheme.prototype.addChildren = function(tile) {
    if ('metatile' in tile) {
        // Add the children of this tile to the metatile's potential children
        tile.addChildrenInBoundsTo(this.bounds[tile.z + 1], tile.metatile.children);

        if (--tile.metatile.pending === 0) {
            // Metatile is finished. Now continue with child metatiles.
            tile.metatile.addChildrenTo(this.stack);
        }
    } else {
        var children = [];
        tile.addChildrenInBoundsTo(this.bounds[tile.z + 1], children);
        for (var i = children.length - 1; i >= 0; i--) {
            this.stack.push(children[i]);
        }
    }
};

PyramidScheme.prototype.unique = function(tile) {
    this.removePending(tile);
    this.stats.unique++;
    if (tile.z < this.maxdepth) this.addChildren(tile);
    process.nextTick(this.next);
};

PyramidScheme.prototype.skip = function(tile) {
    this.removePending(tile);
    this.stats.skipped++;
    this.stats.skipped += tile.descendantCount(this.bounds);
    // Do not add the children to any kind of stack.
    if ((tile.z < this.maxdepth) && ('metatile' in tile) && (--tile.metatile.pending === 0)) {
        // Metatile is finished. Now continue with child metatiles.
        tile.metatile.addChildrenTo(this.stack);
    }
    process.nextTick(this.next);
};

PyramidScheme.prototype.duplicate = function(tile) {
    this.removePending(tile);
    this.stats.duplicate++;
    if (tile.z < this.maxdepth) this.addChildren(tile);
    process.nextTick(this.next);
};
