var stream = require('stream');
var util = require('util');
var Tile = require('./stream-util').Tile;
var Info = require('./stream-util').Info;
var serialize = require('./stream-util').serialize;
var serialHeader = require('./stream-util').serialHeader;

module.exports = Serialize;
util.inherits(Serialize, stream.Transform);

function Serialize() {
    stream.Transform.call(this);
    this._writableState.objectMode = true;
    this._readableState.objectMode = false;
    this._buffer = [];
    this.push(serialHeader + '\n');
}

Serialize.prototype._transform = function(chunk, enc, callback) {
    var data = this._buffer.pop();
    if (data) this.push(data + '\n');
    if (chunk instanceof Tile || chunk instanceof Info)
        this._buffer.push(serialize(chunk));
    callback();
};

Serialize.prototype._flush = function(callback) {
    var data = this._buffer.pop();
    if (data) this.push(data);
    callback();
};
