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
    this.list = [];
    var filelist = fs.readFileSync(options.list, 'utf8')
        .split('\n')
        .filter(function(line) { return line.trim().length; });
    if (/[\d]+\/[\d]+\/[\d]+/.test(filelist[0])) {
        for (var i = 0; i < filelist.length; i++) {
            var coords = filelist[i].split('/');
            this.list.push(new Tile(+coords[0], +coords[1], +coords[2]));
        }
    } else {
        for (var i = 0; i < filelist.length; i++) {
            var state = JSON.parse(filelist[i]);
            this.list.push(new Tile(state.z, state.x, state.y, state.key));
        }
    }

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
    var formats = (this.task.formats && this.task.formats.length > 0) ? this.task.formats : ['tile'];
    while (!this.paused && this.list.length && this.pending.length < this.concurrency) {
        var tile = this.list.shift();
        for (var key in formats) {
            this.addPending(tile);
            this.task.render(tile,formats[key]);
        }
    }

    if (!this.paused && !this.finished && !this.list.length && !this.pending.length) {
        this.finished = true;
        this.task.finished();
    }
};
