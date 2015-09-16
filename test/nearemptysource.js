var tiledata = new Buffer(1024);

module.exports = Nearemptysource;

function Nearemptysource(uri, callback, options) {
    options = options || {};
    this.time = uri.time || 5;
    this.maxzoom = uri.maxzoom || 3;
    this.emptymax = uri.emptymax || false;
    this.stopped = false;
    if (callback) callback(null, this);
    return this;
}

Nearemptysource.prototype.getInfo = function(callback) {
    return callback(null, {
        name: 'source (' + this.timeout + ')',
        description: 'Near empty source',
        minzoom: 0,
        maxzoom: this.maxzoom,
        bounds: [-180,-85,180,85],
        center: [0,0,3]
    });
};

Nearemptysource.prototype.getTile = function(z, x, y, callback) {
    var maxzoom = this.maxzoom;
    setTimeout(function() {
        if (z >= maxzoom - 1 && x < (Math.pow(2,z)/2)) {
            callback(null, tiledata, {});
        } else {
            callback(new Error('Tile does not exist'));
        }
    }, this.time);
};

Nearemptysource.prototype.putInfo = function(data, callback) {
    setTimeout(function() {
        callback();
    }, this.time);
};

Nearemptysource.prototype.putTile = function(z, x, y, data, callback) {
    setTimeout(function() {
        callback();
    }, this.time);
};

Nearemptysource.prototype.stopWriting = function(callback) {
    this.stopped = true;
    return callback();
};

