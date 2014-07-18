var sm = new (require('sphericalmercator'))();
var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var isEmpty = require('./stream-util').isEmpty;
var multiread = require('./stream-util').multiread;
var stream = require('stream');
var util = require('util');

module.exports = Scanline;
util.inherits(Scanline, stream.Readable);

function Scanline(source, options) {
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
    this.stats = new Stats();
    this.bboxes = undefined;
    this.cursor = undefined;
    this.length = 0;

    stream.Readable.call(this, { objectMode: true });
}

Scanline.prototype._params = function(callback) {
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

Scanline.prototype._read = function(size) {
    var stream = this;

    // Defer gets until info is retrieved and there is a cursor to be used.
    if (!stream.bboxes) return stream._params(function(err, info) {
        if (err) return stream.emit('error', err);
        stream.length = stream.stats.total;
        stream.emit('length', stream.length);
        stream.push(new Info(info));
    });

    multiread(stream, function get(push) {
        if (!stream.cursor) return push(null) && false;
        stream.stats.ops++;
        var z = stream.cursor.z;
        var x = stream.cursor.x;
        var y = stream.cursor.y;
        nextDeep(stream);
        stream.source.getTile(z, x, y, function(err, buffer) {
            if (err && !(/does not exist$/).test(err.message)) {
                stream.emit('error', err);
            } else if (err || !buffer || isEmpty(buffer)) {
                stream.stats.skipped++;
                stream.stats.done++;
                // Update length
                stream.length--;
                stream.emit('length', stream.length);
                get(push);
            } else {
                stream.stats.done++;
                push(new Tile(z, x, y, buffer));
            }
        });
        return true;
    });
};

// Increment a tile cursor to the next position,
// descending zoom levels until maxzoom is reached.
function nextDeep(stream) {
    if (!stream.cursor) return false;
    var cursor = stream.cursor;
    cursor.x++;
    var bbox = stream.bboxes[cursor.z];
    if (cursor.x > bbox.maxX) {
        cursor.x = bbox.minX;
        cursor.y++;
    }
    if (cursor.y > bbox.maxY) {
        cursor.z++;
        if (cursor.z > stream.maxzoom) {
            stream.cursor = false;
            return false;
        }
        bbox = stream.bboxes[cursor.z];
        cursor.x = bbox.minX;
        cursor.y = bbox.minY;
    }
    return true;
}

