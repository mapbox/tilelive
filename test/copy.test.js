var test = require('tape');
var fs = require('fs');
var stream = require('stream');
var tmp = require('os').tmpdir();
var path = require('path');
var exec = require('child_process').exec;
var tilelive = require('../');
var util = require('util');
var concat = require('concat-stream');
var combine = require('stream-combiner');
var MBTiles = require('@mapbox/mbtiles');
//register protocols
MBTiles.registerProtocols(tilelive);
var crypto = require('crypto');
var Timedsource = require('./timedsource');
var out = [];

var s3url = 's3://tilestream-tilesets-development/carol-staging/mapbox-tile-copy/{z}/{x}/{y}.png';

test('copy usage', function(t) {
    exec(__dirname + '/../bin/tilelive-copy', function(err, stdout, stderr) {
        t.equal(1, err.code, 'exit 1');
        t.ok(/Usage:/.test(stdout), 'shows usage');
        t.end();
    });
});

test('copy copies', function(t) {
    var filepath = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.copy.mbtiles');
    exec(__dirname + '/../bin/tilelive-copy ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('286/') !== -1, '286');
        t.end();
    });
});

// test('copy copies to s3', function(t) {
//     exec(__dirname + '/../bin/tilelive-copy ' + __dirname + '/fixtures/plain_1.mbtiles ' + s3url, function(err, stdout, stderr) {
//         t.ifError(err, 'no errors');
//         t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
//         t.end();
//     });
// });

test('copy min/max', function(t) {
    var filepath = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.copy_minmax.mbtiles');
    exec(__dirname + '/../bin/tilelive-copy --minzoom=1 --maxzoom=2 ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.equal(stderr, '', 'no stderr');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('21/') !== -1, '21');
        t.end();
    });
});

test('copy bounds', function(t) {
    var filepath = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.copy_bounds.mbtiles');
    exec(__dirname + '/../bin/tilelive-copy --bounds=-180,-85,0,0 ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.equal(stderr, '', 'no stderr');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('59') !== -1, '59');
        t.end();
    });
});

test('copy list', function(t) {
    var filepath = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.copy_list.mbtiles');
    exec(__dirname + '/../bin/tilelive-copy --scheme=list --list=' + __dirname + '/fixtures/filescheme.flat ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.equal(stderr, '', 'no stderr');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('77') !== -1, '77');
        t.end();
    });
});

test('copy streams', function(t) {
    exec(__dirname + '/../bin/tilelive-copy ' + __dirname + '/fixtures/plain_1.mbtiles', {maxBuffer:5e6}, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.equal(stderr, '', 'no stderr');
        t.ok(stdout.indexOf('JSONBREAKFASTTIME\n') === 0);
        t.equal(stdout.length, 647002);
        t.end();
    });
});

test('copy part zero', function(t) {
    exec(__dirname + '/../bin/tilelive-copy ' + __dirname + '/fixtures/plain_1.mbtiles --part 0 --parts 10', function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.equal(stderr, '', 'no stderr');
        t.ok(stdout.split('\n').length < 287, 'does not render all tiles');
        t.end();
    });
});

test('copy timeout', function(t) {
    exec(__dirname + '/../bin/tilelive-copy ' + __dirname + '/fixtures/plain_1.mbtiles --timeout=1', function(err, stdout, stderr) {
        t.ok(err);
        t.ok(/Copy operation timed out/.test(stderr));
        t.end();
    });
});

test('copy slow', function(t) {
    var filepath = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.copy_slow.mbtiles');
    exec(__dirname + '/../bin/tilelive-copy --slow=20 ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok((/\[slow tile\] (get|put) \d+\/\d+\/\d+ \d+ms/).test(stderr), 'logs slow tiles to stderr');
        t.end();
    });
});

test('tilelive.copy', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy.mbtiles');
    var options = {
        progress: report
    };

    tilelive.copy(src, dst, options, function(err){
        if (err) throw err;
        t.ifError(err);
        t.end();
    });
});

test('tilelive.copy: concurrency', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy_concurrency.mbtiles');
    var options = {
        progress: report,
        concurrency: 10
    };

    tilelive.copy(src, dst, options, function(err){
        if (err) throw err;
        t.ifError(err);
        t.end();
    });
});

test('tilelive.copy: onslow', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy_concurrency.mbtiles');
    var log = [];
    var options = {
        slow: 20,
        onslow: function(method, z, x, y, time) {
            t.equal(/^(get|put)$/.test(method), true);
            t.equal(typeof z, 'number');
            t.equal(typeof x, 'number');
            t.equal(typeof y, 'number');
            t.equal(typeof time, 'number');
            log.push({method:method, z:z, x:x, y:y, time:time});
        },
        progress: report,
        concurrency: 10
    };

    tilelive.copy(src, dst, options, function(err){
        if (err) throw err;
        t.ifError(err);
        t.equal(log.length > 0, true, 'calls onslow callback');
        tilelive.stream.slowTime = 60e3;
        t.end();
    });
});

