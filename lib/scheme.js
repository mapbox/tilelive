var Tile = require('./tile');

module.exports = Scheme;
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

Scheme.unserializeTiles = function(tiles) {
    return tiles.map(function(tile) {
        return Tile.fromArray(tile.split('/').map(function(num) {
            num = parseInt(num, 10);
            return isNaN(num) ? false : num;
        }));
    });
};

Scheme.create = function(type, options) {
    return new Scheme.types[type](options);
};

Scheme.prototype.start = function() {
    this.next();
};

Scheme.prototype.addPending = function(tile) {
    this.pending.push(tile);
    this.stats.pending++;
};

Scheme.prototype.removePending = function(tile) {
    var index = this.pending.indexOf(tile);
    this.pending.splice(index, 1);
    this.stats.pending--;
};

Scheme.prototype.error = function(tile) {
    this.removePending(tile);
    this.stats.failed++;
    this.next();
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
