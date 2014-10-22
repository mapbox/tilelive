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
    this.length = 0;
    this.job = options.job || false;

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
    var list = this;

    function pushTile(str) {
        var coord = str.split('/');

        var z = parseInt(coord[0],10);
        var x = parseInt(coord[1],10);
        var y = parseInt(coord[2],10);
        if (isNaN(z) || isNaN(x) || isNaN(y)) return false;

        list.bufferzxy.push({z:z,x:x,y:y});
        list.stats.total++;
        list.length++;
        return true;
    }

    while (this.buffer.length) {
        var next = this.buffer.indexOf('\n');
        if (next === -1) next = this.buffer.length;
        if (pushTile(this.buffer.slice(0, next)))
            this.buffer = this.buffer.slice(next + 1);
        else break;
    }

    this.emit('length', this.length);
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

        if (stream.job && zxy.x % stream.job.total !== stream.job.num)
            return skip();

        stream.source.getTile(zxy.z, zxy.x, zxy.y, function(err, buffer) {
            if (err && !(/does not exist$/).test(err.message)) {
                stream.emit('error', err);
            } else if (err || isEmpty(buffer)) {
                skip();
            } else {
                stream.stats.done++;
                push(new Tile(zxy.z, zxy.x, zxy.y, buffer));
            }
        });

        function skip() {
            stream.stats.skipped++;
            stream.stats.done++;
            // Update length
            stream.length--;
            stream.emit('length', stream.length);
            get(push);
        }

        return true;
    });
};
