var tilelive = require('..');
var url = require('url');
var fs = require('fs');
var Step = require('step');
var Scheme = require('./scheme');

module.exports = CopyTask;
require('util').inherits(CopyTask, process.EventEmitter);
function CopyTask(from, to, scheme, job) {
    if (typeof from.getInfo === 'function') {
        this.source = from;
        from = 'temporary://';
    }
    if (typeof to.putInfo === 'function') {
        this.sink = to;
        to = 'temporary://';
    }
    this.from = typeof from === 'string' ? url.parse(from) : from;
    this.to = typeof to === 'string' ? url.parse(to) : to;
    this.scheme = scheme;
    this.started = null;
    this.ended = null;
    this.job = job || '/tmp/tilelive-' + (+new Date) + '.job';
    this.formats = [];
    this.cache = { tile: {}, grid: {} };
    this.initialize();
}

CopyTask.prototype.initialize = function() {
    var task = this;

    this.stats = this.scheme.stats;
    this.emit('progress', this.stats.snapshot());

    // Make sure this is non-enumerable;
    Object.defineProperty(this.scheme, 'task', { value: this });

    // State persistence
    console.warn('Persisting state in ' + this.job + ' every minute');

    // NOTE - This will no longer throw as of node v0.8.9
    // https://github.com/joyent/node/commit/ea1cba6246a8b1784e22d076139b9244a9ff42f8
    if ((process.platform !== 'win32')) {
        process.on('SIGINT', function() {
            task.pause(function(err) {
                if (err) throw err;
                console.warn('\nWrote state to ' + task.job);
            });
        });
    }
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
    this.pause(function(err) {
        if (err) {
            if (err.stack) console.warn('\n' + err.stack);
            else console.warn('\n' + err.message);
        }
        task.emit('finished');
    });
};

CopyTask.prototype.pause = function(callback) {
    // Don't call the callback if already pausing as callers often
    // expect they are the only ones doing teardown operations.
    if (this.pausing) return;

    var task = this;
    this.pausing = true;

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
    callback = callback || new Function;

    var task = this
    if (!this.started) this.started = Date.now();

    this.progressInterval = setInterval(function() {
        task.emit('progress', task.stats.snapshot());
    }, 1000);

    this.stateInterval = setInterval(function() {
        fs.writeFile(task.job, JSON.stringify(task));
    }, 60000);

    Step(function() {
        if (task.source) return this(null, task.source);
        tilelive.load(task.from, this);
    }, function(err, source) {
        if (err) throw err;
        task.source = source;
        source.getInfo(this);
    }, function(err, info) {
        if (err) throw err;
        // @TODO the tilelive API currently has no standard way
        // of determining whether a tilesource has tiles, grids
        // or both. See issue #44.
        task.formats.push('tile');

        // Use template as an indicator that grids are present.
        if (info.template) {
            task.formats.push('grid');
            task.stats.total = (task.stats.total || 0) * 2;
        }
        if (task.sink) return this(null, task.sink);
        tilelive.load(task.to, this);
    }, function(err, sink) {
        if (err) throw err;
        task.sink = sink;
        task.sink.startWriting(this);
    }, function(err) {
        if (err) return callback(err);

        // It is possible for a CopyTask to be paused before it
        // ever starts (SIGINT, exceptions, etc.) In these cases
        // respect the pause rather than forging ahead.
        if (task.pausing) return callback(null);

        task.scheme.start();
        callback(null);
    });
};

CopyTask.prototype.render = function(tile, type) {
    var get = type === 'grid' ? 'getGrid' : 'getTile';
    var put = type === 'grid' ? 'putGrid' : 'putTile';
    var task = this;

    // If tile key is set and we have cached its buffer in memory,
    // skip rendering and use the existing buffer.
    if (tile.key !== false && task.cache[type][tile.key]) {
        var data = task.cache[type][tile.key];
        task.sink[put](tile.z, tile.x, tile.y, data, function(err) {
            if (err) {
                task.emit('error', err, tile);
                task.scheme.error(tile);
            } else {
                task.scheme.duplicate(tile);
            }
        });
    // Render the tile.
    } else {
        task.source[get](tile.z, tile.x, tile.y, function(err, data) {
            if (err) {
                if (err.message.match(/Tile|Grid does not exist/)) {
                    task.scheme.skip(tile);
                } else {
                    task.emit('error', err, tile);
                    task.scheme.error(tile);
                }
                return;
            }
            if (data.solid) switch(type) {
            case 'grid':
                // Empty grid.
                if (data.solid === '0') {
                    data.key = tile.key = 0;
                // String grid key.
                } else {
                    data.key = tile.key = data.solid;
                }
                task.cache[type][tile.key] = data;
                break;
            case 'tile':
                var color = data.solid.split(',');
                // Empty tile.
                if (color[3] === '0') {
                    data.key = tile.key = 0;
                // Negative encoded RGBA value.
                } else {
                    data.key = tile.key = -(color[0]*(1<<24) + ((color[1]<<16) | (color[2]<<8) | color[3]));
                }
                task.cache[type][tile.key] = data;
                break;
            }
            if (tile.key === 0) {
                task.scheme.skip(tile);
            } else {
                task.sink[put](tile.z, tile.x, tile.y, data, function(err) {
                    if (err) {
                        task.emit('error', err, tile);
                        task.scheme.error(tile);
                    } else if (tile.key === false) {
                        // This is a unique tile
                        task.scheme.unique(tile);
                    } else {
                        task.scheme.duplicate(tile);
                    }
                });
            }
        });
    }
};
