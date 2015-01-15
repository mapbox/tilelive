var test = require('tape');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');
var exec = require('child_process').exec;
var tilelive = require('../');
var util = require('util');
var concat = require('concat-stream');
var MBTiles = require('mbtiles');
//register protocols
MBTiles.registerProtocols(tilelive);
var crypto = require('crypto');

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
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('21/') !== -1, '21');
        t.end();
    });
});

test('copy bounds', function(t) {
    var filepath = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.copy_bounds.mbtiles');
    exec(__dirname + '/../bin/tilelive-copy --bounds=-180,-85,0,0 ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('59') !== -1, '59');
        t.end();
    });
});

test('copy list', function(t) {
    var filepath = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.copy_list.mbtiles');
    exec(__dirname + '/../bin/tilelive-copy --scheme=list --list=' + __dirname + '/fixtures/filescheme.flat ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('77') !== -1, '77');
        t.end();
    });
});

test('copy streams', function(t) {
    exec(__dirname + '/../bin/tilelive-copy ' + __dirname + '/fixtures/plain_1.mbtiles', {maxBuffer:5e6}, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('JSONBREAKFASTTIME\n') === 0);
        t.equal(stdout.length, 647000);
        t.end();
    });
});

test('copy part zero', function(t) {
    exec(__dirname + '/../bin/tilelive-copy ' + __dirname + '/fixtures/plain_1.mbtiles --part 0 --parts 10', function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.split('\n').length < 287, 'does not render all tiles');
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

test('tilelive copy: list', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy_list.mbtiles');
    var list = __dirname + '/fixtures/plain_1.tilelist';
    var options = {};
    options.type = 'list';
    options.progress = report;
    options.listStream = fs.createReadStream(list);
    tilelive.copy(src, dst, options, function(err){
        if (err) throw err;
        t.ifError(err);
        t.end();
    });
});

test('tilelive copy: missing liststream', function(t) {
    var src = __dirname + '/fixtures/plain_1.mbtiles';
    var dst = path.join(tmp, crypto.randomBytes(12).toString('hex') + '.tilelivecopy_liststream.mbtiles');
    var list = __dirname + '/fixtures/plain_1.tilelist';
    var options = {};
    options.type = 'list';
    options.progress = report;
    tilelive.copy(src, dst, options, function(err){
        t.ok(err);
        t.equal(err.message, 'You must provide a listStream');
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

// Used for progress report
function report(stats, p) {
    util.print(util.format('\r\033[K[%s] %s%% %s/%s @ %s/s | ✓ %s □ %s | %s left',
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
