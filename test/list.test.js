var assert = require('assert');
var tilelive = require('..');
tilelive.protocols['mbtiles:'] = require('mbtiles');
tilelive.protocols['tilejson:'] = require('tilejson');

describe('listing', function() {
    it('should list all available tile sources', function(done) {
        tilelive.list('test/fixtures', function(err, sources) {
            if (!err) assert.deepEqual({
                'faulty': 'mbtiles://' + __dirname + '/fixtures/faulty.mbtiles',
                'plain_1': 'mbtiles://' + __dirname + '/fixtures/plain_1.mbtiles',
                'plain_2': 'mbtiles://' + __dirname + '/fixtures/plain_2.mbtiles',
                'plain_4': 'mbtiles://' + __dirname + '/fixtures/plain_4.mbtiles',
                'resume': 'mbtiles://' + __dirname + '/fixtures/resume.mbtiles',
                'mapquest': 'tilejson://' + __dirname + '/fixtures/mapquest.tilejson'
            }, sources);
            done(err);
        });
    });

    it('should find a tilejson source by ID', function(done) {
        tilelive.findID('test/fixtures', 'mapquest', function(err, uri) {
            if (!err) assert.equal(uri, 'tilejson://' + __dirname + '/fixtures/mapquest.tilejson');
            done(err);
        });
    });

    it('should find a a faulty mbtiles source by ID', function(done) {
        tilelive.findID('test/fixtures', 'faulty', function(err, uri) {
            if (!err) assert.equal(uri, 'mbtiles://' + __dirname + '/fixtures/faulty.mbtiles');
            done(err);
        });
    });

    it('should not find a non-existing tile source', function(done) {
        tilelive.findID('test/fixtures', 'foo', function(err, uri) {
            assert.ok(err);
            assert.equal(err.message, 'Tileset does not exist');
            done(null);
        });
    });
});
