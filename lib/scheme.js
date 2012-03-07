var Tile = require('./tile').Tile;
var Metatile = require('./tile').Metatile;

module.exports = Scheme;
require('util').inherits(Scheme, process.EventEmitter);
function Scheme() {
    throw new Error('not instantiable');
}

Scheme.types = {
    file: require('./filescheme'),
    pyramid: require('./pyramidscheme'),
    scanline: require('./scanlinescheme')
};



Scheme.unserialize = function(state) {
    return Scheme.types[state.type].unserialize(state);
};

Scheme.create = function(type, options) {
    return new Scheme.types[type](options);
};

Scheme.validateBBoxOptions = function(options) {
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
};

Scheme.prototype.finished = false;
Scheme.prototype.paused = true;


Scheme.prototype.initialize = function() {
    this.pending = [];
    Object.defineProperty(this, 'next', { value: this.next.bind(this) });
};

Scheme.prototype.start = function() {
    if (this.finished) {
        this.task.finished();
    } else {
        this.paused = false;
        this.next();
    }
};

Scheme.prototype.pause = function() {
    this.paused = true;
    if (!this.pending.length) {
        this.emit('paused');
    }
};

Scheme.prototype.addPending = function(tile) {
    this.pending.push(tile);
    this.stats.pending++;
};

Scheme.prototype.removePending = function(tile) {
    var index = this.pending.indexOf(tile);
    if (index >= 0) {
        this.pending.splice(index, 1);
        this.stats.pending--;
    }
    if (this.paused && !this.pending.length) {
        this.emit('paused');
    }
};

Scheme.prototype.error = function(tile) {
    this.removePending(tile);
    this.stats.failed++;
    process.nextTick(this.next);
};

Scheme.prototype.unique = function(tile) {
    this.removePending(tile);
    this.stats.unique++;
    process.nextTick(this.next);
};

Scheme.prototype.skip = function(tile) {
    this.removePending(tile);
    this.stats.skipped++;
    process.nextTick(this.next);
};

Scheme.prototype.duplicate = function(tile) {
    this.removePending(tile);
    this.stats.duplicate++;
    process.nextTick(this.next);
};
