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
    this._linenum = 0;
}

Deserialize.prototype._transform = function(chunk, enc, callback) {
    this._buffer += this._decoder.write(chunk);
    var lines = this._buffer.split(/\r?\n/);
    this._buffer = lines.pop();

    var obj, line;
    for (var i = 0; i < lines.length; i++) {
        line = lines[i];

        if (line.toString() === serialHeader) continue;

        this._linenum++;
        if (this._job && this._linenum % this._job.total !== this._job.num - 1)
            continue;

        try { obj = deserialize(line); }
        catch (err) { return callback(err); }

        if (obj instanceof Info) this.emit('info', obj);
        if (obj instanceof Tile) this.emit('tile', obj);
        this.push(obj);
    }

    callback();
};

Deserialize.prototype._flush = function(callback) {
    var leftover = this._buffer.trim();
    if (leftover) {
        this._linenum++;
        if (this._job && this._linenum % this._job.total !== this._job.num - 1)
            return callback();

        var obj;

        try { obj = deserialize(leftover); }
        catch (err) { return callback(err); }

        if (obj instanceof Info) this.emit('info', obj);
        if (obj instanceof Tile) this.emit('tile', obj);
        this.push(obj);
    }

    callback();
};
