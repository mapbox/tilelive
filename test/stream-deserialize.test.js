var test = require('tape');
var MBTiles = require('@mapbox/mbtiles');
var tilelive = require('..');
var Tile = require('../lib/stream-util').Tile;
var Info = require('../lib/stream-util').Info;
var DeserializationError = require('../lib/stream-util').DeserializationError;
var fs = require('fs');
var path = require('path');
var tmp = require('os').tmpdir();
var assert = require('assert');
var unzip = require('zlib').createGunzip();
var crypto = require('crypto');

var src, dst;

// This is only used for deserialize: dst and deserialize: round trip tests
var filepath = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.list_deserialize.mbtiles');

test('deserialize: src', function(t) {
    new MBTiles(__dirname + '/fixtures/plain_1.mbtiles', function(err, s) {
        t.ifError(err);
        src = s;
        t.end();
    });
});

test('deserialize: dst', function(t) {
    new MBTiles(filepath, function(err, d) {
        t.ifError(err);
        dst = d;
        dst._batchSize = 1;
        t.end();
    });
});

test('deserialize: list', function(t) {
    var file = fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat'));
    var get = tilelive.createReadStream(src, {type:'list'});
    get.on('error', function(err) { t.ifError(err); });

    var out = [];

    file.pipe(get).pipe(tilelive.serialize()).pipe(tilelive.deserialize())
        .on('data', function(d) {
            out.push(d);
        })
        .on('finish', function() {
            function checkType() {
                out.forEach(function(obj) {
                    if (obj instanceof Tile || obj instanceof Info) return;
                    throw new Error('Not a valid type of object');
                });
            }
            t.doesNotThrow(checkType, 'deserialized objects are valid Tile or Info objects');
            t.equal(out.length, 77, 'correct number of tiles deserialized');
            t.end();
        });
});

test('deserialize: scanline', function(t) {
    var get = tilelive.createReadStream(src, {type:'scanline'});
    get.on('error', function(err) { t.ifError(err); });

    var out = [];
    t.plan(6);
    get.pipe(tilelive.serialize()).pipe(tilelive.deserialize())
        .on('data', function(d) {
            out.push(d);
        })
        .once('tile', function(tile) {
            t.ok(tile instanceof Tile, 'emitted Tile event');
            t.ok(Object.keys(tile).length > 0, 'emitted tile object is deserialized');
        })
        .on('info', function(info) {
            t.ok(info instanceof Info, 'emitted Info event');
            t.ok(Object.keys(info).length > 0, 'emitted info object is deserialized');
        })
        .on('finish', function() {
            function checkType() {
                out.forEach(function(obj) {
                    if (obj instanceof Tile || obj instanceof Info) return;
                    throw new Error('Not a valid type of object');
                });
            }
            t.doesNotThrow(checkType, 'deserialized objects are valid Tile or Info objects');
            t.equal(out.length, 286, 'correct number of tiles deserialized');
        });
});

test('deserialize: pyramid', function(t) {
    var get = tilelive.createReadStream(src, {type:'pyramid'});
    get.on('error', function(err) { t.ifError(err); });

    var out = [];
    t.plan(6);
    get.pipe(tilelive.serialize()).pipe(tilelive.deserialize())
        .on('data', function(d) {
            out.push(d);
        })
        .once('tile', function(tile) {
            t.ok(tile instanceof Tile, 'emitted Tile event');
            t.ok(Object.keys(tile).length > 0, 'emitted tile object is deserialized');
        })
        .on('info', function(info) {
            t.ok(info instanceof Info, 'emitted Info event');
            t.ok(Object.keys(info).length > 0, 'emitted info object is deserialized');
        })
        .on('finish', function() {
            function checkType() {
                out.forEach(function(obj) {
                    if (obj instanceof Tile || obj instanceof Info) return;
                    throw new Error('Not a valid type of object');
                });
            }
            t.doesNotThrow(checkType, 'deserialized objects are valid Tile or Info objects');
            t.equal(out.length, 286, 'correct number of tiles deserialized');
        });
});

test('deserialize: put', function(t) {
    var get = tilelive.createReadStream(src, {type:'scanline'});
    var put = tilelive.createWriteStream(dst);
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    put.on('stop', function() {
        t.deepEqual(get.stats, { ops:285, total: 285, skipped: 0, done: 285 });
        t.end();
    });

    get.pipe(tilelive.serialize()).pipe(tilelive.deserialize()).pipe(put);
});

test('deserialize: verify put', function(t) {
    var errors = [];
    tilelive.createReadStream(dst, {type: 'scanline'})
        .on('error', function(err) { t.ifError(err); })
        .on('data', function(data) {
            if (data instanceof Tile || data instanceof Info) return;
            errors.push(new Error('Not a valid type of object'));
        })
        .on('end', function() {
            t.equal(errors.length, 0, 'put objects are valid Tile or Info objects');
            t.end();
        });
});

