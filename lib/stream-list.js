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
    this.bufferzxy = [];
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
    var next = this.buffer.indexOf('\n');
    while (next !== -1) {
        var coord = this.buffer.substr(0, next).split('/');
        var z = parseInt(coord[0],10);
        var x = parseInt(coord[1],10);
        var y = parseInt(coord[2],10);
        this.buffer = this.buffer.substr(next + 1);
        if (isNaN(z) || isNaN(x) || isNaN(y)) break;
        this.bufferzxy.push({z:z,x:x,y:y});
        this.stats.total++;
        next = this.buffer.indexOf('\n');
    }
    callback();
};

List.prototype._read = function(size) {
    var stream = this;

    multiread(stream, function get(push) {
        if (!stream.bufferzxy.length && stream.done && !stream.pending) {
            return push(null) && false;
        } else if (!stream.bufferzxy.length) {
            return setTimeout(function() { get(push); }, 1) && false;
        }
        var zxy = stream.bufferzxy.shift();
        stream.stats.ops++;
        stream.source.getTile(zxy.z, zxy.x, zxy.y, function(err, buffer) {
            if (err && !(/does not exist$/).test(err.message)) {
                stream.emit('error', err);
            } else if (err || !buffer || isEmpty(buffer)) {
                stream.stats.skipped++;
                stream.stats.done++;
                get(push);
            } else {
                stream.stats.done++;
                push(new Tile(zxy.z, zxy.x, zxy.y, buffer));
            }
        });

        return true;
    });
};

