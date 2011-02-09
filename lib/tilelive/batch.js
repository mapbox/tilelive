var sys = require('sys'),
    MBTiles = require('./mbtiles'),
    Tile = require('./tile'),
    Map = require('./map'),
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
 * - format
 */
var TileBatch = function(options) {
    this.options = options || {};
    this.options.batchsize = this.options.batchsize || 10;
    this.options.levels = this.options.maxzoom + 1;
    this.options.compress = (typeof this.options.compress !== 'undefined') ? this.options.compress : true;
    this.options.format = this.options.format || 'png';

    this.options.interactivity = this.options.interactivity || false;

    SphericalMercator.call(this, this.options);

    // Vars needed for tile calculation/generation.
    this.minzoom = this.options.minzoom;
    this.maxzoom = this.options.maxzoom;
    this.tiles_current = 0;
    this.tiles_total = 0;

    // Precalculate the tile int bounds for each zoom level.
    // First calculate the zoomBounds of the minzoom layer and then use this
    // as the basis for the remainder of the layers. Ensures that higher zoom
    // levels do not cover less area than the lowest zoom level.
    this.zoomBounds = [];
    var base = this.zoomBounds[this.minzoom] = this.bbox_to_xyz(this.options.bbox, this.minzoom, true);
    for (var z = (this.minzoom + 1); z <= this.maxzoom; z++) {
        this.zoomBounds[z] = {};
        this.zoomBounds[z].minX = (base.minX / Math.pow(2, this.minzoom)) * Math.pow(2, z);
        this.zoomBounds[z].minY = (base.minY / Math.pow(2, this.minzoom)) * Math.pow(2, z);
        this.zoomBounds[z].maxX = this.zoomBounds[z].minX
            + ((base.maxX - base.minX + 1) * Math.pow(2, z - this.minzoom)) - 1;
        this.zoomBounds[z].maxY = this.zoomBounds[z].minY
            + ((base.maxY - base.minY + 1) * Math.pow(2, z - this.minzoom)) - 1;
    }
    for (var z = this.minzoom; z <= this.maxzoom; z++) {
        this.tiles_total += (this.zoomBounds[z].maxX - this.zoomBounds[z].minX + 1) * (this.zoomBounds[z].maxY - this.zoomBounds[z].minY + 1);
    }

    // MBTiles database for storage.
    this.mbtiles = new MBTiles(options.filepath);
};

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
};

// Render a job's full of tiles.
// -----------------------------
// Calls its callback with `err`, `tiles`.
TileBatch.prototype.fillGridData = function(callback) {
    // This function is meaningless without interactivity settings
    if (!this.options.interactivity) {
        callback('Interactivity must be supported to add grid data');
        return;
    }

    var that = this;

    Step(
        // Acquire a raw map object
        function() {
            // We're only getting one map,
            // so don't use group()
            var cb = this;
            var map = new Map(that.options.mapfile,
                that.options.mapfile_dir, true, {
                    width: 256,
                    height: 256
                }
            );
            map.localize(function(err) {
                map.mapnik_map_acquire(cb);
            });
        },
        function(err, map) {
            var i = 0;
            var CHUNK_SIZE = 100;
            var features = map.features(0, 0, 100);
            while (features.length > 0) {
                features.forEach(function(feature) {
                    that.mbtiles.insertGridData(feature,
                        that.options.interactivity.key_name,
                        this.group());
                }.bind(this));

                // Forward this pointer
                i += CHUNK_SIZE;
                features = map.features(that.options.interactivity.layer, i, i + CHUNK_SIZE);
            }
        },
        function(err) {
        }
    );
};

// Render a job's full of tiles.
// -----------------------------
// Calls its callback with `err`, `tiles`.
TileBatch.prototype.renderChunk = function(callback) {
    // @TODO handle tile compression
    var tiles = this.next(this.options.batchsize);
    this.last_render = tiles;
    var that = this;

    if (!tiles) {
        return callback(null, false);
    }

    Step(
        function() {
            var group = this.group();
            for (var i = 0; i < tiles.length; i++) {
                var tile = new Tile({
                    format: that.options.format,
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
            var renders = (function(r) {
                var o = [];
                for (var i = 0; i < renders.length; i++) {
                    o.push(renders[i][0]);
                }
                return o;
            })(renders);
            that.mbtiles.insertTiles(tiles, renders, that.options.compress, this);
        },
        function() {
            if (that.options.interactivity) {
                var group = this.group();
                for (var i = 0; i < tiles.length; i++) {
                    var tile = new Tile({
                        format: 'grid.json',
                        format_options: that.options.interactivity,
                        scheme: 'tms',
                        xyz: [tiles[i][1], tiles[i][2], tiles[i][0]],
                        mapfile: that.options.mapfile,
                        mapfile_dir: that.options.mapfile_dir
                    });
                    tile.render(group());
                }
            }
        },
        function(err, renders) {
            if (that.options.interactivity) {
                if (err) { return this(err) }
                that.mbtiles.insertGrids(tiles,
                    renders,
                    that.options.compress,
                    this);
            }
        },
        function(err) {
            callback(null, tiles);
        }
    );
};

TileBatch.prototype.finish = function() {
    this.mbtiles.db.close();
};

TileBatch.prototype.next = function(count) {
    var count = count || 1;
    var triplets = [];

    this.curZ = (typeof this.curZ === 'undefined') ? this.minzoom : this.curZ;
    for (var z = this.curZ; z <= this.maxzoom; z++) {
        this.curX = (typeof this.curX === 'undefined') ?
            this.zoomBounds[z].minX : this.curX;
        this.curY = (typeof this.curY === 'undefined') ?
            this.zoomBounds[z].minY : this.curY;

        for (var x = this.curX; x <= this.zoomBounds[z].maxX; x++) {
            for (var y = this.curY; y <= this.zoomBounds[z].maxY; y++) {
                this.curX = x;
                this.curY = y;
                this.curZ = z;
                if (triplets.length < count) {
                    triplets.push([z, x, y]);
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
    // We're done, set our cursor outside usable bounds.
    this.curZ = this.maxzoom + 1;
    this.curX = this.zoomBounds[this.maxzoom].maxX + 1;
    this.curY = this.zoomBounds[this.maxzoom].maxY + 1;
    if (!triplets.length) {
        return false;
    }
    return triplets;
};

module.exports = TileBatch;
