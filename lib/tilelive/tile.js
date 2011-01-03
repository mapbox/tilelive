// TODO: eliminate these includes, blegh
var settings = {},
    Map = require('./map'),
    Format = require('./format'),
    sm = require('./sphericalmercator');

/**
 * TileLive Tile object definition
 */

/**
 * Tile constructor
 *
 * @param {String} scheme (xyz|tms|tile (tms)).
 * @param {String} mapfile base64-encoded mapfile.
 * @param {Number} z zoom level.
 * @param {Number} x latitude.
 * @param {Number} y longitude.
 * @param {String} format
 * - Tile: (png|jpg)
 * - Data Tile: (geojson)
 * - Grid Tile: (*.grid.json).
 */
function Tile(scheme, mapfile, z, x, y, format, mapfile_dir) {
    this.map = new Map(mapfile, mapfile_dir, true);
    this.scheme = scheme;
    this.z = parseInt(z);
    this.x = parseInt(x);
    this.y = parseInt(y);
    // TODO: make class fns
    this.sm = sm;
    this.bbox = this.sm.xyz_to_envelope(this.x, this.y, this.z, false);
    this.format = Format.select(format);
}

/**
 * Generate output and invoke callback function. Defers to
 * a sub function of render
 * @param {Function} callback the function to call when
 *  data is rendered.
 */
Tile.prototype.render = function(callback) {
    var that = this;
    this.map.localize(function() {
        try {
            that.format(that, callback);
        } catch (err) {
            console.log(err.message);
        }
    });
};

module.exports = Tile;
