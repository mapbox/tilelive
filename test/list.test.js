var test = require('tape');
var assert = require('assert');
var tilelive = require('../');
tilelive.protocols['mbtiles:'] = require('mbtiles');
tilelive.protocols['tilejson:'] = require('tilejson');

test('should list all available tile sources', function(t) {
    tilelive.list(__dirname + '/fixtures', function(err, sources) {
        t.ifError(err);
        t.deepEqual({
            'faulty': 'mbtiles://' + __dirname + '/fixtures/faulty.mbtiles',
            'plain_1': 'mbtiles://' + __dirname + '/fixtures/plain_1.mbtiles',
            'plain_2': 'mbtiles://' + __dirname + '/fixtures/plain_2.mbtiles',
            'plain_4': 'mbtiles://' + __dirname + '/fixtures/plain_4.mbtiles',
            'resume': 'mbtiles://' + __dirname + '/fixtures/resume.mbtiles',
            'mapquest': 'tilejson://' + __dirname + '/fixtures/mapquest.tilejson'
        }, sources);
        t.end();
    });
});

test('should find a tilejson source by ID', function(t) {
    tilelive.findID(__dirname + '/fixtures', 'mapquest', function(err, uri) {
        t.ifError(err);
        t.equal(uri, 'tilejson://' + __dirname + '/fixtures/mapquest.tilejson');
        t.end();
    });
});

test('should find a a faulty mbtiles source by ID', function(t) {
    tilelive.findID(__dirname + '/fixtures', 'faulty', function(err, uri) {
        t.ifError(err);
        t.equal(uri, 'mbtiles://' + __dirname + '/fixtures/faulty.mbtiles');
        t.end();
    });
});

test('should not find a non-existing tile source', function(t) {
    tilelive.findID(__dirname + '/fixtures', 'foo', function(err, uri) {
        t.ok(err);
        t.equal(err.message, 'Tileset does not exist');
        t.end();
    });
});
