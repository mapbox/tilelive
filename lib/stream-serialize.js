var stream = require('stream');
var util = require('util');
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

    var serialized;
    try {
        serialized = serialize(chunk);
    } catch(err) {
        return callback(err);
    }
    this._buffer.push(serialized);
    callback();
};

Serialize.prototype._flush = function(callback) {
    var data = this._buffer.pop();
    if (data) this.push(data + '\n');
    callback();
};
