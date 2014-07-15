var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');
var path = require('path');

var src;

test('stream-api: src', function(t) {
    new MBTiles(__dirname + '/fixtures/plain_1.mbtiles', function(err, s) {
        t.ifError(err);
        src = s;
        t.end();
    });
});

test('stream-api: valid readable', function(t) {
    var fn = tilelive.createReadStream.bind(tilelive, src, { type: 'list' });
    t.doesNotThrow(fn);
    t.end();
});

test('stream-api: invalid reabable', function(t) {
    var fn = tilelive.createReadStream.bind(tilelive, src, { type: 'put' });
    t.throws(fn);
    t.end();
});

test('stream-api: valid writable', function(t) {
    var fn = tilelive.createWriteStream.bind(tilelive, src, { type: 'put' });
    t.doesNotThrow(fn);
    t.end();
});

test('stream-api: invalid writable', function(t) {
    var fn = tilelive.createWriteStream.bind(tilelive, src, { type: 'list' });
    t.throws(fn);
    t.end();
});
