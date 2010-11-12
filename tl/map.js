var http = require('http'),
    url = require('url'),
    netlib = require('./netlib');

/**
 * Map constructor
 *
 * @param String mapfile the location of the mapfile.
 * @param Boolean base64 whether the mapfile is base64 encoded.
 */
var Map = function(mapfile, base64) {
    this.mapfile = (new Buffer(mapfile, (base64) ? 'base64' : 'utf-8'))
        .toString('utf-8');
};

Map.__defineGetter__('mapfile_64', function() {
    return this.mapfile.toString('base64');
});

/**
 * Localize a mapfile - download core and related files
 */
Map.prototype.localize = function(callback) {
    this.localizeSelf(this.mapfile, function(err, data) {
        // Map.localizeExternals(data, callback);
    });
};

/**
 * Download just a mapfile to the local host
 *
 * @param String mapfile the XML map file to download.
 * @param Function callback function to run once downloaded.
 */
Map.prototype.localizeSelf = function(mapfile, callback) {
    netlib.downloadAndGet(mapfile, netlib.safe64(mapfile), callback);
};

/**
 * Download all files referenced by a mapfile
 *
 * @param String data string of XML data in a mapfile.
 * @param Function callback function to run once completed.
 */
Map.prototype.localizeExternals = function(data, callback) {
    // var doc = libxml.parseXmlString(data);
};

/**
 * Download all files referenced by a mapfile
 *
 * @param String data string of XML data in a mapfile.
 * @param Function callback function to run once completed.
 */
Map.prototype.render = function(bbox, callback) {
    // requires a localized, loaded map
    this.localize(function() {
        this.map.render(bbox, callback);
    });
};


module.exports = { Map: Map };
