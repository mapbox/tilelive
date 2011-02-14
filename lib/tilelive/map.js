var fs = require('fs'),
    events = require('events'),
    Step = require('step'),
    carto = require('carto'),
    mapnik = require('mapnik'),
    Format = require('./format'),
    localized = {},
    locked = {};

// Map constructor
//
// - `mapfile` {String} URL or base64 encoded URL location of the mapfile.
// - `options` {Object} options
//   - `base64` {Boolean} whether the `mapfile` parameter is base64 encoded.
//   - `mapfile_dir` {String} path to where data files should be cached.
//   - `width` {Number} width of the map
//   - `height` {Number} height of the map
var Map = function(mapfile, options) {
    this.options = options || {};
    this.options.width = options.width || 256;
    this.options.height = options.height || 256;
    this.mapfile_dir = options.mapfile_dir || '/tmp';

    if (typeof options.base64 === 'undefined' || options.base64) {
        mapfile = mapfile.replace('_', '/').replace('-', '+');
        this.mapfile = (new Buffer(mapfile, 'base64').toString('utf-8'));
    } else {
        this.mapfile = mapfile;
    }
};

Map.__defineGetter__('mapfile_64', function() {
    return this.mapfile.toString('base64').replace('/', '_').replace('+', '-');
});

Map.prototype.safe64 = function(mapfile) {
    var b = new Buffer(mapfile, 'utf-8');
    return b.toString('base64').replace('/', '_').replace('+', '-');
};

Map.prototype.mapfilePos = function(mapfile) {
    return this.mapfile_dir + '/' + this.safe64(mapfile) + '.xml';
};

// Return whether the current mapfile is downloaded and completed
// TODO: make multi-process safe.
Map.prototype.localized = function(set) {
    if (typeof set !== 'undefined') {
        localized[this.mapfile] = set;
    }
    return localized[this.mapfile] ? true : false;
};

// Return whether the current mapfile is "locked", ie. currently
// being downloaded concurrently. If locked, returns an EventEmitter that
// emits an `unlock` event once the lock is released.
// TODO: make multi-process safe.
Map.prototype.locked = function(set, err) {
    if (typeof set !== 'undefined') {
        if (set) {
            locked[this.mapfile] = new events.EventEmitter();
        } else if (locked[this.mapfile]) {
            locked[this.mapfile].emit('unlock', err);
            locked[this.mapfile] = false;
        }
    }
    return locked[this.mapfile] ? locked[this.mapfile] : false;
};

// Initialize this map. Localizes the map and creates a mapnik map object.
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
    this.locked(true);
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

// Download and compile the mapfile to disk.
Map.prototype.localize = function(callback) {
    var that = this;
    Step(
        function() {
            try {
                var get = require('node-get');
                (new get(that.mapfile)).asString(this);
            } catch (err) {
                this(err, null);
            }
        },
        function(err, data) {
            if (err) return this(err);
            var renderer = new carto.Renderer({
                data_dir: that.mapfile_dir,
                optimization: false,
                validation_data: { fonts: mapnik.fonts() },
                filename: that.mapfile
            });
            renderer.render(data, this);
        },
        function(err, compiled) {
            if (err) return this(err);
            fs.writeFile(that.mapfilePos(that.mapfile), compiled, this);
        },
        function(err) {
            callback(err);
        }
    );
};

// Create a new mapnik map object at `this.mapnik`. Requires that the mapfile
// be localized.
Map.prototype.create = function() {
    if (this.mapnik) return true;

    this.mapnik = new mapnik.Map(
        this.options.width,
        this.options.height
    );
    try {
        this.mapnik.load(this.mapfilePos(this.mapfile));
        this.mapnik.buffer_size(128);
        return true;
    } catch (err) {
        return false;
    }
};

// Destroy this map's mapnik instance.
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
