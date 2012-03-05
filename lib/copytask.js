var tilelive = require('..');
var url = require('url');
var fs = require('fs');
var Scheme = require('./scheme');

module.exports = CopyTask;
require('util').inherits(CopyTask, process.EventEmitter);
function CopyTask(from, to, scheme, job) {
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
        console.warn('\n' + err.stack);
        fs.writeFileSync(task.job, JSON.stringify(task));
        console.warn('\nWrote state to ' + task.job);
        process.exit(1);
    });

    process.on('SIGINT', function() {
        fs.writeFileSync(task.job, JSON.stringify(task));
        console.warn('\nWrote state to ' + task.job);
        process.exit(1);
    });

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

CopyTask.prototype.toJSON = function() {
    return {
        started: this.started,
        ended: this.ended,
        source: this.source,
        sink: this.sink,
        scheme: this.scheme
    };
};

CopyTask.prototype.finished = function() {
    var task = this;
    clearInterval(this.progressInterval);
    clearInterval(this.stateInterval);
    this.emit('progress', this.stats.snapshot());

    this.sink.stopWriting(function(err) {
        task.ended = Date.now();
        task.emit('progress', task.stats.snapshot());
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

CopyTask.prototype.start = function() {
    var task = this
    if (!this.started) this.started = Date.now();

    this.progressInterval = setInterval(function() {
        task.emit('progress', task.stats.snapshot());
    }, 1000);

    this.stateInterval = setInterval(function() {
        fs.writeFile(task.job, JSON.stringify(task));
    }, 60000);

    // Running on next tick allows attaching event handlers in the same loop.
    process.nextTick(function() {
        task.sink.startWriting(function(err) {
            if (err) throw err;
            task.scheme.start();
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
                    tile.key = color[0]*(1<<24) + ((color[1]<<16) | (color[2]<<8) | color[3]);
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
