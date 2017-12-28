var test = require('tape');
var MBTiles = require('@mapbox/mbtiles');
var tilelive = require('..');
var fs = require('fs');
var path = require('path');
var Tile = require('../lib/stream-util').Tile;
var Info = require('../lib/stream-util').Info;
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
            var counter = out.split('\n').slice(1).reduce(function(memo, tile) {
                var obj = deserialize(tile);
                if (obj instanceof Tile) memo.tiles++;
                if (obj instanceof Info) memo.info++;
                return memo;
            }, { tiles: 0, info: 0 });
            t.deepEqual(counter, { tiles: 77, info: 0 }, 'deserialized accurately');
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
            var counter = out.split('\n').slice(1).reduce(function(memo, tile) {
                var obj = deserialize(tile);
                if (obj instanceof Tile) memo.tiles++;
                if (obj instanceof Info) memo.info++;
                return memo;
            }, { tiles: 0, info: 0 });
            t.deepEqual(counter, { tiles: 285, info: 1 }, 'deserialized accurately');
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
            var counter = out.split('\n').slice(1).reduce(function(memo, tile) {
                var obj = deserialize(tile);
                if (obj instanceof Tile) memo.tiles++;
                if (obj instanceof Info) memo.info++;
                return memo;
            }, { tiles: 0, info: 0 });
            t.deepEqual(counter, { tiles: 285, info: 1 }, 'deserialized accurately');
            t.end();
        });
});

test('serialize: garbage', function(t) {
    t.plan(2);
    fs.createReadStream(path.join(__dirname,'fixtures','filescheme.flat'))
        .pipe(tilelive.serialize())
        .on('error', function(err) {
            t.equal(err && err.toString(), 'SerializationError: Invalid data', 'no error should be thrown');
        })
        .on('data', function(d) {
            t.equal(d.toString(), serialHeader + '\n', 'only data passed is serialization header');
        })
        .on('end', function() {
            t.fail('stream interrupted by error');
        });
});
