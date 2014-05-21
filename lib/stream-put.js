var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var stream = require('stream');
var util = require('util');

module.exports = Put;
util.inherits(Put, stream.Writable);

function Put(source, options) {
    if (!source) throw new TypeError('Tilesource required');
    this.source = source;

    // If source has no startWriting function, skip lazy initialization step.
    this.startWriting = source.startWriting === undefined;

    this.on('finish', function() {
        if (!source.stopWriting) return;
        source.stopWriting(function(err) {});
    });

    stream.Writable.call(this, { objectMode:true });
}

Put.prototype._write = function(obj, encoding, callback) {
    var stream = this;

    // Lazily call startWriting JIT.
    if (!stream.startWriting) {
        stream.source.startWriting(function(err) {
            if (err) return callback(err);
            stream.startWriting = true;
            write();
        });
    } else {
        write();
    }

    function write() {
        if (obj instanceof Tile) {
            return stream.source.putTile(obj.z, obj.x, obj.y, obj.buffer, callback);
        }
        if (obj instanceof Info) {
            return stream.source.putInfo(obj, callback);
        }
    }
};