test('tilelive copy: list', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy_list.mbtiles');
    var list = __dirname + '/fixtures/plain_1.tilelist';
    var options = {};
    var stats = {};
    options.type = 'list';
    options.progress = function(s) { stats = s; };
    options.listStream = fs.createReadStream(list);
    tilelive.copy(src, dst, options, function(err){
        if (err) throw err;
        t.equal(stats.ops, 285, '285 ops');
        t.ifError(err);
        t.end();
    });
});

test('tilelive copy: list auto', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy_listauto.mbtiles');
    var options = {};
    var stats = {};
    options.type = 'list';
    options.progress = function(s) { stats = s; };
    tilelive.copy(src, dst, options, function(err){
        if (err) throw err;
        t.equal(stats.ops, 285, '285 ops');
        t.ifError(err);
        t.end();
    });
});

test('tilelive copy: missing liststream', function(t) {
    var src = 'tilejson+http://api.mapbox.com/v3/mapbox.world-bright.json';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy_liststream.mbtiles');
    var options = {};
    options.type = 'list';
    options.progress = report;
    tilelive.copy(src, dst, options, function(err){
        t.ok(err);
        t.equal(err.message, 'You must provide a listStream');
        t.end();
    });
});

test('tilelive.copy: close src/dst', function(t) {
    var src = new Timedsource({});
    src.flag = false;
    src.close = function(callback) {
        this.flag = true;
        callback();
    };

    var dst = new Timedsource({});
    dst.flag = false;
    dst.close = function(callback) {
        this.flag = true;
        callback();
    };

    var options = {
        progress: report,
        close: true
    };

    tilelive.copy(src, dst, options, function(err){
        if (err) throw err;
        t.ifError(err);
        t.equal(src.flag, true);
        t.equal(dst.flag, true);
        t.end();
    });
});

test('tilelive.copy: outstream', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = false;
    var result;
    var outstream = concat({encoding: 'string'}, function(data) { result = data; });
    var options = {
        outStream: outstream
    };

    tilelive.copy(src, dst, options, function(err){
        if (err) throw err;
        t.ok(result.indexOf('JSONBREAKFASTTIME\n') === 0);
        t.ifError(err);
        t.end();
    });
});

test('tilelive.copy: stdout', function(t) {
    var src = __dirname + '/fixtures/empty.mbtiles';
    var dst = false;
    var result;
    var options = {
        outStream: process.stdout
    };

    tilelive.copy(src, dst, options, function(err){
        if (err) throw err;
        t.ifError(err);
        t.end();
    });
});

test('tilelive.copy: missing outstream', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = false;
    var result;
    var options = {
        progress: report
    };

    tilelive.copy(src, dst, options, function(err){
        t.ok(err);
        t.equal(err.message, 'You must provide either a dsturi or an output stream');
        t.end();
    });
});

test('tilelive.copy: list with outstream', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = false;
    var result;
    var outstream = concat({encoding: 'string'}, function(data) { result = data; });
    var list = __dirname + '/fixtures/plain_1.tilelist';
    var options = {};
    options.type = 'list';
    options.progress = report;
    options.listStream = fs.createReadStream(list);
    options.outStream = outstream;

    tilelive.copy(src, dst, options, function(err){
        if (err) throw err;
        t.ok(result.indexOf('JSONBREAKFASTTIME\n') === 0);
        t.ifError(err);
        t.end();
    });
});

test('tilelive.copy: list error', function(t) {
    var uri = 'mbtiles://' + path.resolve(__dirname, 'fixtures', 'null-tile.mbtiles');
    tilelive.load(uri, function(err, src) {
        var result;
        var outstream = concat({encoding: 'string'}, function(data) { result = data; });
        options = {
            type: 'list',
            listStream: src.createZXYStream(),
            outStream: outstream
        };

        t.plan(1);
        tilelive.copy(src, null, options, function(err) {
            t.pass('callback fired once');
        });
    });
});

test('tilelive.copy + write err (no retry)', function(t) {
    var src = new Timedsource({});
    var dst = new Timedsource({fail:1});
    var options = {};
    tilelive.copy(src, dst, options, function(err){
        t.equal(err.toString(), 'Error: Fatal');
        t.end();
    });
});

// Tests that options.retry is passed through to write stream.
test('tilelive.copy + write err (retry)', function(t) {
    require('../lib/stream-util').retryBackoff = 1;
    var src = new Timedsource({});
    var dst = new Timedsource({fail:1});
    var options = { retry: 1 };
    tilelive.copy(src, dst, options, function(err){
        require('../lib/stream-util').retryBackoff = 1000;
        t.ifError(err);
        t.equal(dst.fails['0/0/0'], 1, 'failed x1');
        t.end();
    });
});

test('tilelive.copy + read err (no retry)', function(t) {
    var src = new Timedsource({fail:1});
    var dst = new Timedsource({});
    var options = {};
    tilelive.copy(src, dst, options, function(err){
        t.equal(err.toString(), 'Error: Fatal');
        t.end();
    });
});

