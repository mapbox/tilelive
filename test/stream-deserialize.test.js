var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var Tile = require('../lib/stream-util').Tile;
var Info = require('../lib/stream-util').Info;
var DeserializationError = require('../lib/stream-util').DeserializationError;
var fs = require('fs');
var path = require('path');
var tmp = require('os').tmpdir();
var assert = require('assert');
var unzip = require('zlib').createGunzip();

var filepath = path.join(tmp, 'list.mbtiles');
var tmpSerial = path.join(tmp, 'tilelive.serialized');
var tmpDst = path.join(tmp, 'tilelive.dstMbtiles');

var src, dst;

test('deserialize: src', function(t) {
    new MBTiles(__dirname + '/fixtures/plain_1.mbtiles', function(err, s) {
        t.ifError(err);
        src = s;
        t.end();
    });
});

test('deserialize: dst', function(t) {
    try { fs.unlinkSync(filepath); } catch(e) {}
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
    t.plan(4);
    get.pipe(tilelive.serialize()).pipe(tilelive.deserialize())
        .on('data', function(d) {
            out.push(d);
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
    t.plan(4);
    get.pipe(tilelive.serialize()).pipe(tilelive.deserialize())
        .on('data', function(d) {
            out.push(d);
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
    fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat'))
        .pipe(tilelive.deserialize())
        .on('data', function(d) { t.notOk(d, 'no data should be received'); })
        .on('end', function() { t.notOk(true, 'error should\'ve occurred'); })
        .on('error', function(err) {
            t.ok(err instanceof DeserializationError, 'deserialization error should be thrown');
        });
});

test('de/serialize: round-trip', function(t) {
    try { fs.unlinkSync(tmpSerial); } catch(e) {}
    try { fs.unlinkSync(tmpDst); } catch(e) {}

    var original = tilelive.createReadStream(src, {type: 'scanline'})
        .on('error', function(err) { t.ifError(err); });
    var serialize = tilelive.serialize()
        .on('error', function(err) { t.ifError(err); });
    var deserialize = tilelive.deserialize()
        .on('error', function(err) { t.ifError(err); });

    new MBTiles(tmpDst, function(err, outMbtiles) {
        t.ifError(err);
        original.pipe(serialize).pipe(fs.createWriteStream(tmpSerial))
            .on('finish', function() {
                var final = tilelive.createWriteStream(outMbtiles)
                    .on('error', function(err) { t.ifError(err); });

                fs.createReadStream(tmpSerial)
                    .pipe(deserialize)
                    .pipe(final)
                    .on('stop', makeAssertions);
            });
    });

    function makeAssertions() {
        var originalStats = fs.statSync(filepath);
        var serializedStats = fs.statSync(tmpSerial);
        var finalStats = fs.statSync(tmpDst);

        var sizeDiff = Math.abs(originalStats.size - finalStats.size) / originalStats.size;

        t.ok(sizeDiff < 0.01, 'round-tripped mbtiles are approx. the same size');
        t.end();
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
