var crypto = require('crypto'),
    Pool = require('generic-pool').Pool,
    SphericalMercator = require('./sphericalmercator'),
    sm = new SphericalMercator();

// Constructor.
var TileLive = function(backend) {
    this.backend = backend;
    this.pools = {};
};

// Create a string ID from a datasource.
TileLive.prototype.id = function(datasource) {
    if (typeof datasource === 'string') return datasource;
    return crypto
        .createHash('md5')
        .update(JSON.stringify(datasource))
        .digest('hex');
};

// Acquire resource.
//
// - `datasource` {String} datasource to be passed to constructor
// - `options` {Object} options to be passed to constructor
// - `callback` {Function} callback to call once acquired. Takes the form
//   `callback(err, resource)`
TileLive.prototype.acquire = function(datasource, options, callback) {
    var id = this.id(datasource);
    if (!this.pools[id]) {
        var pool = this.backend(datasource, options);
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
TileLive.prototype.release = function(datasource, resource) {
    var id = this.id(datasource);
    this.pools[id] && this.pools[id].release(resource);
};

// Serve a tile, grid or other resource.
//
// - `options` {Object}
// - `callback`
TileLive.prototype.serve = function(options, callback) {
    options.scheme = options.scheme || 'tms';
    if (options.xyz) {
        options.x = parseInt(options.xyz[0], 10);
        options.y = parseInt(options.xyz[1], 10);
        options.z = parseInt(options.xyz[2], 10);
        if (!options.bbox) {
            this.bbox = sm.bbox(
                options.x,
                options.y,
                options.z,
                options.scheme === 'tms',
                '900913'
            );
        }
    }
    var that = this;
    that.acquire(options.datasource, options, function(err, res) {
        if (err) {
            that.release(options.datasource, res);
            callback(err, null);
        } else {
            res.render(options, function(err, data) {
                that.release(options.datasource, res);
                callback(err, data);
            });
        }
    });
};

module.exports = TileLive;

