var http = require('http'),
    url = require('url'),
    fs = require('fs'),
    //libxmljs = require('libxmljs'),
    Step = require('step'),
    External = require('./external'),
    spawn = require('child_process').spawn,
    MapPool = require('./mappool').MapPool,
    netlib = require('./netlib');

/**
 * Map constructor
 *
 * @param {String} mapfile the location of the mapfile.
 * @param {Boolean} base64 whether the mapfile is base64 encoded.
 */
var Map = function(mapfile, base64) {
    this.mapfile = (new Buffer(mapfile, (base64) ? 'base64' : 'utf-8'))
        .toString('utf-8');
};

Map.__defineGetter__('mapfile_64', function() {
    return this.mapfile.toString('base64');
});

// TODO: move to other library
Map.prototype.mapfilePos = function(mapfile) {
    // TODO: make mapfiles a setting
    return 'mapfiles/' + netlib.safe64(mapfile) + '.xml';
};

// TODO: move to other library
Map.prototype.tempMapfilePos = function(mapfile) {
    // TODO: make mapfiles a setting
    // TODO: handle mapfiles with mml already in them
    return 'mapfiles/' + netlib.safe64(mapfile) + '.mml';
};

/**
 * Return whether the current mapfile is downloaded and completed
 * TODO: make multi-process safe
 *
 * @return {Boolean} whether the mapfile is downloaded and ready.
 */
Map.prototype.localized = function() {
    try {
        fs.statSync(this.mapfilePos(this.mapfile));
        return true;
    } catch (err) {
        return false;
    }
};

/**
 * Localize a mapfile - download core and related files
 *
 * @param {Function} callback to call once completed.
 */
Map.prototype.localize = function(callback) {
    if (!this.localized()) {
        var that = this; // TODO avoid
        console.log('downloading ' + this.mapfile);
        this.localizeSelf(this.mapfile, function(err, mapfile, data) {
            spawn('python', [
                '/usr/local/bin/cascadenik-compile.py',
                mapfile,
                that.mapfilePos(that.mapfile)
              ]
            )
            .on('exit', function(code) {
                code == 0 && callback();
                console.log('compile ended with ', code);
            });
        });
    } else {
        callback();
    }
};

/**
 * Download just a mapfile to the local host
 *
 * @param {String} mapfile the XML map file to download.
 * @param {Function} callback function to run once downloaded.
 */
Map.prototype.localizeSelf = function(mapfile, callback) {
    // this downloads the mapfile into a buffer, but doesn't save it until
    // externals are fixed up - unclear of whether this will scale for
    // very large mapfiles
    netlib.downloadAndGet(mapfile, this.tempMapfilePos(mapfile), callback);
};

/**
 * Download all files referenced by a mapfile
 *
 * @param {String} data string of XML data in a mapfile.
 * @param {Function} callback function to run once completed.
 */
Map.prototype.render = function(bbox, callback) {
    // requires a localized, loaded map
    this.localize(function() {
        this.map.render(bbox, callback);
    });
};

/**
 * Get a mapnik map from the pool
 *
 * @return {Object} mapnik map.
 */
Map.prototype.mapnik_map = function() {
    return MapPool.get(this.mapfilePos(this.mapfile));
};

module.exports = Map;
