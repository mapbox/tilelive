var stream = require('stream');
var util = require('util');
var Tile = require('./stream-util').Tile;

module.exports = Serialize;
util.inherits(Serialize, stream.Transform);

function Serialize() {
    stream.Transform.call(this);
    this._writableState.objectMode = true;
    this._readableState.objectMode = false;
}

Serialize.prototype._transform = function(chunk, enc, callback) {
    if (chunk instanceof Tile) this.push(chunk.serialize());
    callback();
};
