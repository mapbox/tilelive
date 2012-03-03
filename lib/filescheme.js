var fs = require('fs');
var Tile = require('./tile');

module.exports = FileScheme;
function FileScheme(options) {
    if (!options.filename) throw new Error('Filename required');
    this.concurrency = options.concurrency || 8;

    // TODO: change so we can read from the file as we go.
    this.list = fs.readFileSync(options.filename, 'utf8').split('\n').filter(nonempty);
    this.initialize();
    this.stats.total = this.list.length;
}

FileScheme.prototype.initialize = function() {
    // Required for pause/start.
    this.pending = [];
    this.paused = true;

    var scheme = this;
    // setInterval(function() {
    //     console.warn(scheme.stats);
    // }, 1000);

    this.next = this.next.bind(this);
    this.stats = {
        total: 0,
        pending: 0,
        unique: 0,
        duplicate: 0,
        failed: 0,
        skipped: 0,
        get remaining() {
            return this.total - this.unique - this.duplicate - this.failed - this.skipped;
        },
        get processed() {
            return this.unique + this.duplicate + this.failed + this.skipped;
        }
    };
};

function number(num) { return num | 0; };
function nonempty(line) { return line.trim().length; }

FileScheme.unserialize = function(state) {
    var scheme = Object.create(FileScheme.prototype);
    scheme.initialize();
    scheme.concurrency = state.concurrency;
    scheme.list = state.pending.concat(state.list);
    scheme.stats.total = state.stats.total;
    scheme.stats.unique = state.stats.unique;
    scheme.stats.duplicate = state.stats.duplicate;
    scheme.stats.failed = state.stats.failed;
    scheme.stats.skipped = state.stats.skipped;
    return scheme;
};

FileScheme.prototype.toJSON = function() {
    return {
        type: 'FileScheme',
        concurrency: this.concurrency,
        list: this.list,
        pending: this.pending,
        stats: this.stats
    };
};

FileScheme.prototype.start = function() {
    this.paused = false;
    this.next();
};

FileScheme.prototype.pause = function() {
    this.paused = true;
};

FileScheme.prototype.next = function() {
    while (!this.paused && this.list.length && this.pending.length < this.concurrency) {
        var tile = this.list.shift();
        if (typeof tile === 'string') {
            tile = Tile.fromArray(tile.split('/').map(number));
        }
        this.pending.push(tile);
        this.stats.pending++;
        this.task.render(tile);
    }

    // DEBUG: Show those that are still hanging.
    if (this.pending.length === 1) {
        console.warn(this.pending);
    }

    if (!this.list.length && !this.pending.length) {
        this.task.finished();
    }
};

FileScheme.prototype.removePending = function(tile) {
    var index = this.pending.indexOf(tile);
    this.pending.splice(index, 1);
    this.stats.pending--;
};

FileScheme.prototype.error = function(tile) {
    this.removePending(tile);
    this.stats.failed++;
    this.next();
};

FileScheme.prototype.unique = function(tile) {
    this.removePending(tile);
    this.stats.unique++;
    this.next();
};

FileScheme.prototype.skip = function(tile) {
    this.removePending(tile);
    this.stats.skipped++;
    this.next();
};

FileScheme.prototype.duplicate = function(tile) {
    this.removePending(tile);
    this.stats.duplicate++;
    this.next();
};
