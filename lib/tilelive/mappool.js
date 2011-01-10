var mapnik = require('mapnik');

/**
 * A pool of maps
 */
module.exports = new function() {
    return {
        get: function(mapfile) {
            delete this.m;
            this.m = new mapnik.Map(256, 256);
            this.m.load(mapfile);
            return this.m;
        }
    };
}
