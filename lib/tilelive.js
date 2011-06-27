var tilelive = exports;
var _ = require('underscore');
var path = require('path');
var url = require('url');
var Step = require('step');

tilelive.protocols = {
    'mbtiles:': require('mbtiles'),
    'tilejson:': require('tilejson')
};

tilelive.defaults = {
    id: null,
    name: '',
    description: '',
    version: "1.0.0",
    legend: null,
    scheme: "xyz",
    minzoom: -1,
    maxzoom: -1,
    bounds: null,
    center: null
};

// List all tile source URIs from all tile sources.
tilelive.list = function(source, callback) {
    if (typeof callback !== 'function') {
        throw new Error('Callback required as second argument');
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

    uri = url.parse(uri, true);

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

    var handler = new tilelive.protocols[uri.protocol](uri, function(err) {
        if (err) return callback(err);
        callback(null, handler);
    });
};

// Load a tilesource and retrieve metadata
tilelive.info = function(uri, callback) {
    if (typeof callback !== 'function') {
        throw new Error('Callback required as second argument');
    }

    tilelive.load(uri, function(err, handler) {
        if (err) return callback(err);
        handler.getInfo(function(err, data) {
            if (err) return callback(err);
            err = tilelive.verify(data);
            if (err) return callback(err);
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

    tilelive.list(source, function(err, uris) {
        if (err) return callback(err);
        if (!uris) return callback(null, []);

        Step(function() {
            var group = this.group();
            for (var id in uris) {
                tilelive.info(uris[id], group());
            }
        }, function(err, models) {
            // TODO: error reporting for individual failures?
            models = _.compact(models || []);
            models = _.sortBy(models, function(m) { return (m.name || m.id).toLowerCase(); });
            callback(null, models);
        });
    });
};

tilelive.verify = function(ts) {
    _(ts).defaults(tilelive.defaults);

    if (!ts.id) {
        return new Error("Tilesource has invalid ID");
    }

    // validates the retrieved settings.
    // Returns an error object when invalid, otherwise undefined.
    if (!(/^\d+\.\d+\.\d+$/).test(ts.version)) {
        return new Error("Tilesource has invalid version");
    }

    if (ts.attributions) {
        if (!Array.isArray(ts.attributions)) {
            return new Error("Tilesource has invalid attributions");
        }
        for (var i = 0; i < ts.attributions.length; i++) {
            if (!ts.attributions[i].text) {
                return new Error("Tilesource has invalid attribution text");
            }
            // TODO: validate URLs
        }
    }

    if (ts.scheme !== 'xyz' && ts.scheme !== 'tms') {
        return new Error("Tilesource has invalid scheme");
    }

    if (ts.minzoom < 0 || ts.minzoom > 22) {
        return new Error("Tilesource has invalid minzoom");
    }
    if (ts.maxzoom < 0 || ts.maxzoom > 22) {
        return new Error("Tilesource has invalid maxzoom");
    }
    if (ts.minzoom > ts.maxzoom) {
        return new Error("Tilesource's minzoom > maxzoom");
    }

    if (!Array.isArray(ts.bounds) || ts.bounds.length !== 4) {
        return new Error("Tilesource has invalid bounds");
    }
    if (ts.bounds[0] < -180 || ts.bounds[0] > 180) {
        return new Error("Tilesource's left bound is invalid");
    }
    if (ts.bounds[1] < -90 || ts.bounds[1] > 90) {
        return new Error("Tilesource's bottom bound is invalid");
    }
    if (ts.bounds[2] < -180 || ts.bounds[2] > 180) {
        return new Error("Tilesource's right bound is invalid");
    }
    if (ts.bounds[3] < -90 || ts.bounds[3] > 90) {
        return new Error("Tilesource's top bound is invalid");
    }

    if (Array.isArray(ts.center)) {
        if (ts.center.length !== 3) {
            return new Error("Tilesource has invalid center");
        }
        if (ts.center[0] < ts.bounds[0] || ts.center[0] > ts.bounds[2]) {
            return new Error("Tilesource has invalid longitude as center");
        }
        if (ts.center[1] < ts.bounds[1] || ts.center[1] > ts.bounds[3]) {
            return new Error("Tilesource has invalid latitude as center");
        }
        if (ts.center[2] < ts.minzoom || ts.center[2] > ts.maxzoom) {
            return new Error("Tilesource has invalid zoom as center");
        }
    } else if (ts.center !== null) {
        return new Error("Tilesource has invalid center");
    }
};
