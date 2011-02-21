var fs = require('fs'),
    crypto = require('crypto'),
    events = require('events'),
    Step = require('step'),
    Format = require('./format'),
    path = require('path'),
    s64 = require('./safe64'),
    sys = require('sys'),
    localized = {},
    locked = {};

try { var get = require('node-get'); } catch (e) {
    sys.debug('tilelive.js: node-get not found.');
}

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
//   - `mapfile_dir` {String} path to where data files should be cached.
//   - `width` {Number} width of the map
//   - `height` {Number} height of the map
var Map = function(datasource, options) {
    this.options = options || {};
    this.language = options.language || 'carto';
    this.options.width = options.width || 256;
    this.options.height = options.height || 256;
    this.mapfile_dir = options.mapfile_dir || '/tmp';
    this.datasource = datasource;
};

// Find the mapfile on disk. If it's a URL, this will be
// the location of the downloaded Carto file. If it's a local path,
// this is the identity function.
//
// - @param {String} datasource.
// - @return {String} location.
Map.prototype.mapfilePos = function() {
    switch (this.dstype()) {
    case 'url':
        return this.mapfile_dir + '/' + s64.encode(this.datasource) + '.xml';
        break;
    case 'filename':
        if (this.language === 'xml') return this.datasource;
        return this.mapfile_dir + '/' + s64.encode(this.datasource) + '.xml';
        break;
    case 'literal':
        var hash = crypto
            .createHash('md5')
            .update(JSON.stringify(this.datasource))
            .digest('hex');
        return this.mapfile_dir + '/' + hash + '.xml';
        break;
    }
};

// Determine the type of datasource passed. Returns either:
// - `url` an http or https url
// - `filename` a filepath
// - `literal` a literal map representation, either XML string or JSON MML.
Map.prototype.dstype = function() {
    if (typeof this.datasource === 'string') {
        if (this.datasource.match(/^http/)) {
            return 'url';
        } else if (this.datasource.match(/^<\?xml/)) {
            return 'literal';
        } else {
            return 'filename';
        }
    } else {
        return 'literal';
    }
};

// TODO: make multi-process safe.
//
// Determine whether a datasource is localized.
Map.prototype.localized = function(set) {
    var id = this.mapfilePos();
    set && (localized[id] = set);
    return localized[id];
};

// Return whether the current mapfile is "locked", ie. currently
// being downloaded concurrently. If locked, returns an EventEmitter that
// emits an `unlock` event once the lock is released.
// TODO: make multi-process safe.
Map.prototype.locked = function(set, err) {
    var id = this.mapfilePos();
    if (typeof set !== 'undefined') {
        if (set) {
            locked[id] = new events.EventEmitter();
        } else if (locked[id]) {
            locked[id].emit('unlock', err);
            locked[id] = false;
        }
    }
    return locked[id] ? locked[id] : false;
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
    that.locked(true);
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

// Compile the datasource info a Mapnik XML mapfile with its dependencies
// (shapefiles, etc.) all in place. Will download (for URLs) and render (for
// Carto MML) if necessary or pass through appropriately. Calls `callback`
// when the mapfile can be expected to be in `mapfilePos`. If this isn't
// successful, `callback` gets an error as its first argument.
Map.prototype.localize = function(callback) {
    var that = this;
    Step(
        function() {
            switch (that.dstype()) {
            case 'url':
                // As of node-get 0.1.0, exceptions are no longer thrown
                (new get(that.datasource)).asString(this);
                break;
            case 'filename':
                fs.readFile(that.datasource, 'utf8', this);
                break;
            case 'literal':
                // Clone literal object to prevent mangling.
                this(null, JSON.parse(JSON.stringify(that.datasource)));
                break;
            }
        },
        function(err, data) {
            if (err) return this(err);
            if (that.language === 'carto') {
                var renderer = new carto.Renderer({
                    data_dir: that.mapfile_dir,
                    optimization: false,
                    validation_data: { fonts: mapnik.fonts() }
                });
                renderer.render(data, this);
            } else {
                this(null, data);
            }
        },
        function(err, compiled) {
            if (err) return this(err);
            fs.writeFile(that.mapfilePos(), compiled, this);
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
        this.mapnik.load(this.mapfilePos());
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
