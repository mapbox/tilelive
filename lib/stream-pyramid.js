var sm = new (require('sphericalmercator'))();
var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var isEmpty = require('./stream-util').isEmpty;
var addChildren = require('./stream-util').addChildren;
var sumChildren = require('./stream-util').sumChildren;
var stream = require('stream');
var util = require('util');

module.exports = Pyramid;
util.inherits(Pyramid, stream.Readable);

function Pyramid(source, options) {
    if (!source) throw new TypeError('Tilesource required');

    options = options || {};

    if ('bounds' in options && !Array.isArray(options.bounds))
        throw new TypeError('options.bounds must be an array of the form [w,s,e,n]');
    if ('minzoom' in options && typeof options.minzoom !== 'number')
        throw new TypeError('options.minzoom must be a positive integer');
    if ('maxzoom' in options && typeof options.maxzoom !== 'number')
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
    if (!stream.bboxes) {
        stream._params(function(err, info) {
            if (err) return stream.emit('error', err);
            stream.push(new Info(info));
        });
    } else {
        get();
    }

    function get() {
        var z, x, y, tile;
        if (!stream.cursor && !stream.pending && !stream.queue.length) {
            return stream.push(null);
        } else if (stream.queue.length) {
            var queued = stream.queue.shift();
            z = queued.z;
            x = queued.x;
            y = queued.y;
            stream.pending++;
            stream.source.getTile(z, x, y, done);
        } else if (stream.cursor) {
            z = stream.cursor.z;
            x = stream.cursor.x;
            y = stream.cursor.y;
            nextShallow(stream);
            stream.pending++;
            stream.source.getTile(z, x, y, done);
        } else {
            (global.setImmediate || process.nextTick)(function() { get(); });
        }
        function done(err, buffer) {
            if (err && !(/does not exist$/).test(err.message)) {
                stream.emit('error', err);
            } else if (err || isEmpty(buffer)) {
                tile = new Tile(z, x, y);
                stream.stats.skipped += 1 + sumChildren(tile, stream.bboxes);
                stream.pending--;
                get();
            } else {
                tile = new Tile(z, x, y, buffer);
                stream.stats.stored++;
                stream.push(tile);
                addChildren(tile, stream.bboxes, stream.queue);
                stream.pending--;
            }
        }
    }
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

