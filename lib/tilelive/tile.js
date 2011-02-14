// TODO: eliminate these includes, blegh
var Step = require('step'),
    Pool = require('./mappool'),
    SphericalMercator = require('./sphericalmercator');

// # TileLive Tile object definition

// Tile constructor
//
// - `type` (map|mbtiles (map)).
// - `mapfile` (mapfile64|mbtiles filename).
// - `scheme` (xyz|tms|tile (tms)).
// - `xyz` tile coordinates in the form [x, y, z].
// - `bbox` bounding box in the form [w, s, e, n].
// - `format`
//   - Tile: (png|jpg)
//   - Data Tile: (geojson)
//   - Grid Tile: (*.grid.json).
// - `format_options` options object to pass onto formatter.
function Tile(options) {
    this.type = options.type || 'map';
    this.mapfile = options.mapfile;
    this.scheme = options.scheme;
    if (options.bbox) {
        this.bbox = options.bbox;
    } else if (options.xyz) {
        this.x = parseInt(options.xyz[0], 10);
        this.y = parseInt(options.xyz[1], 10);
        this.z = parseInt(options.xyz[2], 10);
        if (this.type === 'map') {
            this.sm = new SphericalMercator({ levels: this.z + 1 });
            this.bbox = this.sm.xyz_to_envelope(this.x, this.y, this.z,
                (['tms', 'tile'].indexOf(this.scheme) !== -1));
        }
    }
    this.format = options.format;
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
            Pool.acquire(that.type, that.mapfile, that.options, this);
        },
        function(err, res) {
            if (err) return this(err);
            resource = res;
            resource.render(that, this);
        },
        function(err, data) {
            Pool.release(that.type, that.mapfile, resource);
            callback(err, data);
        }
    );
};

module.exports = Tile;
