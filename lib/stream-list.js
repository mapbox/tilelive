var sm = new (require('sphericalmercator'))();
var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var isEmpty = require('./stream-util').isEmpty;
var stream = require('stream');
var util = require('util');

module.exports = List;
util.inherits(List, stream.Duplex);

function List(source, options) {
    if (!source) throw new TypeError('Tilesource required');
    this.source = source;
    this.buffer = '';
    this.stats = new Stats();
    this.tiles = [];
    this.pending = 0;
    this.concurrency = options.concurrency || 10;

    // Determine when the writable stream is finished so the
    // readable stream can stop waiting.
    this.done = false;
    var s = this;
    this.on('finish', function() {
        s.done = true;
    });

    stream.Duplex.call(this, { objectMode:true });
}

List.prototype._write = function(obj, encoding, callback) {
    this.buffer += obj.toString('utf8');
    callback();
};

List.prototype._read = function(size) {
    var stream = this;

    if (stream.tiles.length) {
        push();
    } else {
        stream.once('_tile', push);
    }
    while ((stream.tiles.length + stream.pending) < stream.concurrency && get());

    function push() {
        if (stream.tiles.length) {
            stream.push(stream.tiles.shift());
        } else {
            stream.push(null);
        }
    }

    function get() {
        var next = stream.buffer.indexOf('\n');

        if (next !== -1) {
            var coord = stream.buffer.substr(0, next).split('/');
            var z = parseInt(coord[0],10);
            var x = parseInt(coord[1],10);
            var y = parseInt(coord[2],10);
            stream.buffer = stream.buffer.substr(next + 1);
        }

        if (next === -1 && stream.done && !stream.pending) {
            return stream.emit('_tile') && false;
        } else if (next === -1) {
            return setTimeout(get, 1) && false;
        } else if (next === -1) {
            return setTimeout(get, 1) && false;
        } else if (isNaN(z) || isNaN(x) || isNaN(y)) {
            return setTimeout(get, 1) && false;
        }

        stream.stats.ops++;
        stream.pending++;
        stream.source.getTile(z, x, y, function(err, buffer) {
            stream.pending--;
            if (err && !(/does not exist$/).test(err.message)) {
                stream.emit('error', err);
            } else if (err || isEmpty(buffer)) {
                stream.stats.skipped++;
                get();
            } else {
                stream.stats.stored++;
                stream.tiles.push(new Tile(z, x, y, buffer));
                stream.emit('_tile');
            }
        });

        return true;
    }
};

