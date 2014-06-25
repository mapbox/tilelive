var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');
var Timedsource = require('./timedsource');

var filepath = path.join(tmp, 'pyramid.mbtiles');
try { fs.unlinkSync(filepath); } catch(e) {}

var src;
var dst;

test('pyramid: src', function(t) {
    new MBTiles(__dirname + '/fixtures/plain_1.mbtiles', function(err, s) {
        t.ifError(err);
        src = s;
        t.end();
    });
});

test('pyramid: dst', function(t) {
    new MBTiles(filepath, function(err, d) {
        t.ifError(err);
        dst = d;
        dst._batchSize = 1;
        t.end();
    });
});

test('pyramid: pipe', function(t) {
    var get = tilelive.createReadStream(src, {type:'pyramid'});
    var put = tilelive.createWriteStream(dst);
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    get.pipe(put);
    put.on('finish', function() {
        t.deepEqual(get.stats, { ops:285, total: 285, skipped: 0, done: 285 });
        t.end();
    });
});

test('pyramid: vacuum', function(t) {
    dst._db.exec('vacuum;', t.end);
});

test('pyramid: verify tiles', function(t) {
    dst._db.get('select count(1) as count, sum(length(tile_data)) as size from tiles;', function(err, row) {
        t.ifError(err);
        t.equal(row.count, 285);
        t.equal(row.size, 477705);
        t.end();
    });
});

test('pyramid: verify metadata', function(t) {
    dst.getInfo(function(err, info) {
        t.ifError(err);
        t.equal(info.name, 'plain_1');
        t.equal(info.description, 'demo description');
        t.equal(info.version, '1.0.3');
        t.equal(info.minzoom, 0);
        t.equal(info.maxzoom, 4);
        t.deepEqual(info.bounds, [ -179.9999999749438, -69.99999999526695, 179.9999999749438, 84.99999999782301 ]);
        t.deepEqual(info.center, [ 0, 7.500000001278025, 2 ]);
        t.end();
    });
});

test('pyramid: concurrency', function(t) {
    var fast = new Timedsource({time:5});
    var slow = new Timedsource({time:50});
    var get = tilelive.createReadStream(fast, {type:'pyramid'});
    var put = tilelive.createWriteStream(slow);
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    get.pipe(put);
    setTimeout(function() {
        t.deepEqual(get.stats, { ops:25, total: 85, skipped: 10, done: 23 });
    }, 20);
    put.on('finish', function() {
        t.deepEqual(get.stats, { ops:69, total: 85, skipped: 28, done: 85 });
        t.end();
    });
});

