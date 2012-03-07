var fs = require('fs');
var unserialize = require('./tile').unserialize;
var Scheme = require('./scheme');
var Tile = require('./tile').Tile;
var Statistics = require('./statistics');

module.exports = FileScheme;
require('util').inherits(FileScheme, Scheme);
function FileScheme(options) {
    this.type = 'file';
    if (!options.list) throw new Error('Parameter list required');
    this.concurrency = options.concurrency || 8;

    // TODO: don't read everything at once.
    this.list = Scheme.unserializeTiles(fs.readFileSync(options.list, 'utf8').split('\n').filter(function(line) { return line.trim().length; }));

    this.stats = new Statistics();
    this.stats.total = this.list.length;

    this.initialize();
}

FileScheme.unserialize = function(state) {
    var scheme = Object.create(FileScheme.prototype);
    for (var key in state) scheme[key] = state[key];
    scheme.list = unserialize(state.pending).concat(unserialize(state.list));
    scheme.stats = Statistics.unserialize(state.stats);
    scheme.initialize();
    return scheme;
};

FileScheme.prototype.next = function() {
    while (!this.paused && this.list.length && this.pending.length < this.concurrency) {
        var tile = this.list.shift();
        this.addPending(tile);
        this.task.render(tile);
    }

    if (!this.paused && !this.finished && !this.list.length && !this.pending.length) {
        this.finished = true;
        this.task.finished();
    }
};
