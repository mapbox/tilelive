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
    var next = this.buffer.indexOf('\n');

    if (next === -1 && this.done) {
        return stream.push(null);
    } else if (next === -1) {
        return setTimeout(function() { stream._read(size); }, 1);
    }

    var coord = this.buffer.substr(0, next).split('/');
    var z = parseInt(coord[0],10);
    var x = parseInt(coord[1],10);
    var y = parseInt(coord[2],10);

    this.buffer = this.buffer.substr(next + 1);
    this.source.getTile(z, x, y, function(err, buffer) {
        if (err && !(/does not exist$/).test(err.message)) {
            stream.emit('error', err);
        } else if (err || isEmpty(buffer)) {
            stream.stats.skipped++;
            get();
        } else {
            stream.stats.stored++;
            stream.push(new Tile(z, x, y, buffer));
        }
    });
};

