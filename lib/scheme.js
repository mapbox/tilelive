var Tile = require('./tile').Tile;
var Metatile = require('./tile').Metatile;

module.exports = Scheme;
require('util').inherits(Scheme, process.EventEmitter);
function Scheme() {
    throw new Error('not instantiable');
}

Scheme.types = {
    file: require('./filescheme'),
    pyramid: require('./pyramidscheme')
};

Scheme.unserialize = function(state) {
    return Scheme.types[state.type].unserialize(state);
};

Scheme.create = function(type, options) {
    return new Scheme.types[type](options);
};

Scheme.prototype.finished = false;
Scheme.prototype.paused = true;

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
    this.next();
};

Scheme.prototype.skip = function(tile) {
    this.removePending(tile);
    this.stats.skipped++;
    this.next();
};

Scheme.prototype.duplicate = function(tile) {
    this.removePending(tile);
    this.stats.duplicate++;
    this.next();
};
