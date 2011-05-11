var crypto = require('crypto'),
    Pool = require('generic-pool').Pool,
    Map = require('./map'),
    MBTiles = require('./mbtiles');

// Wrapper around node-pool. Generate a pool of 5 resources per type/id
// requested.
module.exports = {
    // Create a string ID from a datasource.
    makeId: function(datasource) {
        if (typeof datasource === 'string') return datasource;
        return crypto
            .createHash('md5')
            .update(JSON.stringify(datasource))
            .digest('hex');
    },
    // Acquire resource.
    //
    // - `type` {String} resource type, either `map` or `mbtiles`
    // - `datasource` {String} datasource to be passed to constructor
    // - `options` {Object} options to be passed to constructor
    // - `callback` {Function} callback to call once acquired. Takes the form
    //   `callback(err, resource)`
    acquire: function(type, datasource, options, callback) {
        var id = this.makeId(datasource);
        if (!this.pools[type][id]) {
            this.pools[type][id] = this.makePool[type](id, datasource, options);
        }
        this.pools[type][id].acquire(function(resource) {
            callback(null, resource);
        });
    },
    // Release resource.
    //
    // - `type` {String} resource type, either `map` or `mbtiles`
    // - `datasource` {String} datasource of resource to be released
    // - `resource` {Object} resource object to release
    release: function(type, datasource, resource) {
        var id = this.makeId(datasource);
        this.pools[type]
            && this.pools[type][id]
            && this.pools[type][id].release(resource);
    },
    // Cache of pools by type/id.
    pools: {
        map: {},
        mbtiles: {}
    },
    // Factory for pool objects.
    makePool: {
        'map': function(id, datasource, options) {
            return Pool({
                name: id,
                create: function(callback) {
                    var resource = new Map(datasource, options);
                    resource.initialize(function(err) {
                        if (err) throw err;
                        callback(resource);
                    });
                },
                destroy: function(resource) {
                    resource.destroy();
                },
                max: 5,
                idleTimeoutMillis: 5000,
                log: false
            });
        },
        'mbtiles': function(id, datasource, options) {
            return Pool({
                name: id,
                create: function(callback) {
                    var resource = new MBTiles(datasource, options, function() {
                        callback(resource);
                    });
                },
                destroy: function(resource) {
                    resource.db.close(function() {});
                },
                max: 5,
                idleTimeoutMillis: 5000,
                log: false
            });
        }
    }
};
