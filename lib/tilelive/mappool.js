var mapnik = require('mapnik');

/**
 * A pool of maps
 */
module.exports = new function() {
    return {
        get: function(mapfile) {
            if (this.mapfile == mapfile) {
                return this.m;
            } else {
                this.m && this.m.clear();
                this.m = new mapnik.Map(256, 256);
                // can throw exception
                this.m.load(mapfile);
                this.m.buffer_size(128);
                this.mapfile = mapfile;
                return this.m;
            }
        }
    };
}
