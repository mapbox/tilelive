#!/usr/bin/env node

var sys = require('sys'),
    Step = require('step'),
    fs = require('fs'),
    TileBatch = require('../lib/tilelive').TileBatch;

var args = process.argv.slice(1);

if (args.length < 5) {
    sys.puts("usage:\nbatchseed.js MML MBTILES NAME TYPE DESCRIPTION");
    process.exit(1);
}

var mml = JSON.parse(fs.readFileSync(args[1])),
    mbtiles = args[2],
    name = args[3],
    type = args[4],
    description = args[5];

function makeFormatter(interactivity) {
    var full =     interactivity.template_full || '';
    var teaser =   interactivity.template_teaser || '';
    var location = interactivity.template_location || '';
    full = full.replace(/\'/g, '\\\'').replace(/\[([\w\d]+)\]/g, "' + data.$1 + '").replace(/\n/g, ' ');
    teaser = teaser.replace(/\'/g, '\\\'').replace(/\[([\w\d]+)\]/g, "' + data.$1 + '").replace(/\n/g, ' ');
    location = location.replace(/\'/g, '\\\'').replace(/\[([\w\d]+)\]/g, "' + data.$1 + '").replace(/\n/g, ' ');
    return "function(options, data) { "
        + "  switch (options.format) {"
        + "    case 'full': "
        + "      return '" + full + "'; "
        + "      break; "
        + "    case 'location': "
        + "      return '" + location + "'; "
        + "      break; "
        + "    case 'teaser': "
        + "    default: "
        + "      return '" + teaser + "'; "
        + "      break; "
        + "  }"
        + "}";
}

var batch = new TileBatch({
    filepath: mbtiles,
    batchsize: 100,
    bbox: [
        -20037500,
        -20037500,
        20037500,
        20037500
    ],
    format: 'png',
    minzoom: 0,
    maxzoom: 7,
    datasource: mml,
    language: 'carto',
    interactivity: mml._interactivity,
    metadata: {
        name: name,
        type: type,
        description: description,
        version: '1.0',
        formatter: makeFormatter(mml._interactivity)
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
