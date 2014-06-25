module.exports = {};
module.exports.Tile = Tile;
module.exports.Info = Info;
module.exports.Stats = Stats;;
module.exports.addChildren = addChildren;
module.exports.sumChildren = sumChildren;
module.exports.isEmpty = isEmpty;
module.exports.preread = preread;

function Tile(z,x,y,buffer) {
    this.z = z;
    this.x = x;
    this.y = y;
    this.buffer = buffer;
    return this;
}

function Info(info) {
    for (var k in info) this[k] = info[k];
    return this;
}

function Stats() {
    this.ops = 0;
    this.total = 0;
    this.skipped = 0;
    this.stored = 0;
}

function addChildren(tile, bboxes, array) {
    var z = tile.z + 1;
    var x = tile.x * 2;
    var y = tile.y * 2;
    var bbox = bboxes[z];
    if (!bbox) return;
    if (y >= bbox.minY) {
        if (x >= bbox.minX) array.push(new Tile(z, x, y));
        if (x + 1 <= bbox.maxX) array.push(new Tile(z, x + 1, y));
    }
    if (y + 1 <= bbox.maxY) {
        if (x >= bbox.minX) array.push(new Tile(z, x, y + 1));
        if (x + 1 <= bbox.maxX) array.push(new Tile(z, x + 1, y + 1));
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

// Helper utility for _read functions. Pass your stream object and a
// getter that can be called concurrently and it will concurrently
// call your getter behind the scenes and manage the endstate of the
// stream.
function preread(stream, get) {
    if (stream._preread === undefined) {
        stream._preread = stream._preread || [];
        stream._prereading = stream._prereading || 0;
        stream._premax = stream._premax || 10;
    }
    if (stream._preread.length) {
        push();
    } else {
        stream.once('_push', push);
    }
    while ((stream._preread.length + stream._prereading) < stream._premax) {
        stream._prereading++;
        if (!get(done)) break;
    }

    function done(item) {
        stream._prereading--;
        if (item === null && !stream._prereading) {
            stream.emit('_push');
        } else if (item) {
            stream._preread.push(item);
            stream.emit('_push');
        }
    }

    function push() {
        if (stream._preread.length) {
            stream.push(stream._preread.shift());
        } else {
            stream.push(null);
        }
    }
}

