var tiledata = new Buffer(1024);

module.exports = Timedsource;

function Timedsource(uri, callback) {
    var time = uri.time || 5;
    var variation = uri.variation || 0;

    this.time = function() {
        var t = Math.round(time * (Math.random() * variation || 1));
        return t;
    };

    this.maxzoom = uri.maxzoom || 3;
    this.emptymax = uri.emptymax || false;
    this.stopped = false;

    this.gets = 0;
    this.puts = 0;
    this.fail = uri.fail || 0;
    this.fails = {};

    if (uri.timeout) {
        var timedsource = this;
        setTimeout(function() {
            timedsource.hang = true;
        }, uri.timeout);
    }

    if (callback) callback(null, this);
    return this;
}

Timedsource.prototype.getInfo = function(callback) {
    return callback(null, {
        name: 'source (' + this.time() + ')',
        description: 'timed I/O source',
        minzoom: 0,
        maxzoom: this.maxzoom,
        bounds: [-180,-85,180,85],
        center: [0,0,3]
    });
};

Timedsource.prototype.getTile = function(z, x, y, callback) {
    this.gets++;

    if (this.fail) {
        var fail = this.fail;
        var fails = this.fails;
        var key = z + '/' + x + '/' + y;
        fails[key] = fails[key] || 0;
    }

    if (this.hang) return;
    
    setTimeout(function() {
        if (fail && fails[key] < fail) {
            fails[key]++;
            callback(new Error('Fatal'));
        } else if (x >= (Math.pow(2,z)/2)) {
            callback(new Error('Tile does not exist'));
        } else if (false && y >= (Math.pow(2,z)/2)) {
            var solid = new Buffer(1024);
            solid.solid = [(x%256),(x%256),(y%256),1].join(',');
            callback(null, solid, {});
        } else {
            callback(null, tiledata, {});
        }
    }, this.time());
};

Timedsource.prototype.putInfo = function(data, callback) {
    setTimeout(function() {
        callback();
    }, this.time());
};

Timedsource.prototype.putTile = function(z, x, y, data, callback) {
    this.puts++;

    if (this.fail) {
        var fail = this.fail;
        var fails = this.fails;
        var key = z + '/' + x + '/' + y;
        fails[key] = fails[key] || 0;
    }

    setTimeout(function() {
        if (fail && fails[key] < fail) {
            fails[key]++;
            callback(new Error('Fatal'));
        } else {
            callback();
        }
    }, this.time());
};

Timedsource.prototype.stopWriting = function(callback) {
    this.stopped = true;
    return callback();
};
