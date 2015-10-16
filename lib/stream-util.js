var concurrency = Math.ceil(require('os').cpus().length * 16);
var util = require('util');

module.exports = {};
module.exports.Tile = Tile;
module.exports.Info = Info;
module.exports.DeserializationError = DeserializationError;
module.exports.Stats = Stats;
module.exports.addChildren = addChildren;
module.exports.sumChildren = sumChildren;
module.exports.isEmpty = isEmpty;
module.exports.multiread = multiread;
module.exports.multiwrite = multiwrite;
module.exports.setConcurrency = setConcurrency;
module.exports.serialize = serialize;
module.exports.deserialize = deserialize;
module.exports.limitBounds = limitBounds;
module.exports.serialHeader = 'JSONBREAKFASTTIME';
module.exports.getTileRetry = getTileRetry;
module.exports.putTileRetry = putTileRetry;
module.exports.retryBackoff = 1000;
module.exports.slowTime = 10e3;

function DeserializationError(msg) {
    this.message = msg;
    this.name = 'DeserializationError';
}
util.inherits(DeserializationError, Error);

function Tile(z, x, y, buffer) {
    this.z = isNaN(z) ? undefined : Number(z);
    this.x = isNaN(x) ? undefined : Number(x);
    this.y = isNaN(y) ? undefined : Number(y);
    this.buffer = buffer instanceof Buffer ? buffer : undefined;
    return this;
}

function Info(info) {
    for (var k in info) this[k] = info[k];
    return this;
}

function serialize(obj) {
    if (obj instanceof Tile) return serializeTile(obj);
    if (obj instanceof Info) return serializeInfo(obj);
    return '';
}

function deserialize(data, property) {
    if (property) return getSerializedProperty(data, property);
    if (data.indexOf('{"z":') === 0) return deserializeTile(data);
    if (data.indexOf('{') === 0) return deserializeInfo(data);

    throw new DeserializationError('Invalid data');
}

function serializeTile(tile) {
    var obj = {
        z: isNaN(tile.z) ? null : Number(tile.z),
        x: isNaN(tile.x) ? null : Number(tile.x),
        y: isNaN(tile.y) ? null : Number(tile.y),
        buffer: tile.buffer instanceof Buffer ? tile.buffer.toString('base64') : null
    };

    return JSON.stringify(obj);
}

function serializeInfo(info) {
    return JSON.stringify(info);
}

function deserializeTile(data) {
    var obj, buf;

    try { obj = JSON.parse(data); }
    catch(err) { throw new DeserializationError('Could not parse data'); }

    if (!obj.hasOwnProperty('z') ||
        !obj.hasOwnProperty('x') ||
        !obj.hasOwnProperty('y') ||
        !obj.hasOwnProperty('buffer')) {
        throw new DeserializationError('Invalid data');
    }

    if (typeof obj.buffer === 'string' || typeof obj.buffer === 'number') {
        buf = new Buffer(obj.buffer, 'base64');
    } else {
        throw new DeserializationError('Invalid buffer');
    }

    return new Tile(obj.z, obj.x, obj.y, buf);
}

function getSerializedProperty(data, property) {
    var re = new RegExp('"' + property + '":(.+?)[,}]');
    var m = re.exec(data);
    return m ? m[1] : undefined;
}

function deserializeInfo(data) {
    try {
        var obj = JSON.parse(data);
        return new Info(obj);
    } catch(err) {
        throw new DeserializationError('Could not parse data');
    }
}

function Stats() {
    this.ops = 0;
    this.total = 0;
    this.done = 0;
    this.skipped = 0;
}

function addChildren(tile, bboxes, array) {
    var z = tile.z + 1;
    var x = tile.x * 2;
    var y = tile.y * 2;
    var b = tile.buffer && isSolid(tile.buffer) ? tile.buffer : null;

    var bbox = bboxes[z];
    if (!bbox) return;
    if (y >= bbox.minY) {
        if (x >= bbox.minX) array.unshift(new Tile(z, x, y, b));
        if (x + 1 <= bbox.maxX) array.unshift(new Tile(z, x + 1, y, b));
    }
    if (y + 1 <= bbox.maxY) {
        if (x >= bbox.minX) array.unshift(new Tile(z, x, y + 1, b));
        if (x + 1 <= bbox.maxX) array.unshift(new Tile(z, x + 1, y + 1, b));
    }
}

function sumChildren(tile, bboxes) {
    var sum = 0;
    var size = 1;
    for (var x = tile.x, y = tile.y, z = tile.z + 1; bboxes[z]; z++) {
        x *= 2; y *= 2; size *= 2;
        var width = Math.min(bboxes[z].maxX, x + size - 1) - Math.max(bboxes[z].minX, x) + 1;
        var height = Math.min(bboxes[z].maxY, y + size - 1) - Math.max(bboxes[z].minY, y) + 1;
        sum += width * height;
    }
    return sum;
}

