var tilelive = exports;
var path = require('path');
var url = require('url');
var util = require('util');
var os = require('os');
var EventEmitter = require('events').EventEmitter;

global.tileliveProtocols = global.tileliveProtocols || {};

// Add your protocol handlers here.
// 'mbtiles:': require('mbtiles')
tilelive.protocols = global.tileliveProtocols;

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
        return callback(new Error('Invalid tilesource protocol: ' + uri.protocol));
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
        [keyword, 'tilelive-' + keyword].forEach(function(name) {
            try {
                var mod = require(name);

                if (typeof(mod.registerProtocols) === 'function') {
                    mod.registerProtocols(tilelive);
                } else {
                    mod(tilelive);
                }
            } catch(err) {};
        });
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

tilelive.validate = function(info) {
    for (var key in info) {
        var val = info[key];
        switch (key) {
        // tilejson spec keys
        case 'scheme':
            if (typeof val !== 'string' || (val !== 'tms' && val !== 'xyz'))
                return new Error('scheme must be "tms" or "xyz"');
            break;
        case 'minzoom':
            if (typeof val !== 'number' || val < 0 || val > 22 || Math.floor(val) !== val)
                return new Error('minzoom must be an integer between 0 and 22');
            break;
        case 'maxzoom':
            if (typeof val !== 'number' || val < 0 || val > 22 || Math.floor(val) !== val)
                return new Error('maxzoom must be an integer between 0 and 22');
            break;
        case 'name':
        case 'version':
            if (typeof val !== 'string' || val.length > 255)
                return new Error(key + ' must be a string of 255 characters or less');
            break;
        case 'legend':
        case 'template':
        case 'attribution':
        case 'description':
            if (typeof val !== 'string' || val.length > 2000)
                return new Error(key + ' must be a string of 2000 characters or less');
            break;
        case 'tiles':
        case 'grids':
            if (!Array.isArray(val) || val.length <= 0)
                return new Error(key + ' must be an array of templated urls');
            for (var i = 0; i < val.length; i++) if (typeof val[i] !== 'string') {
                return new Error(key + ' must be an array of templated urls');
            }
            break;
        case 'center':
            if (!Array.isArray(val) || val.length !== 3)
                return new Error('center should be an array of the form [lon, lat, z]');
            if (typeof val[0] !== 'number' || val[0] < -180 || val[0] > 180)
                return new Error('center lon value must be between -180 and 180');
            if (typeof val[1] !== 'number' || val[1] < -90 || val[1] > 90)
                return new Error('center lat value must be between -90 and 90');
            if (typeof val[2] !== 'number' || val[2] < 0 || val[2] > 22 || Math.floor(val[2]) !== val[2])
                return new Error('center z value must be an integer between 0 and 22');
            break;
        case 'bounds':
            if (!Array.isArray(val) || val.length !== 4)
                return new Error('bounds should be an array of the form [west, south, east, north]');
            if (typeof val[0] !== 'number' || val[0] < -180 || val[0] > 180)
                return new Error('bounds west value must be between -180 and 180');
            if (typeof val[1] !== 'number' || val[1] < -90 || val[1] > 90)
                return new Error('bounds south value must be between -90 and 90');
            if (typeof val[2] !== 'number' || val[2] < -180 || val[2] > 180)
                return new Error('bounds east value must be between -180 and 180');
            if (typeof val[3] !== 'number' || val[3] < -90 || val[3] > 90)
                return new Error('bounds north value must be between -90 and 90');
            if (val[0] > val[2])
                return new Error('bounds west value must be less than or equal to east');
            if (val[1] > val[3])
                return new Error('bounds south value must be less than or equal to north');
            break;
        // additional keys around the tilejson/tilelive ecosystem
        case 'format':
            if (typeof val !== 'string' || val.length > 255)
                return new Error(key + ' must be a string of 255 characters or less');
            break;
        case 'source':
            if (typeof val !== 'string' || val.length > 2000)
                return new Error(key + ' must be a string of 2000 characters or less');
            break;
        case 'vector_layers':
            if (!Array.isArray(val) || val.length === 0)
                return new Error('vector_layers should be an array of layer info objects');
            for (var i = 0; i < val.length; i++) {
                var lkey = 'vector_layers[' + i + ']';
                if (typeof val[i] !== 'object')
                    return new Error(lkey + ' should be a layer info object');
                if (typeof val[i].id !== 'string' || val[i].id.length > 255)
                    return new Error(lkey + ' id should be a string of 255 characters or less');
            }
            break;
        }
    }

    // cross-key checks. these do not *require* keys -- only check certain
    // constraints if multiple keys are present.
    if ('minzoom' in info && 'maxzoom' in info && info.minzoom > info.maxzoom)
        return new Error('minzoom must be less than or equal to maxzoom');

    if ('center' in info && 'bounds' in info) {
        if (info.center[0] < info.bounds[0] || info.center[0] > info.bounds[2])
            return new Error('center lon value must be between bounds ' + info.bounds[0] + ' and ' + info.bounds[2]);
        if (info.center[1] < info.bounds[1] || info.center[1] > info.bounds[3])
            return new Error('center lat value must be between bounds ' + info.bounds[1] + ' and ' + info.bounds[3]);
    }

    if ('center' in info && 'minzoom' in info && info.center[2] < info.minzoom)
        return new Error('center zoom value must be less than minzoom ' + info.minzoom);
    if ('center' in info && 'maxzoom' in info && info.center[2] > info.maxzoom)
        return new Error('center zoom value must be greater than maxzoom ' + info.maxzoom);
};

tilelive.verify = function(ts) {
    // Let validate catch any invalid values.
    var err = tilelive.validate(ts);
    if (err) return err;

    // Verify is stricter, requiring certain keys.
    var required = ['scheme', 'minzoom', 'maxzoom', 'bounds', 'center'];
    for (var i = 0; i < required.length; i++) {
        if (!(required[i] in ts)) {
            return new Error(required[i] + ' is required');
        }
    }
};

// tilelive implementation of node readable/writable stream.
tilelive.createReadStream = function(source, options) {
    options = options || {};
    options.type = options.type || 'scanline';
    return new tilelive.streamTypes[options.type](source, options);
};

tilelive.createWriteStream = function(source, options) {
    options = options || {};
    options.type = options.type || 'put';
    return new tilelive.streamTypes[options.type](source, options);
};

tilelive.stream = require('./stream-util');

tilelive.streamTypes = {};
tilelive.streamTypes.put = require('./stream-put');
tilelive.streamTypes.pyramid = require('./stream-pyramid');
tilelive.streamTypes.scanline = require('./stream-scanline');
tilelive.streamTypes.list = require('./stream-list');
