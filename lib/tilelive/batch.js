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
 */
var TileBatch = function(options) {
    this.options = options || {};
    this.options.batchsize = this.options.batchsize || 10;
    this.options.levels = this.options.maxzoom + 1;

    SphericalMercator.call(this, this.options);

    this.mbtiles = new MBTiles(options.filepath);
    this.minzoom = this.options.minzoom;
    this.maxzoom = this.options.maxzoom;
    this.bbox = this.mercator.inverse(this.options.bbox);
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

TileBatch.prototype.next = function(count) {
    var count = count || 1;
    var triplets = [];

    var ll0 = [this.bbox[0],this.bbox[3]];
    var ll1 = [this.bbox[2],this.bbox[1]];

    var that = this;
    this.curZ = (typeof this.curZ === 'undefined') ? this.minzoom : this.curZ;
    for (var z = this.curZ; z <= this.maxzoom; z++) {
        px0 = that.ll_to_px(ll0,z);
        px1 = that.ll_to_px(ll1,z);

        var maxX = parseInt(px1[0]/256.0+1);
        var minX = parseInt(px0[0]/256.0);
        var maxY = parseInt(px1[1]/256.0+1);
        var minY = parseInt(px0[1]/256.0);

        this.curX = (typeof this.curX === 'undefined') ? minX : this.curX;
        this.curY = (typeof this.curY === 'undefined') ? minY : this.curY;

        for (var x = this.curX; x < maxX; x++) {
            for (var y = this.curY; y < maxY; y++) {
                this.curX = x;
                this.curY = y;
                this.curZ = z;
                if (triplets.length < count) {
                    triplets.push([z,x,y]);
                }
                else if (triplets.length === count) {
                    return triplets;
                }
            }
            // Reset Y cursor
            this.curY = minY;
        }

        // End of the zoom layer, pass through and reset XY cursors.
        delete this.curX;
        delete this.curY;
    }
    // We're done.
    this.curZ = this.maxzoom;
    this.curX = maxX;
    this.curY = maxY;
    if (!triplets.length) {
        return false;
    }
    return triplets;
}

// assumes an envelope is in projected coords, in this case spherical mercator
TileBatch.prototype.envelope_to_xyz_array = function(envelope, minzoom, maxzoom) {
    var bbox = mercator.inverse(envelope);
    this.bbox_to_xyz_array(bbox,minzoom,maxzoom);
}

// assumes at bbox is in long/lat aka wgs 84
TileBatch.prototype.bbox_to_xyz_array = function(bbox, minzoom, maxzoom) {
    var ll0 = [bbox[0],bbox[3]];
    var ll1 = [bbox[2],bbox[1]];
    var that = this;
    for (var z = minzoom; z <= maxzoom; z++) {
        px0 = that.ll_to_px(ll0,z);
        px1 = that.ll_to_px(ll1,z);

        for(var x = parseInt(px0[0]/256.0); x < parseInt(px1[0]/256.0+1); x++) {
            for (var y = parseInt(px0[1]/256.0); y < parseInt(px1[1]/256.0+1); y++) {
                console.log(z + ' ' + x + ' ' + y);
            }
        }
    }
}

module.exports = TileBatch;
