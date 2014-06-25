var sm = new (require('sphericalmercator'))();
var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var isEmpty = require('./stream-util').isEmpty;
var multiread = require('./stream-util').multiread;
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

    multiread(stream, function get(push) {
        var next = stream.buffer.indexOf('\n');

        if (next !== -1) {
            var coord = stream.buffer.substr(0, next).split('/');
            var z = parseInt(coord[0],10);
            var x = parseInt(coord[1],10);
            var y = parseInt(coord[2],10);
            stream.buffer = stream.buffer.substr(next + 1);
        }

        if (next === -1 && stream.done && !stream.pending) {
            return push(null) && false;
        } else if (next === -1) {
            return setTimeout(function() { get(push); }, 1) && false;
        } else if (isNaN(z) || isNaN(x) || isNaN(y)) {
            return setTimeout(function() { get(push); }, 1) && false;
        }

        stream.stats.ops++;
        stream.source.getTile(z, x, y, function(err, buffer) {
            if (err && !(/does not exist$/).test(err.message)) {
                stream.emit('error', err);
            } else if (err || isEmpty(buffer)) {
                stream.stats.skipped++;
                stream.stats.done++;
                get(push);
            } else {
                stream.stats.done++;
                push(new Tile(z, x, y, buffer));
            }
        });

        return true;
    });
};

