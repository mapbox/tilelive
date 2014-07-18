var stream = require('stream');
var util = require('util');
var Info = require('./stream-util').Info;
var serializedType = require('./stream-util').serializedType;
var StringDecoder = require('string_decoder').StringDecoder;

module.exports = Deserialize;
util.inherits(Deserialize, stream.Transform);

function Deserialize() {
    stream.Transform.call(this);
    this._writableState.objectMode = false;
    this._readableState.objectMode = true;
    this._buffer = new Buffer(0);
}

Deserialize.prototype._transform = function(chunk, enc, callback) {
    var buffer = Buffer.concat([this._buffer, chunk]);
    this._readData(buffer, callback);
};

Deserialize.prototype._flush = function(callback) {
    this._readData(this._buffer, callback);
};

Deserialize.prototype._readData = function(buffer, callback) {
    if (buffer.length < 4) return this._leftovers(buffer, callback);

    var readLength = buffer.readUInt32LE(0);
    if (buffer.length < readLength) return this._leftovers(buffer, callback);

    buffer = buffer.slice(4);
    var data = buffer.slice(0, readLength);

    var obj;
    try { obj = serializedType(data); }
    catch(err) { return callback(err); }

    try { obj.deserialize(data); }
    catch(err) { return callback(err); }

    if (obj instanceof Info) this.emit('info', obj);

    this.push(obj);

    buffer = buffer.slice(readLength);
    this._readData(buffer, callback);
};

Deserialize.prototype._leftovers = function(data, callback) {
    this._buffer = data;
    callback();
};
