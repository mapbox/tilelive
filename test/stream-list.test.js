var test = require('tape');
var MBTiles = require('@mapbox/mbtiles');
var tilelive = require('..');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');
var Timedsource = require('./timedsource');

tilelive.stream.setConcurrency(10);

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
    var filepath = path.join(tmp, 'list_dst.mbtiles');
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

test('list: no new-line at end of stream', function(t) {
    var file = fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat.no-newline'));
    var get = tilelive.createReadStream(src, {type:'list'});
    get.on('error', function(err) { t.ifError(err); });
    get.on('end', function() {
        t.deepEqual(get.stats, { ops: 77, total: 77, skipped: 0, done: 77 });
        t.end();
    });
    get.on('data', function(d) { });
    file.pipe(get);
});

test('list: new-line at the start of a file', function(t) {
    var file = fs.createReadStream(path.join(__dirname, 'fixtures', 'newline-start.tiles'));
    var get = tilelive.createReadStream(new Timedsource({time:10}), { type: 'list' });
    get.on('finish', function() {
        t.equal(get.length, 20, 'expected number of tiles read');
        t.end();
    });
    file.pipe(get);
});

test('list: tilelist writes split mid-tile', function(t) {
    var get = tilelive.createReadStream(src, {type:'list'});
    get.on('error', function(err) { t.ifError(err); });
    get.on('end', function() {
        t.deepEqual(get.stats, { ops: 9, total: 9, skipped: 0, done: 9 });
        t.end();
    });
    get.on('data', function(d) { });
    get.write('3/1/2\n3/2/2\n3/3/2\n3/4/2\n3');
    setTimeout(function() {
        get.write('/5/2\n3/6/2\n3/7/2\n3/0/3\n3/1/3');
        get.end();
    }, 500);
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
        t.deepEqual(get.stats, { done:30, ops:40, skipped:14, total:77 }, 'concurrency 10');
    }, 40);
    put.on('stop', function() {
        t.deepEqual(get.stats, { ops:77, total: 77, skipped: 38, done: 77 });
        t.end();
    });
});

test('list: split into jobs', function(t) {
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
        var list = tilelive.createReadStream(src, {type:'list', job: { total: total, num: num }});
        list.on('error', function(err) {
            t.ifError(err, 'Error reading fixture');
        });
        list.on('data', function(tile) {
            if (tile.hasOwnProperty('x')) { // filters out info objects
                results.push([tile.z, tile.x, tile.y].join('/'));
                tileCount++;
            }
        });
        list.on('end', function() {
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
        fs.createReadStream(path.join(__dirname, 'fixtures', 'plain_1.tilelist'))
            .pipe(list);
    }
});

test('list: err + no retry', function(assert) {
    var file = fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat'));
    var get = tilelive.createReadStream(new Timedsource({fail:1}), {type:'list'});
    var put = tilelive.createWriteStream(new Timedsource({}));
    var errored = false;
    get.on('error', function(err) {
        if (errored) return;
        assert.equal(err.toString(), 'Error: Fatal', 'errors');
        errored = true;
        assert.end();
    });
    file.pipe(get).pipe(put);
});

test('list: err + retry', function(assert) {
    require('../lib/stream-util').retryBackoff = 1;
    var file = fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat'));
    var get = tilelive.createReadStream(new Timedsource({fail:1}), {type:'list', retry:1});
    var put = tilelive.createWriteStream(new Timedsource({}));
    file.pipe(get).pipe(put);
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    put.on('stop', function() {
        require('../lib/stream-util').retryBackoff = 1000;
        assert.deepEqual(get.stats, { ops:77, total: 77, skipped: 38, done: 77 });
        assert.end();
    });
});

test('list: invalid doubleend', function(assert) {
    var file = fs.createReadStream(path.join(__dirname,'fixtures','list-doubleend'));
    var get = tilelive.createReadStream(new Timedsource({}), {type:'list'});
    var put = tilelive.createWriteStream(new Timedsource({}));
    var errored = false;
    file.pipe(get).pipe(put);
    put.on('stop', function(err) {
        assert.deepEqual(get.stats.total, 6);
        assert.end();
    });
});

test('list: invalid coord', function(assert) {
    var file = fs.createReadStream(path.join(__dirname,'fixtures','list-invalid'));
    var get = tilelive.createReadStream(new Timedsource({}), {type:'list'});
    var put = tilelive.createWriteStream(new Timedsource({}));
    var errored = false;
    get.on('error', function(err) {
        assert.equal(err.toString(), 'Error: Invalid tile coordinate 2/0/asdf');
        assert.end();
    });
    file.pipe(get).pipe(put);
});

test('list: extreme chunk-splitting', function(assert) {
    var list = fs.readFileSync(path.join(__dirname,'fixtures','list-100'), 'utf8');
    var get = tilelive.createReadStream(new Timedsource({}), {type:'list'});
    for (var i = 0; i < list.length; i++) get.write(list[i]);
    get.on('finish', function() {
        assert.deepEqual(get.stats.total, 100);
        assert.end();
    });
    get.end();
});

test('list: 10000', function(assert) {
    var file = fs.createReadStream(path.join(__dirname,'fixtures','list-10000'));
    var get = tilelive.createReadStream(new Timedsource({}), {type:'list'});
    var put = tilelive.createWriteStream(new Timedsource({}));
    var errored = false;
    file.pipe(get).pipe(put);
    put.on('stop', function(err) {
        assert.deepEqual(get.stats.total, 10000);
        assert.end();
    });
});
