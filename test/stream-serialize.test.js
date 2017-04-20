var test = require('tape');
var MBTiles = require('@mapbox/mbtiles');
var tilelive = require('..');
var fs = require('fs');
var path = require('path');
var deserialize = require('../lib/stream-util').deserialize;
var serialHeader = require('../lib/stream-util').serialHeader;

var src;

test('serialize: src', function(t) {
    new MBTiles(__dirname + '/fixtures/plain_1.mbtiles', function(err, s) {
        t.ifError(err);
        src = s;
        t.end();
    });
});

test('serialize: list', function(t) {
    var file = fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat'));
    var get = tilelive.createReadStream(src, {type:'list'});
    get.on('error', function(err) { t.ifError(err); });

    var out = "";
    file.pipe(get).pipe(tilelive.serialize())
        .on('data', function(data) {
            out += data;
        })
        .on('finish', function() {
            var data = out.split('\n').slice(1);
            t.equal(data.length, 77, 'correct number of tiles');

            function roundtrip() {
                data.forEach(function(tile) {
                    var obj = deserialize(tile);
                });
            }
            t.doesNotThrow(roundtrip, 'serialized data can be deserialized');
            t.end();
        });
});

test('serialize: scanline', function(t) {
    var get = tilelive.createReadStream(src, {type:'scanline'});
    get.on('error', function(err) { t.ifError(err); });

    var out = "";
    get.pipe(tilelive.serialize())
        .on('data', function(data) {
            out += data;
        })
        .on('finish', function() {
            var data = out.split('\n').slice(1);
            t.equal(data.length, 286, 'correct number of tiles');

            function roundtrip() {
                data.forEach(function(tile) {
                    var obj = deserialize(tile);
                });
            }
            t.doesNotThrow(roundtrip, 'serialized data can be deserialized');
            t.end();
        });
});

test('serialize: pyramid', function(t) {
    var get = tilelive.createReadStream(src, {type:'pyramid'});
    get.on('error', function(err) { t.ifError(err); });

    var out = "";
    get.pipe(tilelive.serialize())
        .on('error', function(err) { t.ifError(err); })
        .on('data', function(data) {
            out += data;
        })
        .on('finish', function() {
            var data = out.split('\n').slice(1);
            t.equal(data.length, 286, 'correct number of tiles');

            function roundtrip() {
                data.forEach(function(tile) {
                    var obj = deserialize(tile);
                });
            }
            t.doesNotThrow(roundtrip, 'serialized data can be deserialized');
            t.end();
        });
});

test('serialize: garbage', function(t) {
    t.plan(2);
    fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat'))
        .pipe(tilelive.serialize())
        .on('error', function(err) { t.ifError(err, 'no error should be thrown'); })
        .on('data', function(d) { t.ok(d.toString() === serialHeader + '\n', 'no data should be received'); })
        .on('end', function() { t.ok(true, 'no data was serialized'); });
});
