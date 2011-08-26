var tilelive = exports;
var _ = require('underscore');
var path = require('path');
var url = require('url');
var util = require('util');
var os = require('os');
var Queue = require('./queue');
var EventEmitter = require('events').EventEmitter;
var Step = require('step');
var sm = new (require('sphericalmercator'));

tilelive.protocols = {
    // Add your protocol handlers here.
    // 'mbtiles:': require('mbtiles')
};

tilelive.defaults = {
    id: null,
    name: '',
    description: '',
    version: "1.0.0",
    legend: null,
    scheme: "xyz",
    minzoom: 0,
    maxzoom: 22,
    bounds: [-180, -85.05112877980659, 180, 85.05112877980659],
    center: null
};

// List all tile source URIs from all tile sources.
tilelive.list = function(source, callback) {
    if (typeof callback !== 'function') {
        throw new Error('Callback required as second argument');
    }

    if (!Object.keys(tilelive.protocols).length) {
        return callback(new Error('No tilesource protocols defined'));
    }

    Step(function() {
        var group = this.group();
        for (var name in tilelive.protocols) {
            tilelive.protocols[name].list(source, group());
        }
    }, function(err, uris) {
        if (err) return callback(err);

        // Combine lists from all protocol sources, eliminating duplicate IDs.
        var result = {};
        for (var i = 0; i < uris.length; i++) {
            _.defaults(result, uris[i]);
        }
        callback(null, result);
    });
};

// Obtains a tile source URI from an ID, checking all tile source protocols
// until one is found.
tilelive.findID = function(source, id, callback) {
    if (typeof callback !== 'function') {
        throw new Error('Callback required as third argument');
    }
    var protocols = Object.keys(tilelive.protocols);
    check();
    function check(err, uri) {
        if (!protocols.length) {
            return callback(new Error('Tileset does not exist'));
        }
        tilelive.protocols[protocols.shift()].findID(source, id, function(err, uri) {
            if (err) check();
            else callback(null, uri);
        });
    }
};

tilelive.load = function(uri, callback) {
    if (typeof callback !== 'function') {
        throw new Error('Callback required as second argument');
    }

    if (typeof uri === 'string') uri = url.parse(uri, true);

    // Handle uris in the format /path/to/dir?id=bar
    if (!uri.protocol && uri.pathname && uri.query.id) {
        tilelive.findID(uri.pathname, uri.query.id, function(err, uri) {
            if (err) callback(err);
            else tilelive.load(uri, callback);
        });
        return;
    }

    if (!tilelive.protocols[uri.protocol]) {
        return callback(new Error('Invalid tilesource protocol'));
    }

    var handler = new tilelive.protocols[uri.protocol](uri, callback);
};

// Load a tilesource and retrieve metadata
tilelive.info = function(uri, callback) {
    if (typeof callback !== 'function') {
        throw new Error('Callback required as second argument');
    }

    tilelive.load(uri, function(err, handler) {
        if (err) return callback(err);
        handler.getInfo(function(err, data) {
            _(data).defaults(tilelive.defaults);
            if (err) return callback(err, data, handler);
            callback(null, data, handler);
        });
    });
};

// Load metadata for all tile source URIs.
// Ignore errors from loading individual models (e.g.
// don't let one bad apple spoil the collection).
tilelive.all = function(source, callback) {
    if (typeof callback !== 'function') {
        throw new Error('Callback required as second argument');
    }

    var handlers = [], models = [];
    tilelive.list(source, function(err, uris) {
        if (err) return callback(err);
        if (!uris) return callback(null, []);

        Step(function() {
            var group = this.group();
            for (var id in uris) {
                var next = group();
                tilelive.info(uris[id], function(err, data, handler) {
                    if (handler) handlers.push(handler);
                    if (!err && data) models.push(data);
                    next(err);
                });
            }
        }, function(err) {
            if (err) console.error(err.stack);
            var sorted = _.sortBy(_.zip(models, handlers), function(m) { return (m[0].name || m[0].id).toLowerCase(); });
            callback(null, _(sorted).pluck(0), _(sorted).pluck(1));
        });
    });
};

