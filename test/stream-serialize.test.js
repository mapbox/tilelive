var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');
var path = require('path');
var serializedType = require('../lib/stream-util').serializedType;

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
            var data = out.split('\n');
            t.equal(data.length, 77, 'correct number of tiles');

            function deserialize() {
                data.forEach(function(tile) {
                    var obj = serializedType(tile);
                    obj.deserialize(tile);
                });
            }
            t.doesNotThrow(deserialize, 'serialized data can be deserialized');
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
            var data = out.split('\n');
            t.equal(data.length, 286, 'correct number of tiles');

            function deserialize() {
                data.forEach(function(tile) {
                    var obj = serializedType(tile);
                    obj.deserialize(tile);
                });
            }
            t.doesNotThrow(deserialize, 'serialized data can be deserialized');
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
            var data = out.split('\n');
            t.equal(data.length, 286, 'correct number of tiles');

            function deserialize() {
                data.forEach(function(tile) {
                    var obj = serializedType(tile);
                    obj.deserialize(tile);
                });
            }
            t.doesNotThrow(deserialize, 'serialized data can be deserialized');
            t.end();
        });
});
