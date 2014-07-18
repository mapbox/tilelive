var concurrency = Math.ceil(require('os').cpus().length * 16);
var util = require('util');

module.exports = {};
module.exports.Tile = Tile;
module.exports.Info = Info;
module.exports.serializedType = serializedType;
module.exports.DeserializationError = DeserializationError;
module.exports.SerializationError = SerializationError;
module.exports.Stats = Stats;
module.exports.addChildren = addChildren;
module.exports.sumChildren = sumChildren;
module.exports.isEmpty = isEmpty;
module.exports.multiread = multiread;
module.exports.multiwrite = multiwrite;
module.exports.setConcurrency = setConcurrency;

function DeserializationError(msg) {
    Error.call(this, msg);
}
util.inherits(DeserializationError, Error);

function SerializationError(msg) {
    Error.call(this, msg);
}
util.inherits(DeserializationError, Error);

function Tile(z,x,y,buffer) {
    this.z = isNaN(z) ? undefined : Number(z);
    this.x = isNaN(x) ? undefined : Number(x);
    this.y = isNaN(y) ? undefined : Number(y);
    this.buffer = buffer instanceof Buffer ? buffer : new Buffer(0);
    return this;
}

Tile.prototype.serializedTypeId = 1;

Tile.prototype.serialize = function() {
    if (isNaN(this.z)) throw new SerializationError('z coord is invalid');
    if (isNaN(this.x)) throw new SerializationError('x coord is invalid');
    if (isNaN(this.y)) throw new SerializationError('y coord is invalid');

    var meta = new Buffer(7);
    meta.writeUInt8(this.serializedTypeId, 0);
    meta.writeUInt16LE(this.z, 1);
    meta.writeUInt16LE(this.x, 3);
    meta.writeUInt16LE(this.y, 5);

    return Buffer.concat([meta, this.buffer]);
};

Tile.prototype.deserialize = function(data) {
    if (!(data instanceof Buffer))
        throw new DeserializationError('must be a buffer');

    Tile.call(this,
        data.readUInt16LE(1),
        data.readUInt16LE(3),
        data.readUInt16LE(5),
        data.slice(7)
    );

    return this;
};

function Info(info) {
    for (var k in info) this[k] = info[k];
    return this;
}

Info.prototype.serializedTypeId = 2;

Info.prototype.serialize = function() {
    var data = JSON.stringify(this);
    var meta = new Buffer(1);
    meta.writeUInt8(this.serializedTypeId, 0);
    return Buffer.concat([meta, new Buffer(data)]);
};

Info.prototype.deserialize = function(data) {
    if (!(data instanceof Buffer))
        throw new DeserializationError('must be a buffer');

    try { obj = JSON.parse(data.slice(1)); }
    catch(err) { throw new DeserializationError('Could not parse data'); }

    Info.call(this, obj);
    return this;
};

function serializedType(data) {
    if (!(data instanceof Buffer)) throw new DeserializationError('data must be a buffer');
    var typeId = data.readUInt8(0);
    var lookup = {};
    lookup[Tile.prototype.serializedTypeId] = Tile;
    lookup[Info.prototype.serializedTypeId] = Info;

    if (!(typeId in lookup)) throw new DeserializationError('Invalid data');
    return new lookup[typeId]();
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
    concurrency = c;
}
