var test = require('tape');
var MBTiles = require('@mapbox/mbtiles');
var tilelive = require('..');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');
var Nearemptysource = require('./nearemptysource');
var Containsdatasource = require('./containsdatasource');
var Timedsource = require('./timedsource');

tilelive.stream.setConcurrency(10);

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
    var filepath = path.join(tmp, 'pyramid_dst.mbtiles');
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
    put.on('stop', function() {
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
    var fast = new Timedsource({time:10});
    var slow = new Timedsource({time:50});
    var get = tilelive.createReadStream(fast, {type:'pyramid'});
    var put = tilelive.createWriteStream(slow);
    get.once('length', function(length) {
        t.equal(length, 85, 'sets length to total');
        t.equal(get.length, 85, 'sets length to total');
    });
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    get.pipe(put);
    setTimeout(function() {
        t.equal(get.length, 43, 'updates length as skips occur');
        t.deepEqual(get.stats, { ops:23, total: 85, skipped: 42, done: 53 });
    }, 40);
    put.on('stop', function() {
        t.equal(get.length, 43, 'updates length as skips occur');
        t.deepEqual(get.stats, { ops:45, total: 85, skipped: 42, done: 85 });
        t.end();
    });
});

test('pyramid: split into jobs', function(t) {
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
        var pyramid = tilelive.createReadStream(src, {type: 'pyramid', job: { total: total, num: num }});
        pyramid.on('error', function(err) {
            t.ifError(err, 'Error reading fixture');
        });
        pyramid.on('data', function(tile) {
            if (tile.hasOwnProperty('x')) { // filters out info objects
                results.push([tile.z, tile.x, tile.y].join('/'));
                tileCount++;
            }
        });
        pyramid.on('end', function() {
            tilesPerJob.push(tileCount);
            if (num === total - 1) {
                // t.equal(results.length, 285, 'correct number of tiles across ' + total + ' jobs');
                var tiles = results.reduce(function(memo, tile) {
                    if (memo[tile]) memo[tile]++;
                    else memo[tile] = 1;
                    return memo;
                }, {});
                for (var k in tiles) {
                    // if (tiles[k] > 1) t.fail('tile repeated ' + tiles[k] + ' times with ' + total + ' jobs: ' + k);
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

test('pyramid: err + no retry', function(assert) {
    var get = tilelive.createReadStream(new Timedsource({fail:1}), {type:'pyramid'});
    var put = tilelive.createWriteStream(new Timedsource({}));
    var errored = false;
    get.on('error', function(err) {
        if (errored) return;
        assert.equal(err.toString(), 'Error: Fatal', 'errors');
        errored = true;
        assert.end();
    });
    get.pipe(put);
});

test('pyramid: err + retry', function(assert) {
    require('../lib/stream-util').retryBackoff = 1;
    var get = tilelive.createReadStream(new Timedsource({fail:1}), {type:'pyramid', retry:1});
    var put = tilelive.createWriteStream(new Timedsource({}));
    get.on('error', function(err) { assert.ifError(err); });
    put.on('error', function(err) { assert.ifError(err); });
    put.on('stop', function() {
        require('../lib/stream-util').retryBackoff = 1000;
        assert.deepEqual(get.stats, { ops:45, total: 85, skipped: 42, done: 85 });
        assert.end();
    });
    get.pipe(put);
});

test('pyramid: invalid extent', function(assert) {
    assert.plan(1);
    var fakesrc = {
        getInfo: function(callback) {
            return callback(null, {
                name: 'invalid_extent_source',
                description: 'hey gurl',
                minzoom: 0,
                maxzoom: 6,
                bounds: [null, 128379137, NaN, undefined],
                center: [0,0,6]
            });
        }
    };

    require('../lib/stream-util').retryBackoff = 1;
    var get = tilelive.createReadStream(fakesrc, {type:'pyramid'});
    var put = tilelive.createWriteStream(new Timedsource({}));
    get.on('error', function(err) {         
        assert.equal(err.message, 'bounds must be an array of the form [west, south, east, north]');
    });
    get.pipe(put);
});

test('pyramid: works beyond valid extent', function(assert) {
    var src = new Nearemptysource({time:1});
    src.getInfo = function(callback) {
        return callback(null, {
            name: 'extra_wide_extent_source',
            description: 'hey boi',
            minzoom: 0,
            maxzoom: 0,
            bounds: [-180,-90,180,90],
            center: [0,0,0]
        });
    };

    var get = tilelive.createReadStream(src, {type:'pyramid'});
    var put = tilelive.createWriteStream(new Timedsource({}));
    get.pipe(put);
    put.on('stop', function() {
        assert.deepEqual(get.stats, { ops:1, total: 1, skipped: 1, done: 1 });
        assert.end();
    });
});

test('pyramid: smartskip', function(t) {
    var src = new Nearemptysource({time:1});
    var dst = new Timedsource({time:1});
    var get = tilelive.createReadStream(src, {type:'pyramid'});
    var put = tilelive.createWriteStream(dst);
    get.once('length', function(length) {
        t.equal(length, 85, 'sets length to total');
        t.equal(get.length, 85, 'sets length to total');
    });
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    get.pipe(put);
    put.on('stop', function() {
        // Final length should be Math.pow(4,2)/2 + Math.pow(4,3)/2
        t.equal(get.length, 40, 'updates length as skips occur');
        t.deepEqual(get.stats, { ops:69, total: 85, skipped: 45, done: 85 });
        t.end();
    });
});

test('pyramid: contains data', function(t) {
    var src = new Containsdatasource({time:1});
    var dst = new Timedsource({time:1});
    var get = tilelive.createReadStream(src, {type:'pyramid'});
    var put = tilelive.createWriteStream(dst);
    get.once('length', function(length) {
        t.equal(length, 85, 'sets length to total');
        t.equal(get.length, 85, 'sets length to total');
    });
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    get.pipe(put);
    put.on('stop', function() {
        // Final length should be Math.pow(4,2)/2 + Math.pow(4,3)/2 + 1
        t.equal(get.length, 41, 'updates length as skips occur');
        t.deepEqual(get.stats, { ops:45, total: 85, skipped: 44, done: 85 });
        t.end();
    });
});
