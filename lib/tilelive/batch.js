var sys = require('sys'),
    MBTiles = require('./mbtiles'),
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
 * - compress
 */
var TileBatch = function(options) {
    this.options = options || {};
    this.options.batchsize = this.options.batchsize || 10;
    this.options.levels = this.options.maxzoom + 1;
    this.options.compress = (typeof this.options.compress !== 'undefined') ? this.options.compress : true;

    SphericalMercator.call(this, this.options);

    // Vars needed for tile calculation/generation.
    this.minzoom = this.options.minzoom;
    this.maxzoom = this.options.maxzoom;
    this.tiles_current = 0;
    this.tiles_total = 0;

    // Precalculate the tile int bounds for each zoom level.
    this.zoomBounds = [];
    for (var z = this.minzoom; z <= this.maxzoom; z++) {
        this.zoomBounds[z] = this.bbox_to_xyz(this.options.bbox, z, true);
        this.tiles_total += (this.zoomBounds[z].maxX - this.zoomBounds[z].minX) * (this.zoomBounds[z].maxY - this.zoomBounds[z].minY);
    }

    // MBTiles database for storage.
    this.mbtiles = new MBTiles(options.filepath);
}

sys.inherits(TileBatch, SphericalMercator);

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
    // @TODO handle tile compression
    var tiles = this.next(this.options.batchsize);
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
        function(err, renders) {
            if (err) { return this(err) }
            var renders = _.pluck(renders, 0);
            that.mbtiles.insert(tiles, renders, that.options.compress, this);
        },
        function(err) {
            callback(null, tiles);
        }
    );
}

TileBatch.prototype.finish = function() {
    this.mbtiles.db.close();
}

TileBatch.prototype.next = function(count) {
    var count = count || 1;
    var triplets = [];

    this.curZ = (typeof this.curZ === 'undefined') ? this.minzoom : this.curZ;
    for (var z = this.curZ; z <= this.maxzoom; z++) {
        this.curX = (typeof this.curX === 'undefined') ? this.zoomBounds[z].minX : this.curX;
        this.curY = (typeof this.curY === 'undefined') ? this.zoomBounds[z].minY : this.curY;

        for (var x = this.curX; x < this.zoomBounds[z].maxX; x++) {
            for (var y = this.curY; y < this.zoomBounds[z].maxY; y++) {
                this.curX = x;
                this.curY = y;
                this.curZ = z;
                if (triplets.length < count) {
                    triplets.push([z,x,y]);
                    this.tiles_current++;
                } else if (triplets.length === count) {
                    return triplets;
                }
            }
            // End of row, reset Y cursor.
            this.curY = this.zoomBounds[z].minY;
        }

        // End of the zoom layer, pass through and reset XY cursors.
        delete this.curX;
        delete this.curY;
    }
    // We're done.
    this.curZ = this.maxzoom;
    this.curX = this.zoomBounds[this.maxzoom].maxX;
    this.curY = this.zoomBounds[this.maxzoom].maxY;
    if (!triplets.length) {
        return false;
    }
    return triplets;
}

module.exports = TileBatch;
