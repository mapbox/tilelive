var MBTiles = require('./mbtiles'),
    Tile = require('./tile'),
    Step = require('step'),
    SphericalMercator = require('./sphericalmercator');

/**
 * Require options keys:
 * - bbox
 * - minzoom
 * - maxzoom
 * - filepath
 * - mapfile
 * - mapfile_dir
 * - metadata
 */
function TileBatch(options) {
    this.options = options || {};
    this.mbtiles = new MBTiles(options.filepath);
    var sm = new SphericalMercator({levels: this.options.maxzoom + 1});
    this.xyz = new sm.BBoxXYZ(
        {levels: this.options.maxzoom + 1},
        this.options.bbox,
        this.options.minzoom,
        this.options.maxzoom
    );
}

TileBatch.prototype.setup = function(callback) {
    var that = this;
    Step(
        function() {
            that.mbtiles.setup(this);
        },
        function() {
            that.mbtiles.metadata(that.options.metadata, this);
        },
        function() {
            callback();
        }
    );
}

TileBatch.prototype.renderChunk = function(callback) {
    // @TODO make configurable
    // @TODO handle tile compression
    var tiles = this.xyz.next(100);
    var that = this;

    if (!tiles) {
        return callback(null, false);
    }

    Step(
        function() {
            var group = this.group();
            for (var i = 0; i < tiles.length; i++) {
                var tile = new Tile({
                    format: 'png',
                    scheme: 'tms',
                    xyz: [tiles[i][1], tiles[i][2], tiles[i][0]],
                    mapfile: that.options.mapfile,
                    mapfile_dir: that.options.mapfile_dir
                });
                tile.render(group());
            }
        },
        function(err, images) {
            if (err) { return this(err) }
            var group = this.group();
            for (var i = 0; i < tiles.length; i++) {
                that.mbtiles.insertTile(
                    images[i][0],
                    tiles[i][1],
                    tiles[i][2],
                    tiles[i][0],
                    group()
                );
            }
        },
        function(err) {
            callback(null, tiles);
        }
    );
}

TileBatch.prototype.finish = function() {
    this.mbtiles.db.close();
}

module.exports = TileBatch;
