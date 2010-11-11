/**
 * TileLive Tile object definition
 */

var MapFile = require('mapfile');

/**
 * Tile constructor
 *
 * @param String scheme: (xyz|tms|tile (tms))
 * @param String mapfile base64-encoded mapfile.
 * @param Number z zoom level
 * @param Number x latitude
 * @param Number y longitude
 * @param String format:
 * - Tile: (png|jpg)
 * - Data Tile: (geojson)
 * - Grid Tile: (*.grid.json)
 */
var Tile = function(scheme, mapfile, z, x, y, format) {
    if (typeof mapfile == MapFile) {
        this.mapfile = mapfile;
    }
    else {
        this.mapfile = new MapFile(mapfile, true);
    }
    this.scheme = scheme;
    this.z = z;
    this.x = x;
    this.y = y;
    if (format.match(/grid.json/g)) {
        this.filetype = 'grid';
        this.format = format;
    }
    else {
        this.format = this.filetype = format;
    }
};

/**
 * Generate output and invoke callback function. Defers to 
 * a sub function of render
 * @param Function callback the function to call when
 *  data is rendered.
 */
Tile.prototype.render = function(callback) {
    try {
        this.render[this.filetype](callback);
    } catch (err) {
        callback('Filetype unsupported', null);
    }
};

/**
 * Generate a PNG file and call callback
 * @param Function callback the function to call when
 *  data is rendered.
 */
Tile.prototype.render.png = function(callback) {
    callback(null, 'png file');
};

/**
 * Generate a JPG file and call callback
 * @param Function callback the function to call when
 *  data is rendered.
 */
Tile.prototype.render.jpg = function(callback) {
    callback(null, 'jpg file');
};

/**
 * Generate a Grid file and call callback
 * @param Function callback the function to call when
 *  data is rendered.
 */
Tile.prototype.render.grid = function(callback) {
    callback(null, 'grid file');
};

/**
 * Generate a GeoJSON file and call callback
 * @param Function callback the function to call when
 *  data is rendered.
 */
Tile.prototype.render.geojson = function(callback) {
    callback(null, 'geojson file');
};

module.Exports = { Tile: Tile };
