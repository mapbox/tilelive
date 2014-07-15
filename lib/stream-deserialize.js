var stream = require('stream');
var util = require('util');
var Tile = require('./stream-util').Tile;
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
    var push = this.push,
        emit = this.emit;

    this._buffer += this._decoder.write(chunk);
    var lines = this._buffer.split(/\r?\n/);
    this._buffer = lines.pop();

    var tile, line;
    for (var i = 0; i < lines.length; i++) {
        tile = new Tile();
        line = lines[i];
        try { tile.deserialize(line); }
        catch (err) { return this.emit('error', err); }
        this.push(tile);
    }

    callback();
};

Deserialize.prototype._flush = function(callback) {
    var leftover = this._buffer.trim();
    if (leftover) {
        var tile = new Tile();
        try { tile.deserialize(leftover); }
        catch (err) { return this.emit('error', err); }
        this.push(tile);
    }

    callback();
};
