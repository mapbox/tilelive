var path = require('path'),
    sys = require('sys'),
    MBTiles = require('../lib/tilelive/mbtiles'),
    TileBatch = require('../lib/tilelive/batch'),
    assert = require('assert'),
    fs = require('fs');


exports['Database setup'] = function(beforeExit) {
    var mbtiles = new MBTiles(__dirname + '/tmp/creation.mbtiles');

    mbtiles.setup(function(err) {
        assert.isUndefined(err, 'MBTiles setup threw an error');
        fs.stat(__dirname + '/tmp/creation.mbtiles', function(err, stats) {
            assert.isNull(err, 'The file was not created');
        });
    });

    beforeExit(function() {
        fs.unlinkSync(__dirname + '/tmp/creation.mbtiles');
    });
};

exports['Tile Batch'] = function(beforeExit) {
    var batch = new TileBatch({
        filepath: __dirname + '/tmp/batch.mbtiles',
        batchsize: 100,
        bbox: [-180.0,-85,180,85],
        format: 'png',
        minzoom: 0,
        maxzoom: 4,
        mapfile: __dirname + '/data/test.xml',
        mapfile_dir: __dirname + '/data/',
        metadata: {
            name: 'Test batch',
            type: 'overlay',
            description: 'test',
            version: '1.1'
        }
    });

    batch.setup(function(err) {
        assert.isUndefined(err, 'Batch could be setup');
    });

    beforeExit(function() {
        fs.stat(__dirname + '/tmp/batch.mbtiles', function(err, stats) {
            assert.isNull(err, 'The batch was not created.');
        });
        fs.unlinkSync(__dirname + '/tmp/batch.mbtiles');
    });
};
