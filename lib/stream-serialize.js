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
    this._buffer = [];
}

Serialize.prototype._transform = function(chunk, enc, callback) {
    var data = this._buffer.pop();
    if (data) this.push(data + '\n');
    if (chunk instanceof Tile || chunk instanceof Info) this._buffer.push(chunk.serialize());
    callback();
};

Serialize.prototype._flush = function(callback) {
    var data = this._buffer.pop();
    if (data) this.push(data);
    callback();
};
