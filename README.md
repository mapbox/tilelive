# tilelive.js

tilelive.js is a tile server for [node.js](http://nodejs.org/) which supports on-the-fly
configuration and advanced interaction output. It can be used to add a tile server to an existing web application or wrapped with a light standalone web tile server.

## Backends

tilelive.js supports backends for serving tiles and for storing them when creating [mbtiles](http://mbtiles.org) or other caches of tiles.

Each backend is expected to export an object in the following form:

    module.exports = {
        // Return an object usable with the `Pool()` constructor from
        // `generic-pool`. The resource will be pooled and passed back to
        // other backend methods for serving and storing.
        pool: function(datasource) {
            return {
                create: [Function],
                destroy: [Function]
            }
        },

        // For server backends.
        // Serve a tile, grid, or other resource. The `callback` function
        // should be called with `callback(err, data)` where `data` is an array
        // such that `data[0]` is suitable as a response body and `data[1]`
        // contains a hash of HTTP headers that describe the data.
        serve: function(resource, options, callback) {},

        // For storage backends.
        // Store tiles, grids, or perform other tasks related to batch tile
        // generation. Steps called include: setup, metadata, tiles, grids,
        // and finish.
        setup: function(step, resource, data, callback) {}
    }

To use tilelive to serve tiles from mbtiles install [tilelive-mbtiles](http://github.com/mapbox/tilelive-mbtiles). To serve dynamically rendered tiles using mapnik install [tilelive-mapnik](http://github.com/mapbox/tilelive-mapnik). To render tiles using mapnik and store them in the mbtiles format, install both.

## Install

Install master:

    git clone git://github.com/mapbox/tilelive.js.git tilelive
    cd tilelive
    npm install .

Or install latest release via npm repositories:

    npm install tilelive

## Tests

To run the tests

    npm test

## Usage

See [geode](https://github.com/mapbox/geode) for a working example of a tilelive powered server.

    var express = require('express'),
        Server = require('tilelive').Server,
        tilelive = new Server(require('tilelive-mapnik')),
        app = express.createServer();

    app.get('/:scheme/:mapfile_64/:z/:x/:y.*', function(req, res) {
        tilelive.serve({
            scheme: req.param('scheme'),
            datasource: req.param('mapfile_64'),
            x: req.param('x'),
            y: req.param('y'),
            z: req.param('z'),
            format: req.params[0]
        }, function(err, data) {
            if (!err) {
                res.send.apply(res, data);
            } else {
                res.send('Tile rendering error: ' + err);
            }
        });
    });

# Changelog

# 3.0.0

Split out `tilelive-mapnik`, `tilelive-mbtiles` backends.

# 2.0.3

This release is all distribution fixes:

* Uses devDependencies to support docs and testing
* Fixes test that depended on node-get
* Removes tilelive_server example: replaced by [geode](https://github.com/mapbox/geode).

# 2.0.2

* Now uses and requires node-mapnik 0.3.0

# 2.0.1

Minor release: adds `Pool` argument to `Tile.getMap()`, to let users dispose of used maps.

# 2.0.0

* `node-sqlite3` replaces `node-sqlite` for better performance and stability.
* deep render grid support - `layer.json` now supports legends and interaction.
* `server.js` removed from examples
* `tilelive_server.js` added to `bin/`

# 1.1.0

* Tiles no longer accept `tile` as a scheme. TMS or XYZ are required; TMS is default.
* options.mapfile is now options.datasource, and can accept a Carto MML object.

[^1]: http://nodejs.org/
[^2]: http://mapnik.org/
