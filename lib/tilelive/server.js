var _ = require('underscore'),
    fs = require('fs'),
    path = require('path'),
    crypto = require('crypto'),
    Pool = require('generic-pool').Pool,
    SphericalMercator = require('./sphericalmercator'),
    sm = new SphericalMercator();

// Constructor.
var Server = function(backend) {
    this.backend = backend;
    this.pools = {};
    // @TODO: make this configurable.
    this.maxPools = 10;
};

// Create a string ID from a datasource.
// For any filepath-based datasources, the mtime of the file is appended
// to ensure the pool is fresh to changes in the datasource.
Server.prototype.id = function(datasource, callback) {
    if (typeof datasource === 'string') {
        path.exists(datasource, function(exists) {
            if (!exists) return callback(datasource);
            fs.stat(datasource, function(err, stat) {
                if (stat && stat.mtime) {
                    return callback(datasource + ':' + Date.parse(stat.mtime));
                } else {
                    return callback(datasource);
                }
            });
        });
    } else {
        return callback(crypto
            .createHash('md5')
            .update(JSON.stringify(datasource))
            .digest('hex'));
    }
};

// Reduce the number of pools down to the specified size.
Server.prototype.vacuum = function(size) {
    while (_(this.pools).keys().length > size) {
        var key = _(this.pools).keys().shift();
        delete this.pools[key];
    }
};

// Acquire resource.
//
// - `datasource` {String} datasource to be passed to `create` callback.
// - `callback` {Function} callback to call once acquired. Takes the form
//   `callback(err, resource)`
Server.prototype.acquire = function(datasource, callback) {
    this.id(datasource, function(id) {
        if (!this.pools[id]) {
            var pool = _(this.backend.pool(datasource)).defaults({
                max: 5,
                idleTimeoutMillis: 5000
            });
            this.vacuum(this.maxPools - 1);
            this.pools[id] = Pool(pool);
        }
        // Wrap the callback with an anonymous function to cover edge cases
        // and allow for correct arg length autodetection. See:
        // https://github.com/coopernurse/node-pool/issues/16
        this.pools[id].acquire(function(err, resource) {
            callback(err, resource);
        });
    }.bind(this));
};

// Release resource.
//
// - `datasource` {String} datasource of resource to be released
// - `resource` {Object} resource object to release
Server.prototype.release = function(datasource, resource) {
    this.id(datasource, function(id) {
        this.pools[id] && this.pools[id].release(resource);
    }.bind(this));
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
        if (err) return callback(err, null);
        this.backend.serve(resource, options, function(err, data) {
            this.release(options.datasource, resource);
            callback(err, data);
        }.bind(this));
    }.bind(this));
};

module.exports = Server;

