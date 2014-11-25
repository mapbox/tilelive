var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');
var Timedsource = require('./timedsource');

tilelive.stream.setConcurrency(10);

var filepath = path.join(tmp, 'scanline.mbtiles');

var src;
var dst;

test('scanline: src', function(t) {
    new MBTiles(__dirname + '/fixtures/plain_1.mbtiles', function(err, s) {
        t.ifError(err);
        src = s;
        t.end();
    });
});

test('scanline: dst', function(t) {
    try { fs.unlinkSync(filepath); } catch(e) {}
    new MBTiles(filepath, function(err, d) {
        t.ifError(err);
        dst = d;
        dst._batchSize = 1;
        t.end();
    });
});

test('scanline: pipe', function(t) {
    var get = tilelive.createReadStream(src, {type:'scanline'});
    var put = tilelive.createWriteStream(dst);
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    get.pipe(put);
    put.on('stop', function() {
        t.deepEqual(get.stats, { ops:285, total: 285, skipped: 0, done: 285 });
        t.end();
    });
});

test('scanline: vacuum', function(t) {
    dst._db.exec('vacuum;', t.end);
});

test('scanline: verify tiles', function(t) {
    dst._db.get('select count(1) as count, sum(length(tile_data)) as size from tiles;', function(err, row) {
        t.ifError(err);
        t.equal(row.count, 285);
        t.equal(row.size, 477705);
        t.end();
    });
});

test('scanline: verify metadata', function(t) {
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

test('scanline: concurrency', function(t) {
    var fast = new Timedsource({time:10});
    var slow = new Timedsource({time:50});
    var get = tilelive.createReadStream(fast, {type:'scanline'});
    var put = tilelive.createWriteStream(slow);
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    get.once('length', function(length) {
        t.equal(length, 85, 'sets length to total');
        t.equal(get.length, 85, 'sets length to total');
    });
    get.pipe(put);
    setTimeout(function() {
        t.equal(get.length, 78, 'updates length as skips occur');
        t.deepEqual(get.stats, { ops: 32, total: 85, skipped: 7, done: 16 }, 'concurrency 10 at work');
    }, 20);
    put.on('stop', function() {
        t.equal(get.length, 43, 'updates length as skips occur');
        t.deepEqual(get.stats, { ops: 85, total: 85, skipped: 42, done: 85 });
        t.end();
    });
});

test('scanline: split into jobs', function(t) {
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
        var scanline = tilelive.createReadStream(src, {type: 'scanline', job: { total: total, num: num }});
        scanline.on('error', function(err) {
            t.ifError(err, 'Error reading fixture');
        });
        scanline.on('data', function(tile) {
            if (tile.hasOwnProperty('x')) { // filters out info objects
                results.push([tile.z, tile.x, tile.y].join('/'));
                tileCount++;
            }
        });
        scanline.on('end', function() {
            tilesPerJob.push(tileCount);
            if (num === total - 1) {
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
