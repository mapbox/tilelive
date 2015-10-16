var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var isEmpty = require('./stream-util').isEmpty;
var setConcurrency = require('./stream-util').setConcurrency;
var getTileRetry = require('./stream-util').getTileRetry;
var Transform = require('stream').Transform;
var util = require('util');
var queue = require('queue-async');

module.exports = List;
util.inherits(List, Transform);

function List(source, options) {
    if (!source) throw new TypeError('Tilesource required');
    this.source = source;
    this.buffer = '';
    this.bufferzxy = [];
    this.stats = new Stats();
    this.length = 0;
    this.job = options.job || false;
    this.retry = options.retry || 0;

    Transform.call(this, {});
    this._writableState.objectMode = false;
    this._readableState.objectMode = true;
}

List.prototype._transform = function(chunk, encoding, callback) {
    var lines = (this.buffer + chunk.toString('utf8')).split(/\r?\n/);
    this.buffer = lines.pop();
    while (lines.length) {
        var err = this._pushTile(lines.shift());
        if (err) return callback(err);
    }
    this._readTiles(callback);
};

List.prototype._flush = function(callback) {
    var err = this._pushTile(this.buffer);
    if (err) return callback(err);
    this._readTiles(callback);
};

List.prototype._pushTile = function(str) {
    if (!str) return;

    var coord = str.split('/');
    var z = parseInt(coord[0], 10);
    var x = parseInt(coord[1], 10);
    var y = parseInt(coord[2], 10);
    if (isNaN(z) || isNaN(x) || isNaN(y))
        return new Error('Invalid tile coordinate ' + str);

    this.bufferzxy.push({z:z, x:x, y:y});
    this.stats.total++;
    this.length++;
};

List.prototype._readTiles = function(callback) {
    var stream = this;

    this.emit('length', this.length);

    if (!this.bufferzxy.length) return callback();

    var q = queue(setConcurrency());
    while (this.bufferzxy.length) q.defer(toTile, this.bufferzxy.shift());
    q.awaitAll(function(err) { callback(err); });

    function toTile(zxy, done) {
        stream.stats.ops++;

        if (stream.job && zxy.x % stream.job.total !== stream.job.num)
            return skip();

        getTileRetry(stream.source, zxy.z, zxy.x, zxy.y, stream.retry, stream, function(err, buffer) {
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
