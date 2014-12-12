var sm = new (require('sphericalmercator'))();
var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var isEmpty = require('./stream-util').isEmpty;
var multiread = require('./stream-util').multiread;
var setConcurrency = require('./stream-util').setConcurrency;
var stream = require('stream');
var util = require('util');
var queue = require('queue-async');

module.exports = List;
util.inherits(List, stream.Transform);

function List(source, options) {
    if (!source) throw new TypeError('Tilesource required');

    var concurrency = setConcurrency();

    this.source = source;
    this.buffer = '';
    this.stats = new Stats();
    this.length = 0;
    this.job = options.job || false;
    this.queue = queue(concurrency);

    stream.Transform.call(this, {});
    this._writableState.objectMode = false;
    this._readableState.objectMode = true;

    this.bufferzxy = [];
    this.bufferzxy.highWaterMark = 2 * concurrency;
}

List.prototype._transform = function(chunk, encoding, callback) {
    this.buffer += chunk.toString('utf8');
    var stream = this;
    var q = queue(1);

    this.buffer.split('\n').forEach(function(str, i, coords) {
        var coord = str.split('/');
        var z = parseInt(coord[0], 10);
        var x = parseInt(coord[1], 10);
        var y = parseInt(coord[2], 10);

        if (isNaN(z) || isNaN(x) || isNaN(y)) {
            if (i === coords.length - 1) stream.buffer = str;
            return;
        }

        coord = { z: z, x: x, y: y };
        stream.stats.total++;
        stream.length++;

        q.defer(pushTile, coord);
    });

    q.await(function(err) {
        stream.emit('length', this.length);
        callback(err);
    });

    function pushTile(coords, pushed) {
        if (stream.bufferzxy.length > stream.bufferzxy.highWaterMark) {
            return setImmediate(function() { pushTile(str, pushed); });
        }

        stream.bufferzxy.push(coords);
        stream.queue.defer(toTile, stream.bufferzxy.shift(), stream);
        pushed();
    }
};

List.prototype._flush = function(callback) {
    while (this.bufferzxy.length) this.queue.defer(toTile, this.bufferzxy.shift(), this);
    this.queue.await(callback);
};

function toTile(zxy, stream, done) {
    if (!zxy) return done();

    stream.stats.ops++;

    if (stream.job && zxy.x % stream.job.total !== stream.job.num)
        return skip();

    stream.source.getTile(zxy.z, zxy.x, zxy.y, function(err, buffer) {
        stream.queue.defer(toTile, stream.bufferzxy.shift(), stream);

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
