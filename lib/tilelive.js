var tilelive = exports;
var path = require('path');
var url = require('url');
var util = require('util');
var os = require('os');
var Queue = require('./queue');
var EventEmitter = require('events').EventEmitter;
var CopyTask = require('./copytask');
var Scheme = require('./scheme');
var sm = new (require('sphericalmercator'));

tilelive.CopyTask = CopyTask;
tilelive.Scheme = Scheme;

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

    var result = {};
    var queue = Object.keys(tilelive.protocols);
    var load = function() {
        if (!queue.length) return callback(null, result);
        tilelive.protocols[queue.shift()].list(source, function(err, uris) {
            if (err) return callback(err);
            if (uris) for (var key in uris) {
                if (result[key] == null) result[key] = uris[key];
            }
            load();
        });
    };
    load();
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

tilelive.auto = function(uri) {
    uri = url.parse(uri);

    // Attempt to load any modules that may match keyword pattern.
    var keyword = uri.protocol
        ? uri.protocol.replace(':','')
        : path.extname(uri.pathname).replace('.','');
    uri.protocol = uri.protocol || keyword + ':';

    if (!tilelive.protocols[uri.protocol]) {
        try { require(keyword).registerProtocols(tilelive); } catch(err) {};
        try { require('tilelive-' + keyword).registerProtocols(tilelive); } catch(err) {};
    }

    return uri;
};

// Load a tilesource and retrieve metadata
tilelive.info = function(uri, callback) {
    if (typeof callback !== 'function') {
        throw new Error('Callback required as second argument');
    }

    tilelive.load(uri, function(err, handler) {
        if (err) return callback(err);
        handler.getInfo(function(err, data) {
            if (data) {
                for (var key in tilelive.defaults) {
                    if (data[key] == null) data[key] = tilelive.defaults[key];
                }
                callback(err, data, handler);
            } else {
                callback(err);
            }
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

    tilelive.list(source, function(err, uris) {
        if (err) return callback(err);
        if (!uris || !Object.keys(uris).length) return callback(null, []);

        var result = [];
        var remaining = Object.keys(uris).length;
        for (var id in uris) {
            tilelive.info(uris[id], function(err, data, handler) {
                if (err) console.error(err.stack);
                if (!err && data && handler) result.push([data, handler]);
                if (!--remaining) {
                    result.sort(function(a, b) {
                        return (a[0].name||a[0].id).toLowerCase() < (b[0].name||b[0].id).toLowerCase() ? -1 : 1;
                    });
                    var models = result.map(function(r) { return r[0] });
                    var handlers = result.map(function(r) { return r[1] });
                    callback(null, models, handlers);
                }
            });
        }
    });
};

tilelive.verify = function(ts) {
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

