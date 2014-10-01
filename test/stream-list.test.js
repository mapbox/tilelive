var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');
var Timedsource = require('./timedsource');

tilelive.stream.setConcurrency(10);

var filepath = path.join(tmp, 'list.mbtiles');

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
    try { fs.unlinkSync(filepath); } catch(e) {}
    new MBTiles(filepath, function(err, d) {
        t.ifError(err);
        dst = d;
        dst._batchSize = 1;
        t.end();
    });
});

test('list: pipe', function(t) {
    var file = fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat'));
    var get = tilelive.createReadStream(src, {type:'list'});
    var put = tilelive.createWriteStream(dst);
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    put.on('stop', function() {
        t.deepEqual(get.stats, { ops: 77, total: 77, skipped: 0, done: 77 });
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
        t.equal(row.count, 77);
        t.equal(row.size, 194061);
        t.end();
    });
});

test('list: concurrency', function(t) {
    var file = fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat'));
    var fast = new Timedsource({time:10});
    var slow = new Timedsource({time:50});
    var get = tilelive.createReadStream(fast, {type:'list'});
    var put = tilelive.createWriteStream(slow);
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    file.pipe(get).pipe(put);
    setTimeout(function() {
        t.deepEqual(get.stats, { ops:31, total: 77, skipped: 10, done: 21 }, 'concurrency 10');
    }, 40);
    put.on('stop', function() {
        t.deepEqual(get.stats, { ops:77, total: 77, skipped: 38, done: 77 });
        t.end();
    });
});

test('list: split into jobs', function(t) {
    runJob(1, 1, function() {                   // one job
        runJob(4, 1, function() {               // a few jobs
            runJob(285, 1, function() {         // as many jobs as there are tiles
                runJob(400, 1, t.end.bind(t));  // more jobs than there are tiles
            });
        });
    });

    var results = [];
    function runJob(total, num, done) {
        var list = tilelive.createReadStream(src, {type:'list', job: { total: total, num: num }});
        list.on('error', function(err) {
            t.ifError(err, 'Error reading fixture');
        });
        list.on('data', function(tile) {
            results.push(tile);
        });
        list.on('end', function() {
            if (num === total) {
                t.equal(results.length, 285, 'correct number of tiles across ' + total + ' jobs');

                var tiles = results.reduce(function(memo, tile) {
                    var id = [tile.z, tile.x, tile.y].join('/');
                    if (memo[id]) memo[id]++;
                    else memo[id] = 1;
                    return memo;
                }, {});
                for (var k in tiles) {
                    if (tiles[k] > 1) t.fail('tile repeated ' + tiles[k] + ' times with ' + total + ' jobs: ' + k);
                }
                results = [];
                done();
            } else {
                num++;
                runJob(total, num, done);
            }
        });
        fs.createReadStream(path.join(__dirname, 'fixtures', 'plain_1.tilelist'))
            .pipe(list);
    }
});
