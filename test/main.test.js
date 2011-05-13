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
var TEST_MML = {
    "srs": "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over",
    "Stylesheet": [
        {
            "id": "style.mss",
            "data": "#world {line-color: #000;}"
        }
    ],
    "Layer": [
        {
            "id": "world",
            "name": "world",
            "srs": "+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over",
            "geometry": "polygon",
            "Datasource": {
                "file": "http://tilemill-data.s3.amazonaws.com/world_borders_merc.zip",
                "type": "shape"
            }
        }
    ]
};
var TEST_XML = '<?xml version="1.0" encoding="utf-8"?>' +
    '<!DOCTYPE Map[]>' +
    '<Map srs="+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over">' +
    '<Style name="world" filter-mode="first">' +
    '<Rule>' +
    '<LineSymbolizer stroke="#000000" />' +
    '</Rule>' +
    '</Style>' +
    '<Layer' +
    'name="world"' +
    'srs="+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +over">' +
    '<StyleName>world</StyleName>' +
    '<Datasource>' +
    '<Parameter name="file">/home/devseed/tilemill/modules/tilelive.js/test/tmp/39906004488430c066551090d81caa77/world_borders_merc.shp</Parameter>' +
    '<Parameter name="type">shape</Parameter>' +
    '</Datasource>' +
    '</Layer>' +
    '</Map>';

exports['cartourl'] = function() {
    var t = new Tile({
        xyz: [0, 0, 0],
        mapfile_dir: process.cwd() + '/test/tmp',
        datasource: TEST_MAPFILE
    });
    t.render(function(err, data) {
        throw err;
        assert.isNull(err, 'The rendering should not return an error.');
        assert.ok(data, 'The rendering returned data.');
        fs.writeFileSync(process.cwd() + '/test/tmp/cartourl.png', data[0]);
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
        fs.writeFileSync(process.cwd() + '/test/tmp/cartolocal.png', data[0]);
    });
};

exports['cartojson'] = function() {
    var t = new Tile({
        xyz: [0, 0, 0],
        mapfile_dir: process.cwd() + '/test/tmp',
        datasource: TEST_MML
    });
    t.render(function(err, data) {
        assert.isNull(err, 'The rendering should not return an error.');
        assert.ok(data, 'The rendering returned data.');
        fs.writeFileSync(process.cwd() + '/test/tmp/cartojson.png', data[0]);
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
        fs.writeFileSync(process.cwd() + '/test/tmp/xmllocal.png', data[0]);
    });
};

exports['xmlstring'] = function() {
    var t = new Tile({
        xyz: [0, 0, 0],
        language: 'xml',
        datasource: TEST_XML
    });
    t.render(function(err, data) {
        assert.isNull(err, 'The rendering should not return an error.');
        assert.ok(data, 'The rendering returned data.');
        fs.writeFileSync(process.cwd() + '/test/tmp/xmlstring.png', data[0]);
    });
};

/*
- XML url needed to test XML get/render

exports['xmlurl'] = function() {
    var t = new Tile({
        xyz: [0, 0, 0],
        language: 'xml',
        datasource: // @TODO need XML URL
    });
    t.render(function(err, data) {
        assert.isNull(err, 'The rendering should not return an error.');
        assert.ok(data, 'The rendering returned data.');
        fs.writeFileSync(process.cwd() + '/test/tmp/xmlurl.png', data[0]);
    });
};
*/

