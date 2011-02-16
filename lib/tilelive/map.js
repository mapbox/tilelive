var fs = require('fs'),
    events = require('events'),
    Step = require('step'),
    Format = require('./format'),
    get = require('node-get'),
    path = require('path'),
    s64 = require('./safe64'),
    localized = {},
    locked = {};

try { var mapnik = require('mapnik'); } catch (e) {
    sys.debug('tilelive.js: mapnik not found.');
}

try { var carto = require('carto'); } catch (e) {
    sys.debug('tilelive.js: carto not found.');
}

// Map constructor
//
// - `datasource` {String, Object} URL location of the datasource.
// - `options` {Object} options
//   - `base64` {Boolean} whether the `mapfile` parameter is base64 encoded.
//   - `mapfile_dir` {String} path to where data files should be cached.
//   - `width` {Number} width of the map
//   - `height` {Number} height of the map
var Map = function(datasource, options) {
    this.options = options || {};
    this.language = options.language || 'carto';
    this.options.width = options.width || 256;
    this.options.height = options.height || 256;
    this.mapfile_dir = options.mapfile_dir || '/tmp';

    if (options.base64) {
        this.datasource = s64.decode(datasource);
    } else {
        this.datasource = datasource;
    }
};

Map.__defineGetter__('mapfile_64', function() {
    return s64.decode(this.datasource);
});

// Find the mapfile on disk. If it's a URL, this will be
// the location of the downloaded Carto file. If it's a local path,
// this is the identity function.
//
// - @param {String} datasource.
// - @return {String} location.
Map.prototype.mapfilePos = function(datasource) {
    return (this.isUrl(datasource) || this.language !== 'xml') ?
        this.mapfile_dir + '/' + s64.encode(datasource) + '.xml' :
        datasource;
};

// Determine whether a string is a URL - http or https.
// 
// - @param {String} url.
// - @return {Bool}
Map.prototype.isUrl = function(url) {
    return (typeof url === 'string') && url.match(/^http/);
};

// TODO: make multi-process safe.
//
// Determine whether a datasource is localized. Local datasources
// are always localized.
Map.prototype.localized = function(set) {
    set && (localized[this.datasource] = set);
    // localized if it's localized
    return localized[this.datasource] ||
        // or if it's a local xml file
        (!this.isUrl(this.datasource) && this.language === 'xml');
};

// Return whether the current mapfile is "locked", ie. currently
// being downloaded concurrently. If locked, returns an EventEmitter that
// emits an `unlock` event once the lock is released.
// TODO: make multi-process safe.
Map.prototype.locked = function(set, err) {
    if (typeof set !== 'undefined') {
        if (set) {
            locked[this.datasource] = new events.EventEmitter();
        } else if (locked[this.datasource]) {
            locked[this.datasource].emit('unlock', err);
            locked[this.datasource] = false;
        }
    }
    return locked[this.datasource] ? locked[this.datasource] : false;
};

// Initialize this map. This wraps `localize()` so that it isn't
// repetitively called, and it calls `create()` afterwards to actually
// create a new Mapnik map object if necessary.
Map.prototype.initialize = function(callback) {
    var that = this;

    if (this.localized()) {
        that.create();
        return callback();
    } else if (this.locked()) {
        this.locked().on('unlock', function(err) {
            that.localized() && that.create();
            return callback(err);
        });
        return;
    }

    // The mapfile has not been localized. Lock.
    this.localize(function(err) {
        if (!err) {
            that.localized(true);
            that.create();
        }
        // Unlock the mapfile regardless of whether localization was successful
        // or not. Allows subsequent attempts rather than locking everyone out
        // after a random fail.
        that.locked(false, err);
        return callback(err);
    });
};

// Download and compile a Carto mapfile. This calls `callback` when the
// mapfile can be expected to be in `mapfilePos`, compiled with
// its dependencies (shapefiles, etc) all in place. If this isn't
// successful, `callback` gets an error as its first argument.
Map.prototype.localize = function(callback) {
    var that = this;
    Step(
        function() {
            // As of node-get 0.1.0, exceptions are no longer thrown
            that.isUrl(that.datasource) ?
                (new get(that.datasource)).asString(this) :
                fs.readFile(that.datasource, 'utf8', this);
        },
        function(err, data) {
            if (err) return this(err);
            var renderer = new carto.Renderer({
                data_dir: that.mapfile_dir,
                optimization: false,
                validation_data: { fonts: mapnik.fonts() },
                filename: that.datasource
            });
            renderer.render(data, this);
        },
        function(err, compiled) {
            if (err) return this(err);
            fs.writeFile(that.mapfilePos(that.datasource), compiled, this);
        },
        function(err) {
            callback(err);
        }
    );
};

// Create a new mapnik map object at `this.mapnik`. Requires that the mapfile
// be localized with `this.localize()`. This can be called in repetition because
// it won't recreate `this.mapnik`.
Map.prototype.create = function() {
    if (this.mapnik) return true;

    this.mapnik = new mapnik.Map(
        this.options.width,
        this.options.height
    );

    try {
        this.mapnik.load(this.mapfilePos(this.datasource));
        this.mapnik.buffer_size(128);
        return true;
    } catch (err) {
        return false;
    }
};

// Destroy this map's mapnik instance, first clearing out
// its references to datasources and then attempting to
// delete its memory.
Map.prototype.destroy = function() {
    if (!this.mapnik) return;
    this.mapnik.clear();
    delete this.mapnik;
};

// Render handler for a given tile request.
Map.prototype.render = function(tile, callback) {
    Format.select(tile.format)(tile, this.mapnik, callback);
};

module.exports = Map;
