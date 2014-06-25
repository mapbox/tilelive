var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');

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
        t.deepEqual({ total: 285, skipped: 0, stored: 285 }, get.stats);
        t.end();
    });
});

test('pyramid: vacuum', function(t) {
    dst._db.exec('vacuum;', t.end);
});

test('pyramid: verify tiles', function(t) {
    dst._db.get('select count(1) as count, sum(length(tile_data)) as size from tiles;', function(err, row) {
        t.ifError(err);
        t.equal(285, row.count);
        t.equal(477705, row.size);
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

