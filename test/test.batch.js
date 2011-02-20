var path = require('path'),
    sys = require('sys'),
    Step = require('step'),
    Tile = require('../lib/tilelive/tile'),
    MBTiles = require('../lib/tilelive/mbtiles'),
    Map = require('../lib/tilelive/map'),
    TileBatch = require('../lib/tilelive/batch'),
    assert = require('assert'),
    fs = require('fs');

var TEST_MAPFILE = 'http://tilemill-testing.s3.amazonaws.com/tilelive_test/world.mml';

exports['Database setup'] = function() {
    var mb = new MBTiles(__dirname + '/tmp/creation.mbtiles');
    Step(
        function() {
            mb.open(this);
        },
        function() {
            var next = this;
            mb.setup(function(err) {
                assert.isUndefined(err, 'MBTiles setup threw an error');
                fs.stat(__dirname + '/tmp/creation.mbtiles', function(err, stats) {
                    assert.isNull(err, 'The file was not created');
                });
                next();
            });

        },
        function() {
            mb.db.close(this);
        },
        function() {
            fs.unlinkSync(__dirname + '/tmp/creation.mbtiles');
        }
    );
};

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
        bbox: [
            -20037500,
            -20037500,
            20037500,
            20037500
        ],
        format: 'png',
        minzoom: 0,
        maxzoom: 2,
        datasource: TEST_MAPFILE,
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

    var times = {
        setup: 0,
        render: 0,
        grid: 0,
        finish: 0
    };
    var steps = {
        setup: false,
        render: false,
        grid: false,
        finish: false
    };

    Step(
        function() {
            times.setup = +new Date();
            batch.setup(function(err) {
                if (err) throw err;
                steps.setup = true;
                times.setup = +new Date() - times.setup;
                this();
            }.bind(this));
        },
        function(err) {
            if (err) throw err;
            times.render = +new Date();
            var next = this;
            var end = function(err, tiles) {
                if (err) throw err;
                steps.render = true;
                times.render = +new Date() - times.render;
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
            if (!batch.options.interactivity) return this();
            times.grid = +new Date();
            batch.fillGridData(function(err, tiles) {
                if (err) throw err;
                times.grid = +new Date() - times.grid;
                steps.grid = true;
                this();
            }.bind(this));
        },
        function(err) {
            if (err) throw err;
            times.finish = +new Date();
            batch.finish(this);
        },
        function(err) {
            if (err) throw err;
            times.finish = +new Date() - times.finish;
            steps.finish = true;
        }
    );

    beforeExit(function() {
        console.log('setup:        %ss', times.setup * .001);
        console.log('renderChunk:  %ss', times.render * .001);
        console.log('fillGridData: %ss', times.grid * .001);
        console.log('finish:       %ss', times.finish * .001);

        assert.ok(steps.setup, 'setup did not complete');
        assert.ok(steps.render, 'renderChunk did not complete');
        batch.options.interactivity && assert.ok(steps.grid, 'fillGridData did not complete');
        assert.ok(steps.finish, 'finish did not complete');
    });
};
