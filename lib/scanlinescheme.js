var Scheme = require('./scheme');
var Tile = require('./tile').Tile;
var Metatile = require('./tile').Metatile;
var unserializeTiles = require('./tile').unserialize;
var Statistics = require('./statistics');
var sm = new (require('sphericalmercator'));

module.exports = ScanlineScheme;
require('util').inherits(ScanlineScheme, Scheme);
function ScanlineScheme(options) {
    if (!options.bbox) options.bbox = [ -180, -85.05112877980659, 180, 85.05112877980659 ];
    if (!Array.isArray(options.bbox) || options.bbox.length !== 4) throw new Error('bbox must have four lat/long coordinates');
    if (options.bbox[0] < -180) throw new Error('bbox has invalid west value');
    if (options.bbox[1] < -85.05112877980659) throw new Error('bbox has invalid south value');
    if (options.bbox[2] > 180) throw new Error('bbox has invalid east value');
    if (options.bbox[3] > 85.05112877980659) throw new Error('bbox has invalid north value');
    if (options.bbox[0] > options.bbox[2]) throw new Error('bbox is invalid');
    if (options.bbox[1] > options.bbox[3]) throw new Error('bbox is invalid');
    if (typeof options.minzoom !== 'number') throw new Error('minzoom must be a number');
    if (typeof options.maxzoom !== 'number') throw new Error('maxzoom must be a number');
    if (options.minzoom < 0) throw new Error('minzoom must be >= 0');
    if (options.maxzoom > 22) throw new Error('maxzoom must be <= 22');
    if (options.minzoom > options.maxzoom) throw new Error('maxzoom must be >= minzoom');
    if (typeof options.metatile === 'number' && options.metatile <= 0) throw new Error('Invalid metatile size');

    this.type = 'scanline';
    this.concurrency = options.concurrency || 8;
    this.minzoom = options.minzoom;
    this.maxzoom = options.maxzoom;
    this.metatile = (options.metatile || 1) | 0;

    // Precalculate the tile int bounds for each zoom level.
    this.bounds = {};
    this.stats = new Statistics();
    for (var z = options.minzoom; z <= options.maxzoom; z++) {
        this.bounds[z] = sm.xyz(options.bbox, z);
        this.stats.total += (this.bounds[z].maxX - this.bounds[z].minX + 1) *
                            (this.bounds[z].maxY - this.bounds[z].minY + 1);
    }

    if (this.metatile > 1) {
        this.pos = {
            z: this.minzoom,
            x: this.bounds[this.minzoom].minX - (this.bounds[this.minzoom].minX % this.metatile) - this.metatile,
            y: this.bounds[this.minzoom].minY - (this.bounds[this.minzoom].minY % this.metatile)
        };
    } else {
        this.pos = {
            z: this.minzoom,
            x: this.bounds[this.minzoom].minX - 1,
            y: this.bounds[this.minzoom].minY
        };
    }

    this.box = [];

    this.initialize();
}

ScanlineScheme.prototype.type = 'scanline';

ScanlineScheme.unserialize = function(state) {
    var scheme = Object.create(ScanlineScheme.prototype);
    for (var key in state) scheme[key] = state[key];
    scheme.stats = Statistics.unserialize(state.stats);
    scheme.initialize();
    return scheme;
};

ScanlineScheme.prototype.toJSON = function() {
    // Determine lowest item that is pending
    var pos = { z: this.pos.z, x: this.pos.x, y: this.pos.y };
    for (var i = 0; i < this.pending.length; i++) {
        var tile = this.pending[i];
        if ((tile.z < pos.z) ||
            (tile.z === pos.z && tile.y < pos.y) ||
            (tile.z === pos.z && tile.y === pos.y && tile.x < pos.x)) {
            pos.z = tile.z;
            pos.x = tile.x;
            pos.y = tile.y;
        }
    }

    // Align resulting pos to a metatile boundary.
    if (pos.x >= this.bounds[pos.z].minX) {
        pos.x = pos.x - (pos.x % this.metatile) - this.metatile;
        pos.y = pos.y - (pos.y % this.metatile);
    }

    return {
        type: this.type,
        concurrency: this.concurrency,
        minzoom: this.minzoom,
        maxzoom: this.maxzoom,
        metatile: this.metatile,
        bounds: this.bounds,
        stats: this.stats,
        pos: pos,
        box: [],
        finished: this.finished,
        pending: [],
        paused: true
    };
};

ScanlineScheme.prototype.nextMetatile = function() {
    if (this.pos === false) return false;

    // We are metatiling.
    var pos = this.pos;
    var bounds = this.bounds[pos.z];
    pos.x += this.metatile;
    if (pos.x > bounds.maxX) {
        pos.x = bounds.minX - (bounds.minX % this.metatile),
        pos.y += this.metatile;
    }
    if (pos.y > bounds.maxY) {
        pos.z++;
        if (pos.z > this.maxzoom) {
            this.pos = false;
            return false;
        }

        bounds = this.bounds[pos.z];
        pos.x = bounds.minX - (bounds.minX % this.metatile),
        pos.y = bounds.minY - (bounds.minY % this.metatile);
    }

    var metatile = new Metatile(pos.z, pos.x, pos.y, this.metatile);
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

ScanlineScheme.prototype.nextTile = function() {
    if (this.pos === false) return false;

    // No metatiling.
    var pos = this.pos;
    var bounds = this.bounds[pos.z];
    pos.x++;
    if (pos.x > bounds.maxX) {
        pos.x = bounds.minX;
        pos.y++;
    }
    if (pos.y > bounds.maxY) {
        pos.z++;
        if (pos.z > this.maxzoom) {
            this.pos = false;
            return false;
        }

        bounds = this.bounds[pos.z];
        pos.x = bounds.minX;
        pos.y = bounds.minY;
    }

    return new Tile(pos.z, pos.x, pos.y);
};

ScanlineScheme.prototype.next = function() {
    // Spawn new render fibers when the current metatile still has members we
    // haven't processed yet, even if this goes above our concurrency.
    // The idea is that a metatile render only actually renders one image for
    // all of its members.
    while (!this.finished && !this.paused && (this.pending.length < this.concurrency || this.box.length)) {
        var tile;
        if (this.box.length) {
            // Current metatile isn't exhausted yet.
            tile = this.box.shift();
        } else if (this.metatile > 1) {
            // Next top level metatile.
            tile = this.nextMetatile();
        } else {
            // Next top level tile.
            tile = this.nextTile();
        }

        // Abort iteration when we iterated through the entire top level.
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

ScanlineScheme.prototype.unique = function(tile) {
    this.removePending(tile);
    this.stats.unique++;
    process.nextTick(this.next);
};

ScanlineScheme.prototype.skip = function(tile) {
    this.removePending(tile);
    this.stats.skipped++;
    process.nextTick(this.next);
};

ScanlineScheme.prototype.duplicate = function(tile) {
    this.removePending(tile);
    this.stats.duplicate++;
    process.nextTick(this.next);
};
