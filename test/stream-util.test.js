var test = require('tape');
var MBTiles = require('@mapbox/mbtiles');
var tilelive = require('..');
var fs = require('fs');
var path = require('path');
var util = require('../lib/stream-util');
var assert = require('assert');
var Timedsource = require('./timedsource');
var EventEmitter = require('events').EventEmitter;

test('retryBackoff (setup)', function(assert) {
    util.retryBackoff = 10;
    assert.end();
});

test('putTileRetry fail=2, tries=2', function(assert) {
    var source = new Timedsource({fail:2});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.putTileRetry(source, 0, 0, 0, new Buffer(0), 2, emitter, function(err) {
        assert.equal(source.fails['0/0/0'], 2, 'failed x2');
        assert.ifError(err, 'no error');
        assert.end();
    });
});

test('putTileRetry fail=2, retry=1', function(assert) {
    var source = new Timedsource({fail:2});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.putTileRetry(source, 0, 0, 0, new Buffer(0), 1, emitter, function(err) {
        assert.equal(source.fails['0/0/0'], 2, 'failed x2');
        assert.equal(err.toString(), 'Error: Fatal', 'passes error');
        assert.end();
    });
});

test('putTileRetry fail=1, retry=0', function(assert) {
    var source = new Timedsource({fail:1});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.putTileRetry(source, 0, 0, 0, new Buffer(0), 0, emitter, function(err) {
        assert.equal(source.fails['0/0/0'], 1, 'failed x1');
        assert.equal(err.toString(), 'Error: Fatal', 'passes error');
        assert.end();
    });
});

test('putTileRetry fail=0, retry=0', function(assert) {
    var source = new Timedsource({fail:0});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.putTileRetry(source, 0, 0, 0, new Buffer(0), 0, emitter, function(err) {
        assert.equal(source.fails['0/0/0'], undefined, 'failed x0');
        assert.ifError(err, 'no error');
        assert.end();
    });
});

test('putTileRetry (slow)', function(assert) {
    util.slowTime = 50;
    var source = new Timedsource({fail:0, time:100});
    var emitter = new EventEmitter();
    emitter.on('slow', function(method, z, x, y, time) {
        assert.equal(method, 'put', 'method = put');
        assert.equal(z, 0, 'z = 0');
        assert.equal(z, 0, 'x = 0');
        assert.equal(z, 0, 'y = 0');
        assert.equal(time > 50, true, 'time taken is > 50ms');
        util.slowTime = 60e3;
        assert.end();
    });
    util.putTileRetry(source, 0, 0, 0, new Buffer(0), 0, emitter, function(err) {
        assert.equal(source.fails['0/0/0'], undefined, 'failed x0');
        assert.ifError(err, 'no error');
    });
});

test('putTileRetry (slow=0)', function(assert) {
    util.slowTime = 0;
    var source = new Timedsource({fail:0, time:100});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.putTileRetry(source, 0, 0, 0, new Buffer(0), 0, emitter, function(err) {
        assert.equal(source.fails['0/0/0'], undefined, 'failed x0');
        assert.ifError(err, 'no error');
        assert.end();
    });
});

test('getTileRetry fail=2, retry=2', function(assert) {
    var source = new Timedsource({fail:2});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.getTileRetry(source, 0, 0, 0, 2, emitter, function(err, data, headers) {
        assert.equal(source.fails['0/0/0'], 2, 'failed x2');
        assert.ifError(err, 'no error');
        assert.equal(data instanceof Buffer, true, 'passes buffer');
        assert.deepEqual(headers, {}, 'passes headers');
        assert.end();
    });
});

test('getTileRetry fail=2, retry=1', function(assert) {
    var source = new Timedsource({fail:2});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.getTileRetry(source, 0, 0, 0, 1, emitter, function(err, data, headers) {
        assert.equal(source.fails['0/0/0'], 2, 'failed x2');
        assert.equal(err.toString(), 'Error: Fatal', 'passes error');
        assert.end();
    });
});


test('getTileRetry fail=1, retry=0', function(assert) {
    var source = new Timedsource({fail:1});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.getTileRetry(source, 0, 0, 0, 0, emitter, function(err, data, headers) {
        assert.equal(source.fails['0/0/0'], 1, 'failed x1');
        assert.equal(err.toString(), 'Error: Fatal', 'passes error');
        assert.end();
    });
});

test('getTileRetry fail=0, retry=0', function(assert) {
    var source = new Timedsource({fail:0});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.getTileRetry(source, 0, 0, 0, 0, emitter, function(err, data, headers) {
        assert.equal(source.fails['0/0/0'], undefined, 'failed x0');
        assert.ifError(err, 'no error');
        assert.equal(data instanceof Buffer, true, 'passes buffer');
        assert.deepEqual(headers, {}, 'passes headers');
        assert.end();
    });
});

test('getTileRetry Does Not Exist, retry=3', function(assert) {
    var source = new Timedsource({fail:0});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.getTileRetry(source, 1, 1, 0, 3, emitter, function(err, data, headers) {
        assert.equal(source.gets, 1, '1 attempt');
        assert.equal(err.toString(), 'Error: Tile does not exist');
        assert.end();
    });
});

