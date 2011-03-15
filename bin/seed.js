#!/usr/bin/env node

var sys = require('sys'),
    Step = require('step'),
    TileBatch = require('tilelive').TileBatch;

// To test run from tilelive.js master checkout:
// ./seed.js test/data/stylesheet.xml 0 FIPS world.mbtiles

var args = process.argv.slice(1);

if (!args[1]) {
    sys.puts("seed.js: please provide an input .xml path");
    process.exit(1);
}

var stylesheet = args[1];

if (!args[2]) {
    sys.puts("seed.js: please provide a layer index for interactivity");
    process.exit(1);
}

var layer_idx = parseInt(args[2]);

if (!args[3]) {
    sys.puts("seed.js: please provide a field name for interactivity");
    process.exit(1);
}

var join_field = args[3];

if (!args[4]) {
    sys.puts("seed.js: please provide an output mbtiles name");
    process.exit(1);
}

var mbtile_file = args[4];

var batch = new TileBatch({
    filepath: mbtile_file,
    batchsize: 100,
    bbox: [
        -20037500,
        -20037500,
        20037500,
        20037500
    ],
    format: 'png',
    minzoom: 12,
    maxzoom: 14,
    datasource: stylesheet,
    language: 'xml',
    interactivity: {
        key_name: join_field,
        layer: layer_idx
    },
    metadata: {
        name: mbtile_file,
        type: 'baselayer',
        description: mbtile_file,
        version: '1.1',
        formatter: 'function(options, data) { '
            + 'return "<strong>" + data.'+ join_field + ' + "</strong><br/>"'
            + '}'
    }
});


Step(
    function() {
        console.log('setup');
        batch.setup(function(err) {
            if (err) throw err;
            this();
        }.bind(this));
    },
    function(err) {
        console.log('fillGridData');
        if (err) throw err;
        if (!batch.options.interactivity) return this();
        batch.fillGridData(function(err, tiles) {
            if (err) throw err;            
            this();
        }.bind(this));
    },
    function(err) {
        console.log('renderChunk');
        if (err) throw err;
        var next = this;
        var end = function(err, tiles) {
            if (err) throw err;
            next(err);
        };
        var render = function() {
            process.nextTick(function() {
                batch.renderChunk(function(err, tiles) {
                    if (err) {
                        console.log('err: ' + err + ' ' + tiles);
                        throw err;
                    }
                    if (!tiles) {
                        console.log('finished ' + err + ' ' + tiles);
                        return end(err, tiles);
                    }
                    render();
                });
            });
        };
        render();
    },
    function(err) {
        console.log('finish');
        if (err) throw err;
        batch.finish(this);
    },
    function(err) {
        console.log('done');
        if (err) throw err;
    }
);