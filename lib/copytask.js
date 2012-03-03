var tilelive = require('..');
var url = require('url');
var fs = require('fs');
var FileScheme = require('./filescheme');

module.exports = CopyTask;
require('util').inherits(CopyTask, process.EventEmitter);
function CopyTask(from, to, scheme) {
    this.scheme = scheme;
    this.started = null;
    this.ended = null;
    this.initialize(from, to);
}

CopyTask.unserialize = function(state) {
    var task = Object.create(CopyTask.prototype);
    task.started = state.started;
    task.ended = state.ended;
    if (state.scheme.type !== 'FileScheme') {
        task.emit('error', new Error('Unknown tiling scheme ' + state.scheme.type));
    } else {
        task.scheme = FileScheme.unserialize(state.scheme);
        task.initialize(state.source, state.sink);
    }
    return task;
};

CopyTask.prototype.initialize = function(from, to) {
    var task = this;

    this.stats = this.scheme.stats;
    this.stats.speed = '0';
    this.scheme.task = this;
    this.statefile = 'state-' + new Date().toISOString().replace(/:/g, '-');
    this.progressHistory = [];
    console.warn('Persisting state in ' + this.statefile);

    tilelive.load(url.parse(from), function(err, source) {
        if (err) task.emit('error', err);
        else tilelive.load(url.parse(to), function(err, sink) {
            if (err) task.emit('error', err);
            else {
                task.source = source;
                task.sink = sink;
                process.nextTick(function() {
                    task.emit('load');
                });
            }
        });
    });
};

CopyTask.prototype.serialize = function() {
    return JSON.stringify({
        started: this.started,
        ended: this.ended,
        source: this.source,
        sink: this.sink,
        scheme: this.scheme
    });
};

CopyTask.prototype.finished = function() {
    var task = this;
    clearInterval(this.progressInterval);
    clearInterval(this.stateInterval);
    this.updateStats();
    this.sink.stopWriting(function(err) {
        task.ended = Date.now();
        task.updateStats();
        if (err) {
            task.emit('error', err);
        } else {
            task.sink.close(function(err) {
                if (err) throw err;
                task.source.close(function(err) {
                    if (err) throw err;
                    task.emit('finished');
                })
            });
        }
    });
};

CopyTask.prototype.updateStats = function() {
    var now = Date.now()

    this.progressHistory.push({ date: now, processed: this.stats.processed });
    while (this.progressHistory.length > 10) this.progressHistory.shift();

    if (this.progressHistory.length >= 2) {
        var current = this.progressHistory[this.progressHistory.length - 1];
        var previous = this.progressHistory[0];
        this.stats.speed = ((current.processed - previous.processed) / (current.date - previous.date) * 1000).toFixed(0);
    }

    this.emit('progress');
};

CopyTask.prototype.start = function() {
    var task = this
    if (!this.started) this.started = Date.now();

    this.updateStats();
    this.progressInterval = setInterval(this.updateStats.bind(this), 1000);

    this.stateInterval = setInterval(function() {
        fs.writeFile(task.statefile, task.serialize());
    }, 10000);

    process.nextTick(function() {
        task.sink.startWriting(function(err) {
            if (err) throw err;
            task.scheme.start();
        });
    });
};

CopyTask.prototype.pause = function() {
    var task = this;
    clearInterval(this.progressInterval);
    task.emit('progress');
    this.scheme.pause();
};

CopyTask.prototype.render = function(tile) {
    var task = this;
    this.source.getTile(tile.z, tile.x, tile.y, function(err, data) {
        if (err) {
            task.emit('error', err, tile);
            task.scheme.error(tile);
        } else {
            var key = data.solid || false;
            if (key === '0,0,0,0' || key === '0') {
                task.scheme.skip(tile);
            } else {
                task.sink.putTile(tile.z, tile.x, tile.y, data, function(err) {
                    if (err) {
                        task.emit('error', err, tile);
                    }
                    if (key === false) {
                        // This is a unique tile
                        task.scheme.unique(tile);
                    } else {
                        task.scheme.duplicate(tile);
                    }
                });
            }
        }
    });
};

