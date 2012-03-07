var Scheme = require('./scheme');
var Tile = require('./tile').Tile;
var Metatile = require('./tile').Metatile;
var unserializeTiles = require('./tile').unserialize;
var Statistics = require('./statistics');

module.exports = PyramidScheme;
require('util').inherits(PyramidScheme, Scheme);
function PyramidScheme(options) {
    this.type = 'pyramid';
    Scheme.validateBBoxOptions.call(this, options);

    this.stack = [];
    this.box = [];

    this.initialize();
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

PyramidScheme.prototype.nextMetatile = function() {
    if (this.pos === false) return false;

    // We are metatiling.
    // The stack is empty. Fall back to scanline for the top zoom level.
    var bounds = this.bounds[this.minzoom];
    var pos = this.pos;
    pos.x += this.metatile;
    if (pos.x > bounds.maxX) {
        pos.x = bounds.minX - (bounds.minX % this.metatile),
        pos.y += this.metatile;
    }
    if (pos.y > bounds.maxY) {
        // Top level exhausted.
        this.pos = false;
        return false;
    }

    var metatile = new Metatile(pos.z, pos.x, pos.y, this.metatile);
    // Since this is a top-level metatile, it doesn't have any members added
    // from parent metatile renders. That means we have to manually populate.
    var maxX = Math.min(bounds.maxX + 1, pos.x + this.metatile);
    var maxY = Math.min(bounds.maxY + 1, pos.y + this.metatile);
    var minX = Math.max(bounds.minX, pos.x);
    var minY = Math.max(bounds.minY, pos.y);
    for (var y = minY; y < maxY; y++) {
        for (var x = minX; x < maxX; x++) {
            var tile = new Tile(pos.z, x, y);
            tile.metatile = metatile;
            metatile.members.push(tile);
        }
    }

    metatile.pending = metatile.members.length;
    this.box = metatile.members;
    return this.box.shift();
};

PyramidScheme.prototype.nextTile = function() {
    if (this.pos === false) return false;

    // No metatiling.
    // The stack is empty. Fall back to scanline for the top zoom level.
    var bounds = this.bounds[this.minzoom];
    var pos = this.pos;
    pos.x++;
    if (pos.x > bounds.maxX) {
        pos.x = bounds.minX;
        pos.y++;
    }
    if (pos.y > bounds.maxY) {
        // Top level exhausted.
        this.pos = false;
        return false;
    }

    return new Tile(pos.z, pos.x, pos.y);
};

PyramidScheme.prototype.next = function() {
    // Spawn new render fibers when the current metatile still has members we
    // haven't processed yet, even if this goes above our concurrency.
    // The idea is that a metatile render only actually renders one image for
    // all of its members.
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
            // Next top level metatile.
            tile = this.nextMetatile();
        } else {
            // Next top level tile.
            tile = this.nextTile();
        }

        // Abort iteration when we iterated through the entire top level.
        // All remaining tiles will come from the stack.
        if (tile === false) break;

        if (tile) {
            this.addPending(tile);
            this.task.render(tile);
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
    if (tile.z < this.maxzoom) this.addChildren(tile);
    process.nextTick(this.next);
};

PyramidScheme.prototype.skip = function(tile) {
    this.removePending(tile);
    this.stats.skipped++;
    this.stats.skipped += tile.descendantCount(this.bounds);
    // Do not add the children to any kind of stack.
    if ((tile.z < this.maxzoom) && ('metatile' in tile) && (--tile.metatile.pending === 0)) {
        // Metatile is finished. Now continue with child metatiles.
        tile.metatile.addChildrenTo(this.stack);
    }
    process.nextTick(this.next);
};

PyramidScheme.prototype.duplicate = function(tile) {
    this.removePending(tile);
    this.stats.duplicate++;
    if (tile.z < this.maxzoom) this.addChildren(tile);
    process.nextTick(this.next);
};
