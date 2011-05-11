var _ = require('underscore'),
    crypto = require('crypto'),
    Pool = require('generic-pool').Pool,
    SphericalMercator = require('./sphericalmercator'),
    sm = new SphericalMercator();

// Constructor.
var Server = function(backend) {
    this.backend = backend;
    this.pools = {};
};

// Create a string ID from a datasource.
Server.prototype.id = function(datasource) {
    if (typeof datasource === 'string') return datasource;
    return crypto
        .createHash('md5')
        .update(JSON.stringify(datasource))
        .digest('hex');
};

// Acquire resource.
//
// - `datasource` {String} datasource to be passed to `create` callback.
// - `callback` {Function} callback to call once acquired. Takes the form
//   `callback(err, resource)`
Server.prototype.acquire = function(datasource, callback) {
    var id = this.id(datasource);
    if (!this.pools[id]) {
        var pool = this.backend.pool(datasource);
        pool.max = pool.max || 5;
        pool.idleTimeoutMillis = pool.idleTimeoutMillis || 5000;
        this.pools[id] = Pool(pool);
    }
    this.pools[id].acquire(function(resource) {
        callback(null, resource);
    });
};

// Release resource.
//
// - `datasource` {String} datasource of resource to be released
// - `resource` {Object} resource object to release
Server.prototype.release = function(datasource, resource) {
    var id = this.id(datasource);
    this.pools[id] && this.pools[id].release(resource);
};

// Serve a tile, grid or other resource. The type of resource served is
// determined by the `options.format` value - e.g. a format of `grid.json` will
// serve a grid while `png` will serve the corresponding tile image. The keys
// acceptable in `options` vary by backend and format. The following are some
// typical options keys:
//
// - `options.datasource` {String|Object} The datasource for the resource.
// - `options.format` {String} The format of resource to be served.
// - `options.x` {String|Number} The tile column value.
// - `options.y` {String|Number} The tile row value.
// - `options.z` {String|Number} The tile zoom level value.
// - `options.scheme` {String} Either `tms` or `xyz`.
// - `callback` {Function} Callback function.
Server.prototype.serve = function(options, callback) {
    _(options).defaults({
        scheme: 'tms',
        x: 0,
        y: 0,
        z: 0
    });
    options.x = parseInt(options.x, 10);
    options.y = parseInt(options.y, 10);
    options.z = parseInt(options.z, 10);
    !options.bbox && (options.bbox = sm.bbox(
        options.x,
        options.y,
        options.z,
        options.scheme === 'tms',
        '900913'
    ));
    this.acquire(options.datasource, function(err, resource) {
        if (err) {
            this.release(options.datasource, resource);
            callback(err, null);
        } else {
            this.backend.serve(resource, options, function(err, data) {
                this.release(options.datasource, resource);
                callback(err, data);
            }.bind(this));
        }
    }.bind(this));
};

module.exports = Server;

