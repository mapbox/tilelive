var path = require('path'),
    sys = require('sys'),
    Step = require('Step'),
    MBTiles = require('../lib/tilelive/mbtiles'),
    Map = require('../lib/tilelive/map'),
    TileBatch = require('../lib/tilelive/batch'),
    assert = require('assert'),
    fs = require('fs');

var TEST_MAPFILE = 'http://tilemill-testing.s3.amazonaws.com/tilelive_test/world.mml';
var TEST_MAPFILE_64 = (new Buffer('http://tilemill-testing.s3.amazonaws.com/tilelive_test/world.mml')).toString('base64');

    /*
exports['Database setup'] = function() {
    var mb = new MBTiles(__dirname + '/tmp/creation.mbtiles');

    mb.setup(function(err) {
        assert.isUndefined(err, 'MBTiles setup threw an error');
        fs.stat(__dirname + '/tmp/creation.mbtiles', function(err, stats) {
            assert.isNull(err, 'The file was not created');
        });
    });
    mb.db.close();

    beforeExit(function() {
        fs.unlinkSync(__dirname + '/tmp/creation.mbtiles');
    });
};
    */

    /*
exports['Feature insertion'] = function() {
    var mb = new MBTiles(__dirname + '/tmp/creation.mbtiles');
    mb.setup(function(err) {
        assert.isUndefined(err, 'MBTiles setup threw an error');
        fs.stat(__dirname + '/tmp/creation.mbtiles', function(err, stats) {
            assert.isNull(err, 'The file was not created');
        });
    });

    var map = new Map(TEST_MAPFILE_64, __dirname + '/tmp', true, {
        width: 256,
        height: 256
    });

    var key_name = 'ISO3';
    map.localize(function(err) {
        map.mapnik_map_acquire(function(err, map) {
            var features = map.features(0, 0, 100);
            features.forEach(function(feature) {
                var k = feature[key_name];
                var v = JSON.stringify(feature);
                console.log(v);
            });
        });
    });

    mb.db.close();

    beforeExit(function() {
        // fs.unlinkSync(__dirname + '/tmp/creation.mbtiles');
    });
};
    */

exports['Tile Batch'] = function(beforeExit) {
    var batch = new TileBatch({
        filepath: __dirname + '/tmp/batch.mbtiles',
        batchsize: 100,
        bbox: [-180.0,-85,180,85],
        format: 'png',
        minzoom: 0,
        maxzoom: 1,
        mapfile: TEST_MAPFILE_64,
        mapfile_dir: __dirname + '/data/',
        interactivity: {
            key_name: 'ISO3',
            layer: 0
        },
        metadata: {
            name: 'Test batch',
            type: 'overlay',
            description: 'test',
            version: '1.1'
        }
    });

    var steps = {
        setup: false,
        render: false,
        grid: false,
        finish: false
    };

    Step(
        function() {
            batch.setup(function(err) {
                assert.isUndefined(err, 'Batch could be setup');
                steps.setup = true;
                this();
            }.bind(this));
        },
        function() {
            batch.renderChunk(function(err, tiles) {
                assert.isNull(err, 'The batch was not rendered.');
                steps.render = true;
                this();
            }.bind(this));
        },
        function() {
            batch.fillGridData(function(err, tiles) {
                assert.isNull(err, 'The batch was not rendered.');
                steps.grid = true;
                this();
            }.bind(this));
        },
        function() {
            batch.finish();
        },
        function() {
            steps.finish = true;
            fs.unlinkSync(__dirname + '/tmp/batch.mbtiles');
        }
    );

    beforeExit(function() {
        assert.ok(steps.setup, 'setup did not complete');
        assert.ok(steps.render, 'renderChunk did not complete');
        assert.ok(steps.grid, 'fillGridData did not complete');
        assert.ok(steps.finish, 'finish did not complete');
    });
};
