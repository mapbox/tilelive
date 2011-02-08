var path = require('path'),
    sys = require('sys'),
    MBTiles = require('../lib/tilelive/mbtiles'),
    assert = require('assert'),
    fs = require('fs');


exports['Database setup'] = function(beforeExit) {
    var completed = true;

    var mbtiles = new MBTiles(__dirname + '/data/creation.mbtiles');

    mbtiles.setup(function(err) {
        assert.isUndefined(err, 'MBTiles setup threw an error');
        fs.stat(__dirname + '/data/creation.mbtiles', function(err, stats) {
            assert.isNull(err, 'The file was not created');
        });
    });

    beforeExit(function() {
        fs.unlinkSync(__dirname + '/data/creation.mbtiles');
        assert.ok(completed, true);
    });
};
