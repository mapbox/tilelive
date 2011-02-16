var path = require('path'),
    sys = require('sys'),
    Step = require('step'),
    Tile = require('../lib/tilelive/tile'),
    MBTiles = require('../lib/tilelive/mbtiles'),
    Map = require('../lib/tilelive/map'),
    TileBatch = require('../lib/tilelive/batch'),
    s64 = require('../lib/tilelive/safe64'),
    assert = require('assert'),
    fs = require('fs');

var TEST_MAPFILE = 'http://tilemill-testing.s3.amazonaws.com/tilelive_test/world.mml';

exports['cartourl'] = function() {
    var t = new Tile({
        xyz: [0, 0, 0],
        mapfile_dir: process.cwd() + '/test/tmp',
        datasource: TEST_MAPFILE
    });
    t.render(function(err, data) {
        assert.isNull(err, 'The rendering should not return an error.');
        assert.ok(data, 'The rendering returned data.');
        fs.writeFileSync('cartourl.png', data[0]);
    });
};

exports['cartolocal'] = function() {
    var t = new Tile({
        xyz: [0, 0, 0],
        mapfile_dir: process.cwd() + '/test/tmp',
        datasource: process.cwd() + '/test/data/world.mml'
    });
    t.render(function(err, data) {
        assert.isNull(err, 'The rendering should not return an error.');
        assert.ok(data, 'The rendering returned data.');
        fs.writeFileSync('cartolocal.png', data[0]);
    });
};

exports['xmllocal'] = function() {
    var t = new Tile({
        xyz: [0, 0, 0],
        language: 'xml',
        datasource: process.cwd() + '/test/data/stylesheet.xml'
    });
    t.render(function(err, data) {
        assert.isNull(err, 'The rendering should not return an error.');
        assert.ok(data, 'The rendering returned data.');
        fs.writeFileSync('xmllocal.png', data[0]);
    });
};
