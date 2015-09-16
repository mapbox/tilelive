var tiledata = new Buffer(1024);

module.exports = Containsdatasource;

function Containsdatasource(uri, callback, options) {
    options = options || {};
    this.time = uri.time || 5;
    this.maxzoom = uri.maxzoom || 3;
    this.emptymax = uri.emptymax || false;
    this.stopped = false;
    if (callback) callback(null, this);
    return this;
}

Containsdatasource.prototype.getInfo = function(callback) {
    return callback(null, {
        name: 'source (' + this.timeout + ')',
        description: 'Near empty source',
        minzoom: 0,
        maxzoom: this.maxzoom,
        bounds: [-180,-85,180,85],
        center: [0,0,3]
    });
};

Containsdatasource.prototype.getTile = function(z, x, y, callback) {
    var maxzoom = this.maxzoom;
    setTimeout(function() {
        if (z == 0) {
            callback(null, tiledata, {'x-tilelive-contains-data':true});
        } else if (x < (Math.pow(2,z)/2)) {
            if (z >= maxzoom - 1) {
                callback(null, tiledata, {'x-tilelive-contains-data':true});
            } else {
                callback(new Error('Tile does not exist'), null, {'x-tilelive-contains-data':true});
            }
        } else {
            callback(new Error('Tile does not exist'), null, {'x-tilelive-contains-data':false});
        }
    }, this.time);
};

Containsdatasource.prototype.putInfo = function(data, callback) {
    setTimeout(function() {
        callback();
    }, this.time);
};

Containsdatasource.prototype.putTile = function(z, x, y, data, callback) {
    setTimeout(function() {
        callback();
    }, this.time);
};

Containsdatasource.prototype.stopWriting = function(callback) {
    this.stopped = true;
    return callback();
};

