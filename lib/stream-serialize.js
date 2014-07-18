var stream = require('stream');
var util = require('util');
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;

module.exports = Serialize;
util.inherits(Serialize, stream.Transform);

function Serialize() {
    stream.Transform.call(this);
    this._writableState.objectMode = true;
    this._readableState.objectMode = false;
}

Serialize.prototype._transform = function(chunk, enc, callback) {
    var id = chunk.serializedTypeId;

    if (id) {
        var data = chunk.serialize();
        var meta = new Buffer(4);
        meta.writeUInt32LE(data.length, 0);
        this.push(meta);
        this.push(data);
        callback();
    }
};
