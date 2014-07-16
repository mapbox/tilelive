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
    t.equal(tile.buffer, undefined, 'empty buffer attribute');
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
    t.equal(tile.buffer, undefined, 'empty buffer attribute');
    t.end();
});

test('Tile: types', function(t) {
    var tile = new util.Tile(1, '2', 'a', new Buffer('hello'));
    t.equal(tile.z, 1, 'number accepted for z');
    t.equal(tile.x, 2, 'stringified number accepted for x');
    t.equal(tile.y, undefined, 'letters not accepted for y');
    t.equal(tile.buffer.toString(), 'hello', 'buffer accepted');

    tile = new util.Tile(1,2,3,"bozo");
    t.equal(tile.buffer, undefined, 'non-buffer not accepted');
    t.end();
});

test('Tile: serialize', function(t) {
    var tile, expected;

    tile = new util.Tile(1, '2', 'a', new Buffer('hello'));
    expected = '{"z":1,"x":2,"y":null,"buffer":"aGVsbG8="}';
    t.equal(tile.serialize(), expected, 'bad coords written as null');

    tile = new util.Tile(1, '2', 3, 'hello');
    expected = '{"z":1,"x":2,"y":3,"buffer":null}';
    t.equal(tile.serialize(), expected, 'bad buffer written as null');

    tile = new util.Tile(1, '2', 3, new Buffer('hello'));
    expected = '{"z":1,"x":2,"y":3,"buffer":"aGVsbG8="}';
    t.equal(tile.serialize(), expected, 'serialize tile as expected');

    tile = new util.Tile();
    expected = '{"z":null,"x":null,"y":null,"buffer":null}';
    t.equal(tile.serialize(), expected, 'serialize blank tile as expected');

    tile = new util.Tile('just', 'a', 'bunch', 'of', 1, 'garbage');
    expected = '{"z":null,"x":null,"y":null,"buffer":null}';
    t.equal(tile.serialize(), expected, 'serialize garbage tile as expected');

    t.end();
});

test('Tile: deserialize', function(t) {
    t.plan(4);
    
    var data, tile, actual, expected;

    tile = new util.Tile();
    data = '{"z":1,"x":2,"y":3,"buffer":"aGVsbG8="}';
    expected = new util.Tile(1, 2, 3, new Buffer('hello'));
    actual = tile.deserialize(data);
    t.deepEqual(actual, expected, 'good data deserialized as expected');

    tile = new util.Tile();
    data = '{"this": is not parsable, []}';
    try { tile.deserialize(data); }
    catch(err) {
        var valid = err instanceof util.DeserializationError;
        t.ok(valid, 'un-parsable data throws expected exception');
    }

    tile = new util.Tile();
    data = '{"parsable": "but", "invalid": true}';
    try { tile.deserialize(data); }
    catch(err) {
        var valid = err instanceof util.DeserializationError;
        t.ok(valid, 'invalid data throws expected exception');
    }

    tile = new util.Tile();
    data = '{"z":1,"x":2,"y":3,"buffer":null}';
    try { tile.deserialize(data); }
    catch(err) {
        var valid = err instanceof util.DeserializationError;
        t.ok(valid, 'missing buffer throws expected exception');
    }
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
    t.equal(inf.serialize(), '{"hello":"world"}', 'serializes object as expected');

    inf = new util.Info();
    t.equal(inf.serialize(), '{}', 'serializes blank as expected');
    t.end();
});

test('Info: deserialize', function(t) {
    t.plan(2);

    var inf = new util.Info();
    var data = '{"hello":"world"}';
    var expected = { hello: "world" };
    var actual = inf.deserialize('{"hello":"world"}');
    t.deepEqual(actual, expected, 'deserializes valid object');

    inf = new util.Info();
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
