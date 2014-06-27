var test = require('tape');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');
var exec = require('child_process').exec;

var filepath = path.join(tmp, 'copy.mbtiles');
try { fs.unlinkSync(filepath); } catch(e) {}

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
        t.ok(stdout.indexOf('285/   285') !== -1, '285/285');
        t.end();
    });
});

test('copy min/max', function(t) {
    exec(__dirname + '/../bin/tilelive-copy --minzoom=1 --maxzoom=2 ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('20/    20') !== -1, '20/20');
        t.end();
    });
});

test('copy bounds', function(t) {
    exec(__dirname + '/../bin/tilelive-copy --bounds=-180,-85,0,0 ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('86/    86') !== -1, '86/86');
        t.end();
    });
});

test('copy list', function(t) {
    exec(__dirname + '/../bin/tilelive-copy --scheme=list --list=' + __dirname + '/fixtures/filescheme.flat ' + __dirname + '/fixtures/plain_1.mbtiles ' + filepath, function(err, stdout, stderr) {
        t.ifError(err, 'no errors');
        t.ok(stdout.indexOf('100.0000%') !== -1, 'pct complete');
        t.ok(stdout.indexOf('77/    77') !== -1, '77/77');
        t.end();
    });
});