test('getTileRetry (slow)', function(assert) {
    util.slowTime = 50;
    var source = new Timedsource({fail:0, time:100});
    var emitter = new EventEmitter();
    emitter.on('slow', function(method, z, x, y, time) {
        assert.equal(method, 'get', 'method = get');
        assert.equal(z, 0, 'z = 0');
        assert.equal(z, 0, 'x = 0');
        assert.equal(z, 0, 'y = 0');
        assert.equal(time > 50, true, 'time taken is > 50ms');
        util.slowTime = 60e3;
        assert.end();
    });
    util.getTileRetry(source, 0, 0, 0, 0, emitter, function(err, data, headers) {
        assert.equal(source.fails['0/0/0'], undefined, 'failed x0');
        assert.ifError(err, 'no error');
        assert.equal(data instanceof Buffer, true, 'passes buffer');
        assert.deepEqual(headers, {}, 'passes headers');
    });
});

test('getTileRetry (slow=0)', function(assert) {
    util.slowTime = 0;
    var source = new Timedsource({fail:0, time:50});
    var emitter = new EventEmitter();
    emitter.on('slow', function() { assert.fail('does not emit "slow" event'); });
    util.getTileRetry(source, 0, 0, 0, 0, emitter, function(err, data, headers) {
        assert.equal(source.fails['0/0/0'], undefined, 'failed x0');
        assert.ifError(err, 'no error');
        assert.equal(data instanceof Buffer, true, 'passes buffer');
        assert.deepEqual(headers, {}, 'passes headers');
        assert.end();
    });
});

test('retryBackoff (reset)', function(assert) {
    util.retryBackoff = 1000;
    assert.end();
});

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
    t.equal(util.serialize(tile), expected, 'bad coords written as null');

    tile = new util.Tile(1, '2', 3, 'hello');
    expected = '{"z":1,"x":2,"y":3,"buffer":null}';
    t.equal(util.serialize(tile), expected, 'bad buffer written as null');

    tile = new util.Tile(1, '2', 3, new Buffer('hello'));
    expected = '{"z":1,"x":2,"y":3,"buffer":"aGVsbG8="}';
    t.equal(util.serialize(tile), expected, 'serialize tile as expected');

    tile = new util.Tile();
    expected = '{"z":null,"x":null,"y":null,"buffer":null}';
    t.equal(util.serialize(tile), expected, 'serialize blank tile as expected');

    tile = new util.Tile('just', 'a', 'bunch', 'of', 1, 'garbage');
    expected = '{"z":null,"x":null,"y":null,"buffer":null}';
    t.equal(util.serialize(tile), expected, 'serialize garbage tile as expected');

    t.end();
});

test('Tile: deserialize', function(t) {
    t.plan(5);

    var data, tile, actual, expected;

    tile = new util.Tile();
    data = '{"z":1,"x":2,"y":3,"buffer":"aGVsbG8="}';
    expected = new util.Tile(1, 2, 3, new Buffer('hello'));
    actual = util.deserialize(data);
    t.deepEqual(actual, expected, 'good data deserialized as expected');

    t.equal(util.deserialize(data, 'buffer'), '"aGVsbG8="', 'deserialize a property as expected');
    t.equal(util.deserialize(data, 'x'), '2', 'deserialize a property as expected');

    tile = new util.Tile();
    data = '{"this": is not parsable, []}';
    try { util.deserialize(data); }
    catch(err) {
        var valid = err instanceof util.DeserializationError;
        t.ok(valid, 'un-parsable data throws expected exception');
    }

    tile = new util.Tile();
    data = '{"z":1,"x":2,"y":3,"buffer":null}';
    try { util.deserialize(data); }
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
    t.equal(util.serialize(inf), '{"hello":"world"}', 'serializes object as expected');

    inf = new util.Info();
    t.equal(util.serialize(inf), '{}', 'serializes blank as expected');
    t.end();
});

test('Info: deserialize', function(t) {
    t.plan(2);

    var inf = new util.Info();
    var data = '{"hello":"world"}';
    var expected = { hello: "world" };
    var actual = util.deserialize(data);
    t.deepEqual(actual, expected, 'deserializes valid object');

    inf = new util.Info();
    data = '{"this": is not parsable, []}';
    try { util.deserialize(data); }
    catch(err) {
        var valid = err instanceof util.DeserializationError;
        t.ok(valid, 'unparsable data throws expected exception');
    }
});

test('serialize/deserialize corner cases', function(t) {
    t.deepEqual(util.deserialize(''), null, 'deserialize interprets empty strings as null');
    t.throws(function() {
        util.serialize('boogie woogie');
    }, /SerializationError: Invalid data/, 'serialize throws on invalid data');
    t.throws(function() {
        util.serialize('');
    }, /SerializationError: Invalid data/, 'serialize throws on invalid data');
    t.end();
});

test('Limit bounds', function(t) {

    // these inputs should simply be equal to themselves, since they don't contain
    // anything out of bounds
    var valid = {
        'null island': [0, 0, 0, 0],
        'full bounds': [-180, -90, 180, 90],
        'small box': [-10, -10, 10, 10]
    };
    for (var name in valid) {
        t.deepEqual(util.limitBounds(valid[name]), valid[name], 'valid: ' + name);
    }

    // map of name: [input, output]
    var out = {
        'huge': [[-Infinity, -Infinity, Infinity, Infinity], [-180, -90, 180, 90]],
        'one dimension': [[-200, -90, 180, 90], [-180, -90, 180, 90]],
        'two dimensions': [[-200, -100, 180, 90], [-180, -90, 180, 90]],
        'others valid': [[-200, 0, 180, 10], [-180, 0, 180, 10]]
    };
    for (name in out) {
        t.deepEqual(util.limitBounds(out[name][0]), out[name][1], 'out of bounds: ' + name);
    }

    t.end();

});