tilelive.verify = function(ts, handler) {
    if (!ts.id) {
        return new Error("Tilesource has invalid ID: " + util.inspect(ts.id));
    }

    // validates the retrieved settings.
    // Returns an error object when invalid, otherwise undefined.
    if (!(/^\d+(\.\d+){0,2}$/).test(ts.version)) {
        return new Error("Tilesource has invalid version: " + util.inspect(ts.version));
    }

    if (ts.scheme !== 'xyz' && ts.scheme !== 'tms') {
        return new Error("Tilesource has invalid scheme: " + util.inspect(ts.scheme));
    }

    if (ts.minzoom < 0 || ts.minzoom > 22) {
        return new Error("Tilesource has invalid minzoom: " + util.inspect(ts.minzoom));
    }
    if (ts.maxzoom < 0 || ts.maxzoom > 22) {
        return new Error("Tilesource has invalid maxzoom: " + util.inspect(ts.maxzoom));
    }
    if (ts.minzoom > ts.maxzoom) {
        return new Error("Tilesource's minzoom > maxzoom");
    }

    if (!Array.isArray(ts.bounds) || ts.bounds.length !== 4) {
        return new Error("Tilesource has invalid bounds: " + util.inspect(ts.bounds));
    }
    if (ts.bounds[0] < -180 || ts.bounds[0] > 180) {
        return new Error("Tilesource's west bound is invalid: " + util.inspect(ts.bounds));
    }
    if (ts.bounds[2] < -180 || ts.bounds[2] > 180) {
        return new Error("Tilesource's east bound is invalid: " + util.inspect(ts.bounds));
    }
    // @TODO these should actually be checked against
    // +-85.05112877980659 but some mbtiles may be using +-90 which
    // may not be worth failure.
    if (ts.bounds[1] < -90 || ts.bounds[1] > 90) {
        return new Error("Tilesource's south bound is invalid: " + util.inspect(ts.bounds));
    }
    if (ts.bounds[3] < -90 || ts.bounds[3] > 90) {
        return new Error("Tilesource's north bound is invalid: " + util.inspect(ts.bounds));
    }

    if (Array.isArray(ts.center)) {
        if (ts.center.length !== 3) {
            return new Error("Tilesource has invalid center: " + util.inspect(ts.center));
        }
        if (ts.center[0] < ts.bounds[0] || ts.center[0] > ts.bounds[2]) {
            return new Error("Tilesource has invalid longitude as center: " + util.inspect(ts.center));
        }
        if (ts.center[1] < ts.bounds[1] || ts.center[1] > ts.bounds[3]) {
            return new Error("Tilesource has invalid latitude as center: " + util.inspect(ts.center));
        }
        if (ts.center[2] < ts.minzoom || ts.center[2] > ts.maxzoom) {
            return new Error("Tilesource has invalid zoom as center: " + util.inspect(ts.center));
        }
    } else if (ts.center !== null) {
        return new Error("Tilesource has invalid center: " + util.inspect(ts.center));
    }
};

function totalTiles(x, y, z) {
    for (var total = 0, i = 0; i <= z; i++, x *= 2, y *= 2) {
        total += x * y;
    }
    return total;
}

