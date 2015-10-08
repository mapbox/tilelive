var test = require('tape');
var assert = require('assert');
var tilelive = require('../');
var orig = tilelive.protocols;

test('fails to load .mbtiles', function(t) {
    tilelive.protocols = {};
    tilelive.load('mbtiles://' + __dirname + '/fixtures/plain_1.mbtiles', function(err, source) {
        t.ok(err);
        t.equal('Invalid tilesource protocol: mbtiles:', err.message);
        t.end();
    });
});
test('auto extname .mbtiles', function(t) {
    tilelive.protocols = {};
    var uri = tilelive.auto(__dirname + '/fixtures/plain_1.mbtiles');
    t.equal('mbtiles:', uri.protocol);
    tilelive.load(uri, function(err, source) {
        t.ifError(err);
        t.ok(source);
        t.end();
    });
});
test('auto protocol mbtiles://', function(t) {
    tilelive.protocols = {};
    var uri = tilelive.auto(__dirname + '/fixtures/plain_1.mbtiles');
    t.equal('mbtiles:', uri.protocol);
    tilelive.load(uri, function(err, source) {
        t.ifError(err);
        t.ok(source);
        t.end();
    });
});
test('auto extname .tilejson', function(t) {
    tilelive.protocols = {};
    var uri = tilelive.auto(__dirname + '/fixtures/mapquest.tilejson');
    t.equal('tilejson:', uri.protocol);
    tilelive.load(tilelive.auto(__dirname + '/fixtures/mapquest.tilejson'), function(err, source) {
        t.ifError(err);
        t.ok(source);
        t.end();
    });
});
test('auto protocol tilejson://', function(t) {
    tilelive.protocols = {};
    var uri = tilelive.auto('tilejson://' + __dirname + '/fixtures/mapquest.tilejson');
    t.equal('tilejson:', uri.protocol);
    tilelive.load(uri, function(err, source) {
        t.ifError(err);
        t.ok(source);
        t.end();
    });
});
test('auto protocol tilejson+http://', function(t) {
    tilelive.protocols = {};
    var uri = tilelive.auto('tilejson+http://tile.stamen.com/toner/index.json');
    t.equal('tilejson+http:', uri.protocol);
    tilelive.load(uri, function(err, source) {
        t.ifError(err);
        t.ok(source);
        t.end();
    });
});
test('auto should parse qs ', function(t) {
    tilelive.protocols = {};
    var uri = tilelive.auto('http://tile.stamen.com/toner/{z}/{x}/{y}.png?foo=bar');
    t.equal('http:', uri.protocol);
    t.equal('bar', uri.query.foo);
    t.end();
});
test('cleanup', function(t) {
    tilelive.protocols = orig;
    t.end();
});
