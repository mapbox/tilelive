var sm = new (require('sphericalmercator'))();
var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var isEmpty = require('./stream-util').isEmpty;
var multiread = require('./stream-util').multiread;
var setConcurrency = require('./stream-util').setConcurrency;
var getTileRetry = require('./stream-util').getTileRetry;
var stream = require('stream');
var util = require('util');
var queue = require('queue-async');

module.exports = List;
util.inherits(List, stream.Transform);

function List(source, options) {
    if (!source) throw new TypeError('Tilesource required');
    this.source = source;
    this.buffer = '';
    this.bufferzxy = [];
    this.stats = new Stats();
    this.length = 0;
    this.job = options.job || false;
    this.retry = options.retry || 0;

    // Determine when the writable stream is finished so the
    // readable stream can stop waiting.
    this.done = false;
    var s = this;
    this.on('finish', function() {
        s.done = true;
    });

    stream.Transform.call(this, {});
    this._writableState.objectMode = false;
    this._readableState.objectMode = true;
}

List.prototype._transform = function(obj, encoding, callback) {
    this.buffer += obj.toString('utf8');
    var list = this;
    var stream = this;

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
        if (next === 0) {
            this.buffer = this.buffer.slice(1);
            next = this.buffer.indexOf('\n');
        }
        // Without a next known newline it's impossible to
        // know if the zxy coordinate is complete. We may
        // be at the end of the file but let _flush tell
        // us that.
        if (next === -1) {
            break;
        } else if (pushTile(this.buffer.slice(0, next))) {
            this.buffer = this.buffer.slice(next + 1);
        } else {
            return callback(new Error('Invalid tile coordinate ' + this.buffer.slice(0, next)));
        }
    }

    this.emit('length', this.length);

    if (!this.bufferzxy.length) return callback();

    var q = queue(setConcurrency());
    while (this.bufferzxy.length) q.defer(toTile, this.bufferzxy.shift());
    q.awaitAll(function(err) { callback(err); });

    function toTile(zxy, done) {
        stream.stats.ops++;

        if (stream.job && zxy.x % stream.job.total !== stream.job.num)
            return skip();

        getTileRetry(stream.source, zxy.z, zxy.x, zxy.y, stream.retry, function(err, buffer) {
            if (err && !(/does not exist$/).test(err.message)) {
                done(err);
            } else if (err || isEmpty(buffer)) {
                skip();
            } else {
                stream.stats.done++;
                stream.push(new Tile(zxy.z, zxy.x, zxy.y, buffer));
                done();
            }
        });

        function skip() {
            stream.stats.skipped++;
            stream.stats.done++;
            // Update length
            stream.length--;
            stream.emit('length', stream.length);
            done();
        }
    }
};

List.prototype._flush = function(callback) {
    this._transform('\n', 'utf8', callback);
};

