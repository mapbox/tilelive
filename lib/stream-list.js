var Stats = require('./stream-util').Stats;
var Tile = require('./stream-util').Tile;
var isEmpty = require('./stream-util').isEmpty;
var setConcurrency = require('./stream-util').setConcurrency;
var util = require('util');
var Parallel = require('parallel-stream');

module.exports = List;
util.inherits(List, Parallel);

function List(source, options) {
    if (!source) throw new TypeError('Tilesource required');
    this.source = source;
    this.buffer = '';
    this.stats = new Stats();
    this.length = 0;
    this.job = options.job || false;

    Parallel.call(this, setConcurrency(), options);
    this._writableState.objectMode = false;
    this._readableState.objectMode = true;
}

List.prototype._preprocess = function(obj, enc) {
    this.buffer += obj.toString('utf8');
    var list = this;

    function pushTile(str) {
        var coord = str.split('/');

        var z = parseInt(coord[0],10);
        var x = parseInt(coord[1],10);
        var y = parseInt(coord[2],10);
        if (isNaN(z) || isNaN(x) || isNaN(y)) return false;

        list.concurrentBuffer.push({z:z,x:x,y:y});
        list.stats.total++;
        list.length++;
        return true;
    }

    while (this.buffer.length) {
        var next = this.buffer.indexOf('\n');
        if (next === 0) {
            this.buffer = this.buffer.slice(1);
            next = this.buffer.indexOf('\n');
        }
        if (next === -1) next = this.buffer.length;
        if (pushTile(this.buffer.slice(0, next)))
            this.buffer = this.buffer.slice(next + 1);
        else break;
    }

    this.emit('length', this.length);
};

List.prototype._process = function(zxy, encoding, callback) {
    var list = this;

    list.stats.ops++;

    if (list.job && zxy.x % list.job.total !== list.job.num)
        return skip();

    list.source.getTile(zxy.z, zxy.x, zxy.y, function(err, buffer) {
        if (err && !(/does not exist$/).test(err.message)) {
            callback(err);
        } else if (err || isEmpty(buffer)) {
            skip();
        } else {
            list.stats.done++;
            list.push(new Tile(zxy.z, zxy.x, zxy.y, buffer));
            callback();
        }
    });

    function skip() {
        list.stats.skipped++;
        list.stats.done++;
        // Update length
        list.length--;
        list.emit('length', list.length);
        callback();
    }
};
