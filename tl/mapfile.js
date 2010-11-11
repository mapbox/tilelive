var http = require('http'),
    url = require('url'),
    util = require('util');

/**
 * Mapnik map file definition
 */

/**
 * MapFile constructor
 *
 * @param String mapfile the location of the mapfile.
 * @param Boolean base64 whether the mapfile is base64 encoded.
 */
var MapFile = function(mapfile, base64) {
    if (base64) {
        var b = new Buffer(mapfile, 'base64');
        this.mapfile = b.toString('utf-8');
        this.mapfile_64 = b.toString('base64');
    } else {
        var b = new Buffer(mapfile, 'utf-8');
        this.mapfile = b.toString('utf-8');
        this.mapfile_64 = b.toString('base64');
    }
};

MapFile.prototype.localize = function(callback) {
    this.localizeSelf(this.mapfile, function(err, data) {
        this.localizeExternals(data, callback);
    });
};

MapFile.prototype.localizeSelf = function(mapfile, callback) {
    util.downloadAndGet(mapfile, util.safe64(mapfile), callback);
};

MapFile.prototype.localizeExternals = function(data, callback) {

};

module.exports = { MapFile: MapFile };
