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
    this._buffer = '';
    this._decoder = new StringDecoder('utf8');
}

Deserialize.prototype._transform = function(chunk, enc, callback) {
    this._buffer += this._decoder.write(chunk);
    var lines = this._buffer.split(/\r?\n/);
    this._buffer = lines.pop();

    var obj, line;
    for (var i = 0; i < lines.length; i++) {
        line = lines[i];

        // Determination of tile vs. info
        try { obj = serializedType(line); }
        catch(err) { return callback(err); }

        try { obj.deserialize(line); }
        catch (err) { return callback(err); }
        if (obj instanceof Info) this.emit('info', obj);
        this.push(obj);
    }

    callback();
};

Deserialize.prototype._flush = function(callback) {
    var leftover = this._buffer.trim();
    if (leftover) {
        var obj;
        try { obj = serializedType(leftover); }
        catch(err) { return callback(err); }
        try { obj.deserialize(leftover); }
        catch (err) { return callback(err); }
        this.push(obj);
    }

    callback();
};
