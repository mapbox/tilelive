var Scheme = require('./scheme');
var Tile = require('./tile');
var Statistics = require('./statistics');
var sm = new (require('sphericalmercator'));

module.exports = PyramidScheme;
require('util').inherits(PyramidScheme, Scheme);
function PyramidScheme(options) {
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

    this.type = 'pyramid';
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

    this.pos = {
        z: this.minzoom,
        x: this.bounds[this.minzoom].minX - 1,
        y: this.bounds[this.minzoom].minY
    };

    this.stack = [];
    this.finished = false;

    this.initialize();
}

PyramidScheme.prototype.type = 'pyramid';

PyramidScheme.prototype.initialize = function() {
    this.pending = [];
    this.next = this.next.bind(this);
};

PyramidScheme.unserialize = function(state) {
    var scheme = Object.create(PyramidScheme.prototype);
    for (var key in state) scheme[key] = state[key];
    scheme.stack = Scheme.unserializeTiles(state.stack).concat(Scheme.unserializeTiles(state.pending));
    scheme.stats = Statistics.unserialize(state.stats);
    scheme.initialize();
    return scheme;
};

PyramidScheme.prototype.next = function() {
    while (this.pending.length < this.concurrency) {
        if (this.stack.length) {
            var tile = this.stack.pop();
        } else {
            // The stack is empty. Fall back to scanline for the top zoom level.
            var bounds = this.bounds[this.minzoom];
            var pos = this.pos;
            pos.x++;
            if (pos.x > bounds.maxX) {
                pos.x = bounds.minX;
                pos.y++;
            }
            if (pos.y <= bounds.maxY) {
                var tile = new Tile(pos.z, pos.x, pos.y);
            } else {
                break;
            }
        }

        this.addPending(tile);
        this.task.render(tile);
    }

    if (!this.finished && !this.pending.length) {
        this.finished = true;
        this.task.finished();
    }
};

PyramidScheme.prototype.addChildren = function(tile) {
    var children = tile.children();
    var bounds = this.bounds[tile.z+1];
    if (!bounds) return;
    for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (child.x >= bounds.minX && child.x <= bounds.maxX &&
            child.y >= bounds.minY && child.y <= bounds.maxY) {
            this.stack.push(child);
        }
    }
};

PyramidScheme.prototype.unique = function(tile) {
    this.removePending(tile);
    this.stats.unique++;
    if (tile.z < this.maxzoom) this.addChildren(tile);
    this.next();
};

PyramidScheme.prototype.skip = function(tile) {
    this.removePending(tile);
    this.stats.skipped++;
    this.stats.skipped += tile.descendantCount(this.bounds);
    this.next();
};

PyramidScheme.prototype.duplicate = function(tile) {
    this.removePending(tile);
    this.stats.duplicate++;
    if (tile.z < this.maxzoom) this.addChildren(tile);
    this.next();
};
