var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');
var path = require('path');
var util = require('../lib/stream-util');
var assert = require('assert');

test('Tile: blank', function(t) {
    var tile;
    function newTile() {
        tile = new util.Tile();
    }
    t.doesNotThrow(newTile, 'no error when creating a blank tile');
    t.equal(tile.z, undefined, 'empty z attribute');
    t.equal(tile.x, undefined, 'empty x attribute');
    t.equal(tile.y, undefined, 'empty y attribute');
    t.equal(tile.buffer.length, 0, 'empty buffer attribute');
    t.end();
});

test('Tile: garbage', function(t) {
    var tile;
    function newTile() {
        tile = new util.Tile('just', 'a', 'bunch', 'of', 1, 'garbage');
    }
    t.doesNotThrow(newTile, 'no error when creating a garbage tile');
    t.equal(tile.z, undefined, 'empty z attribute');
    t.equal(tile.x, undefined, 'empty x attribute');
    t.equal(tile.y, undefined, 'empty y attribute');
    t.equal(tile.buffer.length, 0, 'empty buffer attribute');
    t.end();
});

test('Tile: types', function(t) {
    var tile = new util.Tile(1, '2', 'a', new Buffer('hello'));
    t.equal(tile.z, 1, 'number accepted for z');
    t.equal(tile.x, 2, 'stringified number accepted for x');
    t.equal(tile.y, undefined, 'letters not accepted for y');
    t.equal(tile.buffer.toString(), 'hello', 'buffer accepted');

    tile = new util.Tile(1,2,3,"bozo");
    t.equal(tile.buffer.length, 0, 'non-buffer rejected');
    t.end();
});

test('Tile: serialize', function(t) {
    var tile;
    t.plan(9);

    tile = new util.Tile(1, '2', 'a', new Buffer('hello'));
    try { tile.serialize(); }
    catch(err) {
        var valid = err instanceof util.SerializationError;
        t.ok(valid, 'bad coordinate throws expected error');
    }

    tile = new util.Tile(1, '2', 3, 'hello');
    t.equal(tile.serialize().length, 7, 'bad buffer not included in serialized buffer');

    tile = new util.Tile();
    try { tile.serialize(); }
    catch(err) {
        var valid = err instanceof util.SerializationError;
        t.ok(valid, 'empty tile throws expected error');
    }

    tile = new util.Tile('just', 'a', 'bunch', 'of', 1, 'garbage');
    try { tile.serialize(); }
    catch(err) {
        var valid = err instanceof util.SerializationError;
        t.ok(valid, 'garbage tile throws expected error');
    }

    tile = new util.Tile(1, '2', 3, new Buffer('hello'));
    var actual = tile.serialize();
    t.equal(actual.readUInt8(0), util.Tile.prototype.serializedTypeId, 'serialized typeId');
    t.equal(actual.readUInt16LE(1), 1, 'serialized z coord');
    t.equal(actual.readUInt16LE(3), 2, 'serialized x coord');
    t.equal(actual.readUInt16LE(5), 3, 'serialized y coord');
    t.equal(actual.slice(7).toString(), 'hello', 'serialized buffer');
});

test('Tile: deserialize', function(t) {
    t.plan(5);

    var data, tile, actual, expected;

    tile = new util.Tile();
    data = '{"this": is not allowed, []}';
    try { tile.deserialize(data); }
    catch(err) {
        var valid = err instanceof util.DeserializationError;
        t.ok(valid, 'non-buffer data throws expected exception');
    }

    expected = new util.Tile(1, 2, 3, new Buffer('hello'));
    data = expected.serialize();

    actual = new util.Tile();
    actual.deserialize(data);
    t.equal(actual.z, expected.z, 'z coord round-trip serialize --> deserialize');
    t.equal(actual.x, expected.x, 'x coord round-trip serialize --> deserialize');
    t.equal(actual.y, expected.y, 'y coord round-trip serialize --> deserialize');
    t.equal(actual.buffer.toString(), expected.buffer.toString(), 'buffer round-trip serialize --> deserialize');
});

test('Info: blank', function(t) {
    var tile;
    function newInfo() {
        tile = new util.Info();
    }
    t.doesNotThrow(newInfo, 'no error when creating a blank tile');
    t.end();
});

test('Info: serialize', function(t) {
    var inf = new util.Info({ hello: "world"});
    var actual = inf.serialize().slice(1).toString();
    t.equal(actual, '{"hello":"world"}', 'serializes object as expected');

    inf = new util.Info();
    actual = inf.serialize().slice(1).toString();
    t.equal(actual, '{}', 'serializes blank as expected');
    t.end();
});

test('Info: deserialize', function(t) {
    t.plan(2);

    var expected = new util.Info({ hello: "world" });
    var data = expected.serialize();
    var actual = new util.Info();
    actual.deserialize(data);
    t.equal(actual.hello, expected.hello, 'deserializes valid object');

    var inf = new util.Info();
    data = '{"this": is not parsable, []}';
    try { inf.deserialize(data); }
    catch(err) {
        var valid = err instanceof util.DeserializationError;
        t.ok(valid, 'unparsable data throws expected exception');
    }
});

test('serializedType: tile', function(t) {
    var tile = new util.Tile(1, 2, 3, new Buffer('hello'));
    var data = tile.serialize();
    actual = util.serializedType(data);
    t.ok(actual instanceof util.Tile, 'identifies a serialized tile');
    t.end();
});

test('serializedType: info', function(t) {
    var info = new util.Info({meta: "data"});
    var data = info.serialize();
    actual = util.serializedType(data);
    t.ok(actual instanceof util.Info, 'identifies serialized info');
    t.end();
});

test('serializedType: garbage', function(t) {
    t.plan(1);

    var data = ["neither", "tile", "nor", "info"];
    try { util.serializedType(data); }
    catch(err) {
        var valid = err instanceof util.DeserializationError;
        t.ok(valid, 'garbage data throws expected exception');
    }
});
