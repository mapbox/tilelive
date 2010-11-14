var mapnik = require('mapnik');

/**
 * A pool of maps
 */
var MapPool = new function mappool() {
    this.pool = [];
    this.size = 10;
    for (var i = 0; i < this.size; i++) {
        this.pool.push([]);
    }
}

/**
 * get a map
 */
MapPool.get = function(mapfile) {
    if (this.pool[mapfile]) {
        // rotate queue
        this.pool[mapfile].unshift(
            this.pool[mapfile].pop());
    } else {
        // TODO: just use locking instead of this
        this.pool[mapfile] = [];
        for (var i = 0; i < this.size; i++) {
            var m = new mapnik.Map(256, 256);
            m.load(mapfile);
            this.pool[mapfile].push(m);
        }
    }
    console.log(this.pool[mapfile][0]);
    return this.pool[mapfile][0];
};

module.exports.MapPool = MapPool;
