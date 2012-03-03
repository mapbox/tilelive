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
    this.stats.speed = 0;
    this.scheme.task = this;
    this.statefile = 'state-' + new Date().toISOString().replace(/:/g, '-');
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
    task.emit('progress');
    this.sink.stopWriting(function(err) {
        task.ended = Date.now();
        if (err) {
            task.emit('error', err);
        } else {
            task.emit('finished');
        }
    });
};

CopyTask.prototype.start = function() {
    var task = this
    if (!this.started) this.started = Date.now();

    this.progressInterval = setInterval(function() {
        task.stats.speed = task.stats.processed - (task.stats.previousProcessed || 0);
        task.stats.previousProcessed = task.stats.processed;
        task.emit('progress');
    }, 1000);

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

CopyTask.prototype.render = function(tile, done) {
    var task = this;
    this.source.getTile(tile.z, tile.x, tile.y, function(err, data) {
        if (err) {
            done.error(tile, err);
        } else {
            var key = data.solid || false;
            if (key === false) {
                // This is a unique tile.
                done.unique(tile, data);
            } else if (key === '0,0,0,0' || key === '0') {
                // This is a blank tile/grid. Don't do anything.
                done.skip(tile);
            } else {
                // Duplicate tile that we already have cached.
                done.duplicate(tile, data, key);
            }
        }
    });
};

CopyTask.prototype.error = function(tile, err, done) {
    console.warn(tile, err);
    done();
};

CopyTask.prototype.unique = function(tile, data, done) {
    var task = this;
    this.sink.putTile(tile.z, tile.x, tile.y, data, function(err) {
        if (err) {
            task.error(tile, err, done);
        } else {
            done();
        }
    });
};

CopyTask.prototype.skip = function(tile, done) {
    // console.warn('skip', tile);
    done();
};

CopyTask.prototype.duplicate = function(tile, data, key, done) {
    var task = this;
    this.sink.putTile(tile.z, tile.x, tile.y, data, function(err) {
        if (err) {
            task.error(tile, err, done);
        } else {
            done();
        }
    });
};
