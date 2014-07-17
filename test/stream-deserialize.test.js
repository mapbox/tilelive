var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var Tile = require('../lib/stream-util').Tile;
var Info = require('../lib/stream-util').Info;
var DeserializationError = require('../lib/stream-util').DeserializationError;
var fs = require('fs');
var path = require('path');
var tmp = require('os').tmpdir();

var filepath = path.join(tmp, 'list.mbtiles');

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
            t.end();
        });
});

test('deserialize: scanline', function(t) {
    var get = tilelive.createReadStream(src, {type:'scanline'});
    get.on('error', function(err) { t.ifError(err); });

    var out = [];
    get.pipe(tilelive.serialize()).pipe(tilelive.deserialize())
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
            t.end();
        });
});

test('deserialize: pyramid', function(t) {
    var get = tilelive.createReadStream(src, {type:'pyramid'});
    get.on('error', function(err) { t.ifError(err); });

    var out = [];
    get.pipe(tilelive.serialize()).pipe(tilelive.deserialize())
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
            t.end();
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
        }).read();
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
