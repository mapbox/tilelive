
/**
 * Small wrapper around node-pool. Establishes a pool of 5 mapnik map objects
 * per mapfile.
 * @TODO: Make pool size configurable.
 */
module.exports = new function() {
    return {
        pools: {},
        acquire: function(mapfile, options, callback) {
            if (!this.pools[mapfile]) {
                this.pools[mapfile] = require('generic-pool').Pool({
                    name: mapfile,
                    create: function(callback) {
                        var width = options.width || 256,
                            height = options.height || 256,
                            Map = require('mapnik').Map,
                            map = new Map(width, height);
                        try {
                            map.load(mapfile);
                            map.buffer_size(128);
                            callback(map);
                        } catch(err) {
                            callback(map);
                        }
                    },
                    destroy: function(map) {
                        map.clear();
                        delete map;
                    },
                    max: 5,
                    idleTimeoutMillis: 5000,
                    log: false
                });
            }
            this.pools[mapfile].acquire(callback);
        },
        release: function(mapfile, map) {
            this.pools[mapfile] && this.pools[mapfile].release(map);
        }
    };
}
