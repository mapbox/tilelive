var sm = new (require('sphericalmercator'))();
var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var limitBounds = require('./stream-util').limitBounds;
var isEmpty = require('./stream-util').isEmpty;
var addChildren = require('./stream-util').addChildren;
var sumChildren = require('./stream-util').sumChildren;
var multiread = require('./stream-util').multiread;
var getTileRetry = require('./stream-util').getTileRetry;
var Readable = require('stream').Readable;
var util = require('util');
var validate = require('./tilelive.js').validate;

module.exports = Pyramid;
util.inherits(Pyramid, Readable);

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
    this.job = options.job || false;
    this.retry = options.retry || 0;
    this.firstz = Infinity;

    Readable.call(this, { objectMode: true });
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

        if (stream.job) {
            var dx = (stream.bounds[2] - stream.bounds[0]) / stream.job.total;
            stream.bounds = [
                stream.bounds[0] + stream.job.num * dx,
                stream.bounds[1],
                stream.bounds[0] + (stream.job.num + 1) * dx,
                stream.bounds[3]
            ];
        }

        stream.bboxes = {};
        var boundsArray = limitBounds(stream.bounds);
        var valid = validate({bounds:boundsArray});
        if (valid instanceof Error) return stream.emit('error', new Error(valid.message));

        for (var z = stream.minzoom; z <= stream.maxzoom; z++) {
            stream.bboxes[z] = sm.xyz(boundsArray, z);

            if (stream.bboxes[z].minX < 0) stream.bboxes[z].minX = 0;
            if (stream.bboxes[z].minY < 0) stream.bboxes[z].minY = 0;

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

Pyramid.prototype._read = function() {
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
            getTileRetry(stream.source, z, x, y, stream.retry, stream, done);
            // Do not repeat buffers in a pyramid fashion for now as
            // there are possible false positives in upstream solid
            // detection.
            //
            // if (queued.buffer) {
            //     done(null, queued.buffer);
            // } else {
            //     getTileRetry(stream.source, z, x, y, stream.retry, done);
            // }
            return true;
        } else if (stream.cursor) {
            z = stream.cursor.z;
            x = stream.cursor.x;
            y = stream.cursor.y;
            nextShallow(stream);
            stream.pending++;
            stream.stats.ops++;
            getTileRetry(stream.source, z, x, y, stream.retry, stream, done);
            return true;
        } else {
            return push(null) && false;
        }
        function done(err, buffer, headers) {
            headers = headers || {};
            stream.pending--;
            if (err && !(/does not exist$/).test(err.message)) {
                stream.emit('error', err);
            } else if (err || isEmpty(buffer)) {
                tile = new Tile(z, x, y);
                // stream.firstz flag marks the first zoom level where
                // the stream has had non-empty tiles. Skipping is not
                // permitted for zoom levels below this as source data
                // may not appear at all until this zoom level.
                var sum = 0;
                if ((z < stream.firstz) || headers['x-tilelive-contains-data']) {
                    addChildren(tile, stream.bboxes, stream.queue);
                } else {
                    sum = sumChildren(tile, stream.bboxes);
                }
                stream.stats.skipped += 1 + sum;
                stream.stats.done += 1 + sum;
                // Update length
                stream.length -= 1 + sum;
                stream.emit('length', stream.length);
                get(push);
            } else {
                stream.firstz = Math.min(stream.firstz, z);
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
