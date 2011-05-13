// TODO: eliminate these includes, blegh
var Step = require('step'),
    Pool = require('./mappool'),
    SphericalMercator = require('./sphericalmercator');

// # TileLive Tile object definition

// Tile constructor
//
// - `type` (map|mbtiles (map)).
// - `language` (xml|carto (carto)).
// - `datasource` a URL of the resource or a pure JSON object of Carto MML.
// - `scheme` (xyz|tms).
// - `xyz` tile coordinates in the form [x, y, z].
// - `bbox` bounding box in the form [w, s, e, n].
// - `format` - default `png`
//   - Tile: (png|jpg)
//   - Data Tile: (geojson)
//   - Grid Tile: (*.grid.json).
// - `format_options` options object to pass onto formatter.
function Tile(options) {
    this.type = options.type || 'map';
    this.language = options.type || 'carto';
    this.scheme = options.scheme || 'tms';
    this.format = options.format || 'png';
    this.datasource = options.datasource;
    if (options.bbox) {
        this.bbox = options.bbox;
    } else if (options.xyz) {
        this.x = parseInt(options.xyz[0], 10);
        this.y = parseInt(options.xyz[1], 10);
        this.z = parseInt(options.xyz[2], 10);
        // TODO: support xml
        if (this.type === 'map') {
            this.sm = new SphericalMercator({
                levels: this.z + 1
            });
            this.bbox = this.sm.xyz_to_bbox(
                this.x,
                this.y,
                this.z,
                this.scheme === 'tms',
                '900913'
            );
        }
    }
    this.format_options = options.format_options || {};
    this.options = options;
}

// Generate output and invoke callback function. Defers to
// a sub function of render
// - @param {Function} callback the function to call when
//  data is rendered.
Tile.prototype.render = function(callback) {
    var that = this;
    var resource;
    Step(
        function() {
            Pool.acquire(that.type, that.datasource, that.options, this);
        },
        function(err, res) {
            if (err) return this(err, res);
            resource = res;
            resource.render(that, this);
        },
        function(err, data) {
            if (err) {
                console.log(err);
                data && Pool.destroy(that.type, that.datasource, data);
                callback(err);
            } else {
                Pool.release(that.type, that.datasource, resource);
                callback(err, data);
            }
        }
    );
};

Tile.prototype.getMap = function(callback) {
    Pool.acquire(this.type, this.datasource, this.options, function (err, map) {
        if (err) throw err;
        callback(null, map, Pool);
    });
};


module.exports = Tile;
