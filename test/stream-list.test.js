var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');

var filepath = path.join(tmp, 'list.mbtiles');
try { fs.unlinkSync(filepath); } catch(e) {}
var file = fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat'));

var src;
var dst;

test('list: src', function(t) {
    new MBTiles(__dirname + '/fixtures/plain_1.mbtiles', function(err, s) {
        t.ifError(err);
        src = s;
        t.end();
    });
});

test('list: dst', function(t) {
    new MBTiles(filepath, function(err, d) {
        t.ifError(err);
        dst = d;
        dst._batchSize = 1;
        t.end();
    });
});

test('list: pipe', function(t) {
    var get = tilelive.createReadStream(src, {type:'list'});
    var put = tilelive.createWriteStream(dst);
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    put.on('finish', function() {
        t.deepEqual({ total: 0, skipped: 0, stored: 5 }, get.stats);
        t.end();
    });
    file.pipe(get).pipe(put);
});

test('list: vacuum', function(t) {
    dst._db.exec('vacuum;', t.end);
});

test('list: verify tiles', function(t) {
    dst._db.get('select count(1) as count, sum(length(tile_data)) as size from tiles;', function(err, row) {
        t.ifError(err);
        t.equal(5, row.count);
        t.equal(26377, row.size);
        t.end();
    });
});