// Tests that options.retry is passed through to read stream.
test('tilelive.copy + write err (retry)', function(t) {
    require('../lib/stream-util').retryBackoff = 1;
    var src = new Timedsource({fail:1});
    var dst = new Timedsource({});
    var options = { retry: 1 };
    tilelive.copy(src, dst, options, function(err){
        require('../lib/stream-util').retryBackoff = 1000;
        t.ifError(err);
        t.equal(src.fails['0/0/0'], 1, 'failed x1');
        t.end();
    });
});

test('tilelive.copy timeout', function(t) {
    var src = new Timedsource({timeout: 1000});
    var dst = new Timedsource({});
    var options = { timeout: 1000, maxzoom: 21 };
    tilelive.copy(src, dst, options, function(err) {
        t.ok(err, 'expected error message');
        t.equal(err.message, 'Copy operation timed out', 'timeout error');
        t.end();
    });
});

test('tilelive.copy timeout does not always fail at timeout interval', function(t) {
    var src = new Timedsource({timeout: 3000});
    var dst = new Timedsource({});
    var options = { timeout: 1000, maxzoom: 21 };
    tilelive.copy(src, dst, options, done);

    function done(err) {
        if (done.finished) return;
        t.ifError(err, 'should not error');
        done.finished = true;
        t.ok('kept copying past timeout');
        t.end();
    }
    setTimeout(done, 2000);
});

test('tilelive.copy transform', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy.mbtiles');
    var transform = new stream.Transform({ objectMode: true });
    var count = 0;
    transform._transform = function(tile, enc, callback) {
        count++;
        transform.push(tile);
        callback();
    };

    tilelive.copy(src, dst, { transform: transform }, function(err){
        t.ifError(err, 'success');
        t.equal(count, 286, 'tiles were passed through transform stream');
        t.end();
    });
});

test('tilelive.copy transform errors', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy.mbtiles');
    var transform = new stream.Transform({ objectMode: true });
    transform._transform = function(tile, enc, callback) {
        return callback(new Error('hello error'));
    };

    tilelive.copy(src, dst, { transform: transform }, function(err){
        t.ok(err, 'failed');
        t.equal(err.message, 'hello error', 'error was passed to the callback');
        t.end();
    });
});

test('tilelive.copy transform with a transform-like stream', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy.mbtiles');

    var transform1 = new stream.Transform({ objectMode: true });
    var count1 = 0;
    transform1._transform = function(tile, enc, callback) {
        count1++;
        transform1.push(tile);
        callback();
    };

    var transform2 = new stream.Transform({ objectMode: true });
    var count2 = 0;
    transform2._transform = function(tile, enc, callback) {
        count2++;
        transform2.push(tile);
        callback();
    };

    tilelive.copy(src, dst, { transform: combine(transform1, transform2) }, function(err){
        t.ifError(err, 'success');
        t.equal(count1, 286, 'tiles were passed through transform stream');
        t.equal(count2, 286, 'tiles were passed through transform stream');
        t.end();
    });
});

test('tilelive.copy not a transform', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy.mbtiles');
    var transform = new stream.Writable({ objectMode: true });
    var count = 0;
    transform._write = function(tile, enc, callback) {
        count++;
        transform.push(tile);
        callback();
    };

    tilelive.copy(src, dst, { transform: transform }, function(err){
        t.equal(err.message, 'You must provide a valid transform stream', 'expected error');
        t.equal(count, 0, 'no tiles were copied');
        t.end();
    });
});

// Used for progress report
function report(stats, p) {
    console.log(util.format('\r\033[K[%s] %s%% %s/%s @ %s/s | ✓ %s □ %s | %s left',
        pad(formatDuration(process.uptime()), 4, true),
        pad((p.percentage).toFixed(4), 8, true),
        pad(formatNumber(p.transferred),6,true),
        pad(formatNumber(p.length),6,true),
        pad(formatNumber(p.speed),4,true),
        formatNumber(stats.done - stats.skipped),
        formatNumber(stats.skipped),
        formatDuration(p.eta)
    ));
}

function formatDuration(duration) {
    var seconds = duration % 60;
    duration -= seconds;
    var minutes = (duration % 3600) / 60;
    duration -= minutes * 60;
    var hours = (duration % 86400) / 3600;
    duration -= hours * 3600;
    var days = duration / 86400;

    return (days > 0 ? days + 'd ' : '') +
        (hours > 0 || days > 0 ? hours + 'h ' : '') +
        (minutes > 0 || hours > 0 || days > 0 ? minutes + 'm ' : '') +
        seconds + 's';
}

function pad(str, len, r) {
    while (str.length < len) str = r ? ' ' + str : str + ' ';
    return str;
}

function formatNumber(num) {
    num = num || 0;
    if (num >= 1e6) {
        return (num / 1e6).toFixed(2) + 'm';
    } else if (num >= 1e3) {
        return (num / 1e3).toFixed(1) + 'k';
    } else {
        return num.toFixed(0);
    }
    return num.join('.');
}

function timeRemaining(progress) {
    return Math.floor(
        (process.uptime()) * (1 / progress) -
        (process.uptime())
    );
}
