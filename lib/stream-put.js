var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var Writable = require('stream').Writable;
var util = require('util');
var multiwrite = require('./stream-util').multiwrite;
var putTileRetry = require('./stream-util').putTileRetry;

module.exports = Put;
util.inherits(Put, Writable);

function Put(source, options) {
    if (!source) throw new TypeError('Tilesource required');
    this.source = source;
    this.retry = options.retry || 0;

    // If source has no startWriting function, skip lazy initialization step.
    this.startWriting = source.startWriting === undefined;
    this._writing = 0;

    this.stats = new Stats();

    var s = this;
    // Because the writestream uses concurrent/multiwriting emit a special
    // 'stop' event which indicates stopWriting and all queued writes have
    // completed after the 'finish' event.
    this.on('finish', function() {
        return s._multiwriting ? s.once('_writeEmpty', stop) : stop();
        function stop() { return source.stopWriting ? source.stopWriting(done) : done(); }
        function done(err) {
            if (err) {
                s.emit('error', err);
            } else {
                s.emit('stop');
            }
        }
    });
    this.on('unpipe', function() {
        return s._multiwriting ? s.once('_writeEmpty', stop) : stop();
        function stop() { return source.stopWriting ? source.stopWriting(done) : done(); }
        function done(err) { if (err) s.emit('error', err); }
    });

    options.objectMode = true;
    Writable.call(this, options);
}

Put.prototype._write = function(obj, encoding, callback) {
    var stream = this;

    // Lazily call startWriting JIT.
    if (!stream.startWriting) return stream.source.startWriting(function(err) {
        if (err) return callback(err);
        stream.startWriting = true;
        stream._write(obj, encoding, callback);
    });

    multiwrite(stream, callback, function write(done) {
        if (obj instanceof Tile) {
            stream.stats.ops++;
            return putTileRetry(stream.source, obj.z, obj.x, obj.y, obj.buffer, stream.retry, stream, function(err) {
                if (err) return done(err);
                stream.stats.done++;
                done();
            });
        }
        if (obj instanceof Info) {
            stream.stats.ops++;
            return stream.source.putInfo(obj, function(err) {
                if (err) return done(err);
                stream.stats.done++;
                done();
            });
        }
    });
};
