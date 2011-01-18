var http = require('http'),
    url = require('url'),
    fs = require('fs'),
    events = require('events'),
    mess = require('mess'),
    mapnik = require('mapnik'),
    path = require('path'),
    spawn = require('child_process').spawn,
    MapPool = require('./mappool'),
    netlib = require('./netlib'),
    localized = {},
    locked = {};

/**
 * Map constructor
 *
 * @param {String} mapfile the location of the mapfile.
 * @param {String} mapfile_dir directory to which the mapfile should be cached.
 * @param {Boolean} base64 whether the mapfile is base64 encoded.
 */
var Map = function(mapfile, mapfile_dir, base64) {
    this.mapfile_dir = mapfile_dir;
    this.mapfile = (new Buffer(mapfile, (base64) ? 'base64' : 'utf-8'))
        .toString('utf-8');
};

Map.__defineGetter__('mapfile_64', function() {
    return this.mapfile.toString('base64');
});

/**
 * Return whether the current mapfile is downloaded and completed
 * TODO: make multi-process safe
 *
 * @return {Boolean} whether the mapfile is downloaded and ready.
 */
Map.prototype.localized = function() {
    if (localized[this.mapfile]) {
        return true;
    }
    return false;
};

/**
 * Return whether the current mapfile is "locked", ie. currently
 * being downloaded concurrently.
 * TODO: make multi-process safe
 *
 * @return {Boolean} whether the mapfile is locked.
 */
Map.prototype.locked = function() {
    if (locked[this.mapfile]) {
        return locked[this.mapfile];
    }
    return false;
};

Map.prototype.mapfilePos = function(mapfile) {
    return this.mapfile_dir + '/' + netlib.safe64(mapfile) + '.xml';
};

/**
 * Localize a mapfile - download core and related files
 *
 * @param {Function} callback to call once completed.
 */
Map.prototype.localize = function(callback) {
    var that = this;
    if (this.localized()) {
        callback();
    }
    else if (this.locked()) {
        console.log('waiting on lock ' + this.mapfile);
        this.locked().on('unlock', callback);
    }
    else {
        locked[this.mapfile] = new events.EventEmitter();
        console.log('downloading ' + this.mapfile);
        this.localizeSelf(this.mapfile, function(err, filename, data) {
            try {
                new(mess.Renderer)({
                    data_dir: that.mapfile_dir,
                    optimization: false,
                    validation_data: {
                        fonts: mapnik.fonts()
                    },
                    filename: this.mapfile
                }).render(data, function(err, output) {
                    if (err) {
                        locked[that.mapfile].emit('unlock');
                        locked[that.mapfile] = false;
                        callback(err);
                    } else {
                        fs.writeFile(that.mapfilePos(that.mapfile), output, function() {
                            localized[that.mapfile] = true;
                            locked[that.mapfile].emit('unlock');
                            locked[that.mapfile] = false;
                            callback();
                        });
                    }
                });
            } catch(e) {
                locked[that.mapfile].emit('unlock');
                locked[that.mapfile] = false;
                callback(e);
            }
        });
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
    netlib.get(mapfile, null, 'utf-8', callback);
};

/**
 * Download all files referenced by a mapfile
 *
 * @param {String} data string of XML data in a mapfile.
 * @param {Function} callback function to run once completed.
 */
Map.prototype.render = function(bbox, callback) {
    // requires a localized, loaded map
    this.localize(function(err) {
        if (err) callback(err);
        this.map.render(bbox, callback);
    });
};

/**
 * Get a mapnik map from the pool
 *
 * @return {Object} mapnik map.
 */
Map.prototype.mapnik_map = function(callback) {
    try {
        var m = MapPool.get(this.mapfilePos(this.mapfile));
        callback(null, m)
    } catch (e) {
        callback(e);
    }
};

module.exports = Map;
