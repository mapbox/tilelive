var test = require('tape');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');
var exec = require('child_process').exec;

var filepath = path.join(tmp, 'copy.mbtiles');
try { fs.unlinkSync(filepath); } catch(e) {}

var s3url = 's3://tilestream-tilesets-development/carol-staging/mapbox-tile-copy/{z}/{x}/{y}.png';

test('copy usage', function(t) {
    exec(__dirname + '/../bin/tilelive-copy', function(err, stdout, stderr) {
        t.equal(1, err.code, 'exit 1');
        t.ok(/Usage:/.test(stdout), 'shows usage');
        t.end();
    });
});

test('copy copies', function(t) {
    exec(__dirname + '/../bin/tilelive-copy ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('286/') !== -1, '286');
        t.end();
    });
});

test('copy copies to s3', function(t) {
    exec(__dirname + '/../bin/tilelive-copy ' + __dirname + '/fixtures/plain_1.mbtiles ' + s3url, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.end();
    });
});

test('copy min/max', function(t) {
    exec(__dirname + '/../bin/tilelive-copy --minzoom=1 --maxzoom=2 ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('21/') !== -1, '21');
        t.end();
    });
});

test('copy bounds', function(t) {
    exec(__dirname + '/../bin/tilelive-copy --bounds=-180,-85,0,0 ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('59') !== -1, '59');
        t.end();
    });
});

test('copy list', function(t) {
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

