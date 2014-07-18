var sm = new (require('sphericalmercator'))();
var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var isEmpty = require('./stream-util').isEmpty;
var addChildren = require('./stream-util').addChildren;
var sumChildren = require('./stream-util').sumChildren;
var multiread = require('./stream-util').multiread;
var stream = require('stream');
var util = require('util');

module.exports = Pyramid;
util.inherits(Pyramid, stream.Readable);

function Pyramid(source, options) {
    if (!source) throw new TypeError('Tilesource required');

    options = options || {};

    if (options.bounds !== undefined && !Array.isArray(options.bounds))
        throw new TypeError('options.bounds must be an array of the form [w,s,e,n]');
    if (options.minzoom !== undefined && typeof options.minzoom !== 'number')
        throw new TypeError('options.minzoom must be a positive integer');
    if (options.maxzoom !== undefined && typeof options.maxzoom !== 'number')
        throw new TypeError('options.maxzoom must be a positive integer');

    this.source = source;
    this.bounds = options.bounds;
    this.minzoom = options.minzoom;
    this.maxzoom = options.maxzoom;
    this.pending = 0;
    this.queue = [];
    this.bboxes = undefined;
    this.cursor = undefined;
    this.stats = new Stats();
    this.length = 0;

    stream.Readable.call(this, { objectMode: true });
}

Pyramid.prototype._params = function(callback) {
    var stream = this;
    stream.source.getInfo(function(err, info) {
        if (err) return stream.emit('error', err);
        stream.bounds = stream.bounds !== undefined ? stream.bounds : info.bounds;
        stream.minzoom = stream.minzoom !== undefined ? stream.minzoom : info.minzoom;
        stream.maxzoom = stream.maxzoom !== undefined ? stream.maxzoom : info.maxzoom;
        if (stream.bounds === undefined) return stream.emit('error', new Error('No bounds determined'));
        if (stream.minzoom === undefined) return stream.emit('error', new Error('No minzoom determined'));
        if (stream.maxzoom === undefined) return stream.emit('error', new Error('No maxzoom determined'));

        stream.bboxes = {};
        for (var z = stream.minzoom; z <= stream.maxzoom; z++) {
            stream.bboxes[z] = sm.xyz(stream.bounds, z);
            stream.stats.total +=
                (stream.bboxes[z].maxX - stream.bboxes[z].minX + 1) *
                (stream.bboxes[z].maxY - stream.bboxes[z].minY + 1);
        }

        stream.cursor = {
            z: stream.minzoom,
            x: stream.bboxes[stream.minzoom].minX,
            y: stream.bboxes[stream.minzoom].minY
        };

        callback(null, info);
    });
};

Pyramid.prototype._read = function(size) {
    var stream = this;

    // Defer gets until info is retrieved and there is a cursor to be used.
    if (!stream.bboxes) return stream._params(function(err, info) {
        if (err) return stream.emit('error', err);
        stream.length = stream.stats.total;
        stream.emit('length', stream.length);
        stream.push(new Info(info));
    });

    multiread(stream, function get(push) {
        var z, x, y, tile;
        if (stream.queue.length) {
            var queued = stream.queue.shift();
            z = queued.z;
            x = queued.x;
            y = queued.y;
            stream.pending++;
            stream.stats.ops++;
            if (queued.buffer) {
                done(null, queued.buffer);
            } else {
                stream.source.getTile(z, x, y, done);
            }
            return true;
        } else if (stream.cursor) {
            z = stream.cursor.z;
            x = stream.cursor.x;
            y = stream.cursor.y;
            nextShallow(stream);
            stream.pending++;
            stream.stats.ops++;
            stream.source.getTile(z, x, y, done);
            return true;
        } else {
            return push(null) && false;
        }
        function done(err, buffer) {
            stream.pending--;
            if (err && !(/does not exist$/).test(err.message)) {
                stream.emit('error', err);
            } else if (err || !buffer || isEmpty(buffer)) {
                tile = new Tile(z, x, y);
                var sum = sumChildren(tile, stream.bboxes);
                stream.stats.skipped += 1 + sum;
                stream.stats.done += 1 + sum;
                // Update length
                stream.length -= 1 + sum;
                stream.emit('length', stream.length);
                get(push);
            } else {
                tile = new Tile(z, x, y, buffer);
                addChildren(tile, stream.bboxes, stream.queue);
                stream.stats.done++;
                push(tile);
            }
        }
    });
};

// Increment a tile cursor to the next position on the lowest zoom level.
function nextShallow(stream) {
    if (!stream.cursor) return false;
    var cursor = stream.cursor;
    cursor.x++;
    var bbox = stream.bboxes[cursor.z];
    if (cursor.x > bbox.maxX) {
        cursor.x = bbox.minX;
        cursor.y++;
    }
    if (cursor.y > bbox.maxY) {
        stream.cursor = false;
        return false;
    }
    return true;
}

