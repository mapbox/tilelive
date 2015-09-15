var stream = require('stream');
var util = require('util');
var Info = require('./stream-util').Info;
var Tile = require('./stream-util').Tile;
var deserialize = require('./stream-util').deserialize;
var serialHeader = require('./stream-util').serialHeader;
var StringDecoder = require('string_decoder').StringDecoder;

module.exports = Deserialize;
util.inherits(Deserialize, stream.Transform);

function Deserialize(options) {
    stream.Transform.call(this);

    options = options || {};

    this._writableState.objectMode = false;
    this._readableState.objectMode = true;
    this._buffer = '';
    this._decoder = new StringDecoder('utf8');
    this._job = options.job || false;
}

Deserialize.prototype._transform = function(chunk, enc, callback) {
    this._buffer += this._decoder.write(chunk);
    var lines = this._buffer.split(/\r?\n/);
    this._buffer = lines.pop();

    for (var i = 0; i < lines.length; i++) {
        try { this.deserialize(lines[i]); }
        catch(err) { return callback(err); }
    }

    callback();
};

Deserialize.prototype._flush = function(callback) {
    var leftover = this._buffer.trim();
    if (leftover) {
        try { this.deserialize(leftover); }
        catch(err) { return callback(err); }
    }
    callback();
};

Deserialize.prototype.deserialize = function(serializedObj) {
    if (serializedObj.toString() === serialHeader) return;

    if (this._job) {
        var x = deserialize(serializedObj, 'x');
        // undefined x means this is an Info object that should be read with any job
        if (x !== undefined && x % this._job.total !== this._job.num)
            return;
    }

    var obj = deserialize(serializedObj);

    if (obj instanceof Info) this.emit('info', obj);
    if (obj instanceof Tile) this.emit('tile', obj);
    this.push(obj);
};
