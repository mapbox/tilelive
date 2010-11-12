// TODO: eliminate these includes, blegh
var Map = require('./map').Map,
    Format = require('./format').Format,
    SphericalMercator = require('./sphericalmercator').SphericalMercator;

/**
 * TileLive Tile object definition
 */

/**
 * Tile constructor
 *
 * @param String scheme: (xyz|tms|tile (tms)).
 * @param String mapfile base64-encoded mapfile.
 * @param Number z zoom level.
 * @param Number x latitude.
 * @param Number y longitude.
 * @param String format:
 * - Tile: (png|jpg)
 * - Data Tile: (geojson)
 * - Grid Tile: (*.grid.json).
 */
function Tile(scheme, mapfile, z, x, y, format) {
    this.map = new Map(mapfile, true);
    this.scheme = scheme;
    this.z = z;
    this.x = x;
    this.y = y;
    // TODO: make class fns
    this.sm = new SphericalMercator();
    this.bbox = this.sm.xyz_to_envelope(x, y, z);
    this.format = Format.select(format);
};

/**
 * Generate output and invoke callback function. Defers to
 * a sub function of render
 * @param Function callback the function to call when
 *  data is rendered.
 */
Tile.prototype.render = function(callback) {
    try {
        this.format(this, callback);
    } catch (err) {
        callback('Filetype unsupported', null);
        console.log(err.message);
    }
};

module.exports = { Tile: Tile };