function isEmpty(buffer) {
    return buffer.solid && buffer.solid.split(',')[3] === '0';
}

function isSolid(buffer) {
    return buffer.solid && buffer.solid.split(',')[3] !== '0';
}

// Helper utility for _read functions. Pass your stream object and a
// getter that can be called concurrently and it will concurrently
// call your getter behind the scenes and manage the endstate of the
// stream.
function multiread(stream, get) {
    if (stream._multiread === undefined) {
        stream._multiread = stream._multiread || [];
        stream._multireading = stream._multireading || 0;
        stream._multireadmax = stream._multireadmax || concurrency;
    }
    if (stream._multiread.length) {
        push();
    } else {
        stream.once('_push', push);
    }
    while ((stream._multiread.length + stream._multireading) < stream._multireadmax) {
        stream._multireading++;
        if (!get(done)) break;
    }

    function done(item) {
        stream._multireading--;
        if (item === null && !stream._multireading) {
            stream.emit('_push');
        } else if (item) {
            stream._multiread.push(item);
            stream.emit('_push');
        }
    }

    function push() {
        if (stream._multiread.length) {
            stream.push(stream._multiread.shift());
        } else {
            stream.push(null);
        }
    }
}

function multiwrite(stream, callback, put) {
    if (stream._multiwrite === undefined) {
        stream._multiwrite = stream._multiwrite || [];
        stream._multiwriting = stream._multiwriting || 0;
        stream._multiwritemax = stream._multiwritemax || concurrency;
    }
    stream._multiwriting++;
    if (stream._multiwriting < stream._multiwritemax) {
        callback();
    } else {
        stream.once('_write', callback);
    }

    put(function(err) {
        stream._multiwriting--;
        if (err) stream.emit('error', err);
        stream.emit('_write');
        if (!stream._multiwriting) stream.emit('_writeEmpty');
    });
}

function setConcurrency(c) {
    if (c) concurrency = c;
    return concurrency;
}


/**
 * Limit a bounding box to the [-180, -90, 180, 90] limits
 * of WGS84. We permit greater bounds for input data, since sometimes
 * GeoJSON and unusual shapefiles feature them, but we can't tile
 * beyond these bounds in XYZ, so we limit them.
 *
 * This method does not mutate its input, and it strongly expects
 * that its input is a valid type.
 *
 * @param {Array<Number>} bounds
 * @returns {Array<Number} bounds
 */
function limitBounds(bounds) {
    // acceptable ranges for each number in a bounding box
    var lon = [-180, 180], lat = [-90, 90], limits = [lon, lat, lon, lat];
    return bounds.map(function(_, i) {
        return Math.max(limits[i][0], Math.min(limits[i][1], _));
    });
}

function getTileRetry(source, z, x, y, tries, stream, callback) {
    tries = typeof tries === 'number' ? {
        max: tries,
        num: 0,
        startTime: new Date(),
        logged: false
    } : tries;
    source.getTile(z, x, y, function(err /*, tile, headers */) {
        // Get time taken and emit slow event if over the slowTime threshold.
        var time = new Date() - tries.startTime;
        if (!tries.logged && module.exports.slowTime && time > module.exports.slowTime) {
            tries.logged = true;
            stream.emit('slow', 'get', z, x, y, time);
        }

        if (err && err.message === 'Tile does not exist') {
            callback.apply(this, arguments);
        } else if (err && tries.num++ < tries.max) {
            setTimeout(function() {
                getTileRetry(source, z, x, y, tries, stream, callback);
            }, Math.pow(2, tries.num) * module.exports.retryBackoff);
        } else {
            callback.apply(this, arguments);
        }
    });
}

function putTileRetry(source, z, x, y, data, tries, stream, callback) {
    tries = typeof tries === 'number' ? {
        max: tries,
        num: 0,
        startTime: new Date(),
        logged: false
    } : tries;
    source.putTile(z, x, y, data, function(err) {
        // Get time taken and emit slow event if over the slowTime threshold.
        var time = new Date() - tries.startTime;
        if (!tries.logged && module.exports.slowTime && time > module.exports.slowTime) {
            tries.logged = true;
            stream.emit('slow', 'put', z, x, y, time);
        }

        if (err && tries.num++ < tries.max) {
            setTimeout(function() {
                putTileRetry(source, z, x, y, data, tries, stream, callback);
            }, Math.pow(2, tries.num) * module.exports.retryBackoff);
        } else {
            callback.apply(this, arguments);
        }
    });
}
