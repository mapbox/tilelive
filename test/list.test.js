var assert = require('assert');

var tilelive = require('..');
tilelive.protocols['mbtiles:'] = require('mbtiles');
tilelive.protocols['tilejson:'] = require('tilejson');

exports['test listing'] = function(beforeExit) {
    var completed = false;

    tilelive.list('test/fixtures', function(err, sources) {
        completed = true;
        if (err) throw err;
        assert.deepEqual({
            'faulty': 'mbtiles://' + __dirname + '/fixtures/faulty.mbtiles',
            'plain_1': 'mbtiles://' + __dirname + '/fixtures/plain_1.mbtiles',
            'plain_2': 'mbtiles://' + __dirname + '/fixtures/plain_2.mbtiles',
            'plain_4': 'mbtiles://' + __dirname + '/fixtures/plain_4.mbtiles',
            'mapquest': 'tilejson://' + __dirname + '/fixtures/mapquest.tilejson'
        }, sources);
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};


exports['test findID'] = function(beforeExit) {
    var completed = {};

    tilelive.findID('test/fixtures', 'mapquest', function(err, uri) {
        completed.mapquest = true;
        if (err) throw err;
        assert.equal(uri, 'tilejson://' + __dirname + '/fixtures/mapquest.tilejson');
    });

    tilelive.findID('test/fixtures', 'faulty', function(err, uri) {
        completed.faulty = true;
        if (err) throw err;
        assert.equal(uri, 'mbtiles://' + __dirname + '/fixtures/faulty.mbtiles');
    });

    tilelive.findID('test/fixtures', 'foo', function(err, uri) {
        completed.foo = true;
        assert.ok(err);
        assert.equal(err.message, 'Tileset does not exist');
    });

    tilelive.findID('test/doesnotexist', 'foo', function(err, uri) {
        completed.doesnotexist = true;
        assert.ok(err);
        assert.equal(err.message, 'Tileset does not exist');
    });

    beforeExit(function() {
        assert.deepEqual({
            mapquest: true,
            faulty: true,
            foo: true,
            doesnotexist: true
        }, completed);
    });
};
