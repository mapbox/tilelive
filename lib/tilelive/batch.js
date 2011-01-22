var MBTiles = require('./mbtiles'),
    Step = require('Step'),
    SphericalMercator = require('./sphericalmercator');

function TileBatch(options, callback) {
    this.options = options || {};
    this.mbtiles = new MBTiles(options.filepath);
    var sm = new SphericalMercator({levels: this.options.maxzoom + 1});
    this.xyz = new sm.BBoxXYZ(
        {levels: this.options.maxzoom + 1},
        this.options.bbox,
        this.options.minzoom,
        this.options.maxzoom
    );
    this.mbtiles.setup(callback);
}

TileBatch.prototype.renderChunk = function() {
    this.xyz.next(10);
}

module.exports = TileBatch;
