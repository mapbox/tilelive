var tilelive = require('..');
var url = require('url');
var fs = require('fs');
var Scheme = require('./scheme');

module.exports = CopyTask;
require('util').inherits(CopyTask, process.EventEmitter);
function CopyTask(from, to, scheme, job) {
    this.from = typeof from === 'string' ? url.parse(from) : from;
    this.to = typeof to === 'string' ? url.parse(to) : to;
    this.scheme = scheme;
    this.started = null;
    this.ended = null;
    this.job = job;
    this.initialize(from, to);
}

CopyTask.prototype.initialize = function(from, to) {
    var task = this;

    this.stats = this.scheme.stats;
    this.emit('progress', this.stats.snapshot());

    // Make sure this is non-enumerable;
    Object.defineProperty(this.scheme, 'task', { value: this });

    // State persistence
    console.warn('Persisting state in ' + this.job + ' every minute and on SIGINT');

    process.on('uncaughtException', function(err) {
        if (err.stack) console.warn('\n' + err.stack);
        else console.warn('\n' + err.message);
        console.warn('Trying to exit cleanly...');
        task.pause(function(err) {
            if (err) throw err;
            console.warn('\nWrote state to ' + task.job);
        });
    });

    process.on('SIGINT', function() {
        task.pause(function(err) {
            if (err) throw err;
            console.warn('\nWrote state to ' + task.job);
        });
    });
};

CopyTask.prototype.toJSON = function() {
    return {
        started: this.started,
        ended: this.ended,
        from: this.from,
        to: this.to,
        scheme: this.scheme
    };
};

CopyTask.prototype.finished = function() {
    var task = this;
    this.pause(function() {
        task.emit('finished');
    });
};

CopyTask.prototype.pause = function(callback) {
    var task = this;

    this.scheme.once('paused', function() {
        clearInterval(task.progressInterval);
        clearInterval(task.stateInterval);
        task.emit('progress', task.stats.snapshot());

        task.sink.stopWriting(function(err) {
            task.ended = Date.now();
            task.emit('progress', task.stats.snapshot());
            if (err) return callback(err);
            fs.writeFile(task.job, JSON.stringify(task), function(err) {
                if (err) return callback(err);
                task.sink.close(function(err) {
                    if (err) return callback(err);
                    task.source.close(callback);
                });
            });
        });
    });

    this.scheme.pause();
};

CopyTask.prototype.start = function(callback) {
    var task = this
    if (!this.started) this.started = Date.now();

    this.progressInterval = setInterval(function() {
        task.emit('progress', task.stats.snapshot());
    }, 1000);

    this.stateInterval = setInterval(function() {
        fs.writeFile(task.job, JSON.stringify(task));
    }, 60000);

    tilelive.load(task.from, function(err, source) {
        if (err) return callback(err);
        task.source = source;
        tilelive.load(task.to, function(err, sink) {
            if (err) return callback(err);
            task.sink = sink;
            task.sink.startWriting(function(err) {
                if (err) return callback(err);
                task.scheme.start();
                callback(null);
            });
        });
    });
};

CopyTask.prototype.render = function(tile) {
    var task = this;
    if (tile.key !== false) {
        task.sink.putDuplicateTile(tile.z, tile.x, tile.y, tile.key, function(err) {
            if (err) {
                task.emit('error', err, tile);
                task.scheme.error(tile);
            } else {
                task.scheme.duplicate(tile);
            }
        });
    } else {
        task.source.getTile(tile.z, tile.x, tile.y, function(err, data) {
            if (err) {
                task.emit('error', err, tile);
                task.scheme.error(tile);
            } else {
                if (data.solid) {
                    var color = data.solid.split(',');
                    if (color[3] === '0') {
                        tile.key = 0;
                    } else {
                        tile.key = -(color[0]*(1<<24) + ((color[1]<<16) | (color[2]<<8) | color[3]));
                    }
                    data.key = tile.key;
                }
                if (tile.key === 0) {
                    task.scheme.skip(tile);
                } else {
                    task.sink.putTile(tile.z, tile.x, tile.y, data, function(err) {
                        if (err) {
                            task.emit('error', err, tile);
                            task.scheme.error(tile);
                        }
                        else if (tile.key === false) {
                            // This is a unique tile
                            task.scheme.unique(tile);
                        } else {
                            task.scheme.duplicate(tile);
                        }
                    });
                }
            }
        });
    }
};
