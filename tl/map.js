var http = require('http'),
    url = require('url'),
    fs = require('fs'),
    libxmljs = require('libxmljs'),
    compress = require('compress'),
    Step = require('step'),
    MapPool = require('./mappool').MapPool,
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


// TODO: move to other library
Map.prototype.mapfilePos = function(mapfile) {
    // TODO: make mapfiles a setting
    return 'mapfiles/' + netlib.safe64(mapfile);
}

// TODO: move to other library
Map.prototype.externalPos = function(ext) {
    // TODO: make mapfiles a setting
    return '../externals/' + netlib.safe64(ext);
}


/**
 * Return whether the current mapfile is downloaded and completed
 * TODO: make multi-process safe
 */
Map.prototype.localized = function() {
    try {
        fs.statSync(this.mapfilePos(this.mapfile));
        return true;
    } catch(err) {
        return false;
    }
}

/**
 * Localize a mapfile - download core and related files
 *
 * @param Function callback to call once completed.
 */
Map.prototype.localize = function(callback) {
    if (!this.localized()) {
        var that = this; // TODO avoid
        this.localizeSelf(this.mapfile, function(err, mapfile, data) {
            that.localizeExternals(data, mapfile, callback);
        });
    } else {
        callback();
    }
};

/**
 * Download just a mapfile to the local host
 *
 * @param String mapfile the XML map file to download.
 * @param Function callback function to run once downloaded.
 */
Map.prototype.localizeSelf = function(mapfile, callback) {
    netlib.downloadAndGet(mapfile, this.mapfilePos(mapfile), callback);
};

/**
 * Download all files referenced by a mapfile
 *
 * @param String data string of XML data in a mapfile.
 * @param String mapfile name of mapfile this is modifying.
 * @param Function callback function to run once completed.
 */
Map.prototype.localizeExternals = function(data, mapfile, callback) {
    var doc = libxmljs.parseXmlString(data);
    var files = doc.find("//Parameter[@name='file']");
    var external_urls = [];
    var that = this;
    if (files) {
        for (var i = 0, l = files.length; i < l; i++) {
            external_urls.push(files[i].text());
            files[i].text(this.externalPos(files[i].text()));
        }
    }
    Step(function() {
        for (var i = 0, l = external_urls.length; i < l; i++) {
            netlib.download(external_urls[i],
                that.externalPos(external_urls[i]) + '.shp',
                this.parallel());
        }
    },
    function() {
        fs.writeFile(mapfile, doc.toString(), function() {
        callback();
        });
    });
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

/**
 * Get a mapnik map from the pool
 */
Map.prototype.mapnik_map = function() {
    return MapPool.get(this.mapfilePos(this.mapfile));
}

module.exports = { Map: Map };
