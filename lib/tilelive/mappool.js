// Wrapper around node-pool. Generate a pool of 5 resources per type/id
// requested.
module.exports = {
    // Acquire resource.
    //
    // - `type` {String} resource type, either `map` or `mbtiles`
    // - `id` {String} id to be passed to constructor
    // - `options` {Object} options to be passed to constructor
    // - `callback` {Function} callback to call once acquired. Takes the form
    //   `callback(err, resource)`
    acquire: function(type, id, options, callback) {
        if (!this.pools[type][id]) {
            this.pools[type][id] = this.makePool[type](id, options);
        }
        this.pools[type][id].acquire(function(resource) {
            callback(null, resource);
        });
    },
    // Release resource.
    //
    // - `type` {String} resource type, either `map` or `mbtiles`
    // - `id` {String} id of resource to be released
    // - `resource` {Object} resource object to release
    release: function(type, id, resource) {
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
        'map': function(id, options) {
            return require('generic-pool').Pool({
                name: id,
                create: function(callback) {
                    var Map = require('./map');
                    var resource = new Map(id, options);
                    resource.initialize(function() {
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
        'mbtiles': function(id, options) {
            return require('generic-pool').Pool({
                name: id,
                create: function(callback) {
                    var MBTiles = require('./mbtiles');
                    var resource = new MBTiles(id, options);
                    resource.open(function() {
                        callback(resource);
                    });
                },
                destroy: function(resource) {
                    resource.db.close();
                },
                max: 5,
                idleTimeoutMillis: 5000,
                log: false
            });
        }
    }
};
