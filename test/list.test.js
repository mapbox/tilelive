var test = require('tape');
var assert = require('assert');
var tilelive = require('../');
var MBTiles = require('@mapbox/mbtiles');
var TileJSON = require('@mapbox/tilejson');

MBTiles.registerProtocols(tilelive);
TileJSON.registerProtocols(tilelive);

function replaceSlashes(p) {
    if (process.platform === 'win32') {
        return p.replace(/\//g,'\\');
    } else {
        return p;
    }
}

test('should list all available tile sources', function(t) {
    tilelive.list(__dirname + '/fixtures', function(err, sources) {
        t.ifError(err);
        t.deepEqual({
            'empty': 'mbtiles://' + __dirname + replaceSlashes('/fixtures/empty.mbtiles'),
            'faulty': 'mbtiles://' + __dirname + replaceSlashes('/fixtures/faulty.mbtiles'),
            'plain_1': 'mbtiles://' + __dirname + replaceSlashes('/fixtures/plain_1.mbtiles'),
            'plain_2': 'mbtiles://' + __dirname + replaceSlashes('/fixtures/plain_2.mbtiles'),
            'plain_4': 'mbtiles://' + __dirname + replaceSlashes('/fixtures/plain_4.mbtiles'),
            'resume': 'mbtiles://' + __dirname + replaceSlashes('/fixtures/resume.mbtiles'),
            'mapquest': 'tilejson://' + __dirname + replaceSlashes('/fixtures/mapquest.tilejson'),
            'null-tile': 'mbtiles://' + __dirname + replaceSlashes('/fixtures/null-tile.mbtiles')
        }, sources);
        t.end();
    });
});

test('should find a tilejson source by ID', function(t) {
    tilelive.findID(__dirname + '/fixtures', 'mapquest', function(err, uri) {
        t.ifError(err);
        t.equal(uri, 'tilejson://' + __dirname + replaceSlashes('/fixtures/mapquest.tilejson'));
        t.end();
    });
});

test('should find a a faulty mbtiles source by ID', function(t) {
    tilelive.findID(__dirname + '/fixtures', 'faulty', function(err, uri) {
        t.ifError(err);
        t.equal(uri, 'mbtiles://' + __dirname + replaceSlashes('/fixtures/faulty.mbtiles'));
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
