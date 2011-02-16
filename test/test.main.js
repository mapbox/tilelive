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

/*
exports['Tile Batch'] = function(beforeExit) {
    try {
        fs.mkdirSync(__dirname + '/tmp', 0777);
    } catch(err) {}

    try {
        fs.unlinkSync(__dirname + '/tmp/batch.mbtiles');
    } catch(err) {}

    var batch = new TileBatch({
        filepath: __dirname + '/tmp/batch.mbtiles',
        batchsize: 100,
        bbox: [-180.0,-85,180,85],
        format: 'png',
        minzoom: 0,
        maxzoom: 2,
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
            version: '1.1',
            formatter: 'function(options, data) { '
                + 'return "<strong>" + data.NAME + "</strong><br/>'
                + '<small>Population: " + data.POP2005 + "</small>";'
                + '}'
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
                if (err) throw err;
                steps.setup = true;
                this();
            }.bind(this));
        },
        function(err) {
            if (err) throw err;
            var next = this;
            var end = function(err, tiles) {
                if (err) throw err;
                steps.render = true;
                next();
            };
            var render = function() {
                process.nextTick(function() {
                    batch.renderChunk(function(err, tiles) {
                        if (!tiles) return end(err, tiles);
                        render();
                    });
                });
            };
            render();
        },
        function(err) {
            if (err) throw err;
            batch.fillGridData(function(err, tiles) {
                if (err) throw err;
                steps.grid = true;
                this();
            }.bind(this));
        },
        function(err) {
            if (err) throw err;
            batch.finish(this);
        },
        function(err) {
            if (err) throw err;
            steps.finish = true;
        }
    );

    beforeExit(function() {
        assert.ok(steps.setup, 'setup did not complete');
        assert.ok(steps.render, 'renderChunk did not complete');
        assert.ok(steps.grid, 'fillGridData did not complete');
        assert.ok(steps.finish, 'finish did not complete');
    });
};
    */