test('deserialize: garbage', function(t) {
    t.plan(1);
    fs.createReadStream(path.join(__dirname, 'fixtures', 'filescheme.flat'))
        .pipe(tilelive.deserialize())
        .on('data', function(d) { t.notOk(d, 'no data should be received'); })
        .on('end', function() { t.notOk(true, 'error should\'ve occurred'); })
        .on('error', function(err) {
            t.ok(err instanceof DeserializationError, 'deserialization error should be thrown');
        });
});

test('de/serialize: round-trip', function(t) {
    var tmpDst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelive_roundtrip.dstMbtiles');
    var tmpSerial = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelive.serialized');
    var original = tilelive.createReadStream(src, {type: 'scanline'})
        .on('error', function(err) { t.ifError(err); });
    var serialize = tilelive.serialize()
        .on('error', function(err) { t.ifError(err); });
    var deserialize = tilelive.deserialize()
        .on('error', function(err) { t.ifError(err); });
    var before, after;

    new MBTiles(tmpDst, function(err, outMbtiles) {
        t.ifError(err);
        before = outMbtiles;
        original.pipe(serialize).pipe(fs.createWriteStream(tmpSerial))
            .on('finish', function() {
                var final = after = tilelive.createWriteStream(outMbtiles)
                    .on('error', function(err) { t.ifError(err); });

                fs.createReadStream(tmpSerial)
                    .pipe(deserialize)
                    .pipe(final)
                    .on('stop', getStreamQueues);
            });
    });

    var beforeQueue;
    var afterQueue;
    function getStreamQueues() {
        var beforeOutput = '';
        var afterOutput = '';
        var beforeStream = before.createZXYStream();
        beforeStream.on('data', function(lines) { beforeOutput += lines; });
        beforeStream.on('end', function() {
            var afterStream = after.source.createZXYStream();
            afterStream.on('data', function(lines) { afterOutput += lines; });
            afterStream.on('end', function() {
                beforeQueue = beforeOutput.toString().split('\n');
                afterQueue = afterOutput.toString().split('\n');
                makeAssertions();
            });
        });
    }

    function makeAssertions() {
        before.getInfo(function(err, beforeInfo) {
            t.ifError(err);
            after.source.getInfo(function(err, afterInfo) {
                t.ifError(err);
                t.deepEqual(beforeInfo, afterInfo, 'input and output info is the same');
                beforeQueue.forEach(function(b, i) {
                  t.equal(b, afterQueue[i], 'zxy matches for both streams');
                });
                t.end();
            });
        });
    }

});

test('deserialize: incomplete', function(t) {
    t.plan(1);
    fs.createReadStream(path.join(__dirname, 'fixtures', 'cereal-incomplete.gz'))
        .pipe(unzip)
        .pipe(tilelive.deserialize())
        .on('error', function(err) {
            t.ok(err instanceof DeserializationError, 'incomplete file throws expected exception');
        })
        .on('end', t.end);
});

test('deserialize: split into jobs', function(t) {
    var results = [];
    var tilesPerJob = [];
    var tilelist = path.join(__dirname, 'fixtures', 'plain_1.tilelist');
    var expectedTiles = fs.readFileSync(tilelist, 'utf8').split('\n').slice(0, -1);

    runJob(1, 0, function() {       // one job
    runJob(4, 0, function() {       // a few jobs
    runJob(15, 0, function() {      // a moderate number of jobs
    runJob(285, 0, function() {     // as many jobs as there are tiles
    runJob(400, 0, t.end.bind(t));  // more jobs than there are tiles
    });});});});

    function runJob(total, num, done) {
        var tileCount = 0;
        var gotInfo = false;
        fs.createReadStream(path.join(__dirname, 'fixtures', 'plain_1.serialtiles'))
            .pipe(tilelive.deserialize({ job: { total: total, num: num } }))
            .on('error', function(err) {
                t.ifError(err, 'Error during deserialization');
            })
            .on('tile', function(tile) {
                if (tile.hasOwnProperty('x')) { // filters out info objects
                    results.push([tile.z, tile.x, tile.y].join('/'));
                    tileCount++;
                }
            })
            .on('info', function(info) {
                gotInfo = true;
            })
            .on('finish', function() {
                tilesPerJob.push(tileCount);
                if (num === total - 1) {
                    t.ok(gotInfo, 'got info object');
                    t.equal(results.length, 285, 'correct number of tiles across ' + total + ' jobs');
                    var tiles = results.reduce(function(memo, tile) {
                        if (memo[tile]) memo[tile]++;
                        else memo[tile] = 1;
                        return memo;
                    }, {});

                    for (var k in tiles) {
                        if (tiles[k] > 1) t.fail('tile repeated ' + tiles[k] + ' times with ' + total + ' jobs: ' + k);
                    }

                    var gotAllTiles = expectedTiles.reduce(function(memo, tile) {
                        if (results.indexOf(tile) < 0) memo = false;
                        return memo;
                    }, true);
                    t.ok(gotAllTiles, 'rendered all expected tiles');

                    results = [];
                    tilesPerJob = [];
                    done();
                } else {
                    num++;
                    runJob(total, num, done);
                }
            });
    }
});
