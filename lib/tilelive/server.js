var crypto = require('crypto'),
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
// - `datasource` {String} datasource to be passed to constructor
// - `options` {Object} options to be passed to constructor
// - `callback` {Function} callback to call once acquired. Takes the form
//   `callback(err, resource)`
Server.prototype.acquire = function(datasource, options, callback) {
    var id = this.id(datasource);
    if (!this.pools[id]) {
        var pool = this.backend.pool(datasource, options);
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

// Serve a tile, grid or other resource.
//
// - `options` {Object}
// - `callback`
Server.prototype.serve = function(options, callback) {
    options.scheme = options.scheme || 'tms';
    if (options.xyz) {
        options.x = parseInt(options.xyz[0], 10);
        options.y = parseInt(options.xyz[1], 10);
        options.z = parseInt(options.xyz[2], 10);
        if (!options.bbox) {
            options.bbox = sm.bbox(
                options.x,
                options.y,
                options.z,
                options.scheme === 'tms',
                '900913'
            );
        }
    }
    this.acquire(options.datasource, options, function(err, resource) {
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

