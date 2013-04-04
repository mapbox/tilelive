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

    this.list = [];
    this.raw = fs.readFileSync(options.list, 'utf8');
    this.last = '';
    this.offset = 0;
    this.chunk = options.chunk || 1e6;
    this.readlines();

    this.stats = new Statistics();
    this.stats.total = this.raw.split('\n').filter(function(line) { return line.trim().length; }).length;

    this.initialize();
}

FileScheme.prototype.readlines = function() {
    var rest = this.raw.substr(this.offset, this.chunk);
    var read = this.last + rest;
    var lines = read.split('\n').filter(function(line) { return line.trim().length; });
    this.last = rest.length === this.chunk ? lines.pop() : '';
    this.offset += this.chunk;
    if (/[\d]+\/[\d]+\/[\d]+/.test(lines[0])) {
        for (var i = 0; i < lines.length; i++) {
            var coords = lines[i].split('/');
            this.list.push(new Tile(+coords[0], +coords[1], +coords[2]));
        }
    } else {
        for (var i = 0; i < lines.length; i++) {
            var state = JSON.parse(lines[i]);
            this.list.push(new Tile(state.z, state.x, state.y, state.key));
        }
    }
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
    if (!this.list.length) this.readlines();

    var formats = (this.task.formats && this.task.formats.length > 0) ? this.task.formats : ['tile'];
    while (!this.paused && this.list.length && this.pending.length < this.concurrency) {
        var tile = this.list.shift();
        for (var key in formats) {
            this.addPending(tile);
            this.task.render(tile,formats[key]);
        }
    }

    if (!this.paused && !this.finished && !this.list.length && !this.pending.length && !this.last) {
        this.finished = true;
        this.task.finished();
    }
};