tilelive.copy = function(args, callback) {
    if (typeof args.source.getTile !== 'function') throw new Error('source must implement the tilesource interface');
    if (typeof args.sink.putTile !== 'function') throw new Error('sink must implement the tilesink interface');
    if (!Array.isArray(args.bbox) || args.bbox.length !== 4) throw new Error('bbox must have four lat/long coordinates');
    if (args.bbox[0] < -180) throw new Error('bbox has invalid west value');
    if (args.bbox[1] < -85.05112877980659) throw new Error('bbox has invalid south value');
    if (args.bbox[2] > 180) throw new Error('bbox has invalid east value');
    if (args.bbox[3] > 85.05112877980659) throw new Error('bbox has invalid north value');
    if (args.bbox[0] > args.bbox[2]) throw new Error('bbox is invalid');
    if (args.bbox[1] > args.bbox[3]) throw new Error('bbox is invalid');
    if (typeof args.minZoom !== 'number') throw new Error('minZoom must be a number');
    if (typeof args.maxZoom !== 'number') throw new Error('maxZoom must be a number');
    if (typeof args.concurrency !== 'number') args.concurrency = os.cpus().length * 25;
    if (typeof callback !== 'function') callback = function() {};

    if (!args.tiles && !args.grids) throw new Error('You must copy at least grids or tiles (or both)');

    if (args.minZoom < 0) throw new Error('minZoom must be >= 0');
    if (args.maxZoom > 22) throw new Error('maxZoom must be <= 22');
    if (args.minZoom > args.maxZoom) throw new Error('maxZoom must be >= minZoom');

    var action = new EventEmitter;

    action.copied = 0;
    action.failed = 0;
    action.total = 0;
    action.started = Date.now();
    action.on('finished', callback);

    // Precalculate the tile int bounds for each zoom level.
    var bounds = {};
    for (var z = args.minZoom; z <= args.maxZoom; z++) {
        bounds[z] = sm.xyz(args.bbox, z);
        action.total += (bounds[z].maxX - bounds[z].minX + 1) *
                        (bounds[z].maxY - bounds[z].minY + 1);
    }

    // We have twice the amount of things to copy when we copy both.
    if (args.grids && args.tiles) action.total *= 2;

    // Sets z, x and y to the next tile.
    var z = args.minZoom;

    // Start out one tile left to the starting position because we increment
    // as the first action in the id() function.
    var x = bounds[z].minX - 1;
    var y = bounds[z].minY;

    if (args.source.metatile > 1) {
        var boxSize = args.source.metatile, boxLeft, boxTop, boxLeft, boxBottom;
        var resetID = function() {
            boxLeft = x - x % boxSize;
            boxRight = boxLeft + boxSize;
            boxTop = y - y % boxSize;
            boxBottom = boxTop + boxSize;
        }
        resetID(); // Initialize.
        var id = function() {
            if (z > args.maxZoom) return false;

            ++x;
            if (x >= boxRight || x > bounds[z].maxX) { // Start the next row in this metatile.
                x = Math.max(boxLeft, bounds[z].minX);
                y++;
            }
            if (y >= boxBottom || y > bounds[z].maxY) { // Start the next metatile in this row.
                boxLeft += boxSize;
                boxRight = boxLeft + boxSize;
                x = boxLeft;
                y = Math.max(boxTop, bounds[z].minY);
            }
            if (x > bounds[z].maxX) { // Start the next metatile row.
                x = bounds[z].minX;
                y = boxBottom;
                resetID();
            }
            if (y > bounds[z].maxY) { // All rows in this zoom level are exhausted.
                if (++z > args.maxZoom) return false;
                x = bounds[z].minX;
                y = bounds[z].minY;
                resetID();
            }
            return true;
        };

    } else {
        var id = function() {
            if (z > args.maxZoom) return false;

            if (++x > bounds[z].maxX) {
                x = bounds[z].minX;
                y++;
            }
            if (y > bounds[z].maxY) {
                if (++z > args.maxZoom) return false;
                x = bounds[z].minX;
                y = bounds[z].minY;
            }
            return true;
        };
    }

    function copy(type, z, x, y, callback) {
        var get = type === 'grid' ? 'getGrid' : 'getTile';
        var put = type === 'grid' ? 'putGrid' : 'putTile';
        args.source[get](z, x, y, function(err, data) {
            if (err) {
                action.failed++;
                action.emit('warning', err);
                return callback();
            } else {
                args.sink[put](z, x, y, data, function(err) {
                    if (err) {
                        action.failed++;
                        action.emit('warning', err);
                    } else {
                        action.copied++;
                    }
                    callback();
                });
            }
        });
    }

    var q = new Queue(function(coords, next) {
        // Make sure there's something in the queue.
        if (id()) q.add([z, x, y]);

        Step(function() {
            if (args.tiles) copy('tile', coords[0], coords[1], coords[2], this.parallel());
            if (args.grids) copy('grid', coords[0], coords[1], coords[2], this.parallel());
        }, next);
    }, args.concurrency);

    args.sink.startWriting(function(err) {
        if (err) return action.emit('error', err);

        // Once the queue is empty, all tiles have been copied.
        q.on('empty', function() {
            args.sink.stopWriting(function(err) {
                if (err) {
                    action.emit('error', err);
                } else {
                    action.emit('finished');
                }
            });
        });

        // Fill the queue.
        for (var i = args.concurrency; i && id(); i--) {
            q.add([z, x, y]);
        }
    });

    return action;
};
