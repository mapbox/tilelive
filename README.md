# tilelive.js

tilelive.js is a tile server for [node.js](http://nodejs.org/) which supports on-the-fly
configuration and advanced interaction output. It's powered by [Mapnik](http://mapnik.org/) and
can be used to add a tile server to an existing web application or wrapped with
a light standalone web tile server.

## Examples

Tilelive includes a `tilelive_server.js` binary which can be used to serve a tileset from a `.mml` file (with [carto](https://github.com/mapbox/carto) or Mapnik XML).

Usage:

    tilelive_server.js world.mml

    tilelive_server.js stylesheet.xml

Examples are given in `examples/`.

## Requirements

- [node-mapnik](https://github.com/mapnik/node-mapnik)
- [underscore](https://github.com/documentcloud/underscore)
- [carto](https://github.com/mapbox/carto)
- [node-pool](https://github.com/coopernurse/node-pool)
- [node-get](https://github.com/tmcw/node-get)

## Usage

    var express = require('express'),
        Tile = require('tilelive').Tile,
        app = express.createServer();

    app.get('/:scheme/:mapfile_64/:z/:x/:y.*', function(req, res) {
        /*
         * scheme: (xyz|tms|tile (tms))
         *
         * format:
         * - Tile: (png|jpg)
         * - Data Tile: (geojson)
         * - Grid Tile: (*.grid.json)
         */
        try {
            var tile = new Tile({
                scheme: req.params.scheme,
                mapfile: req.params.mapfile_64,
                xyz: [
                    req.params.x,
                    req.params.z,
                    req.params.y],
                format: req.params[0],
                mapfile_dir: '/tmp/mapfiles'
            });
        } catch (err) {
            res.send('Tile invalid: ' + err.message);
        }

        tile.render(function(err, data) {
            if (!err) {
                res.send.apply(res, data);
            } else {
                res.send('Tile rendering error: ' + err);
            }
        });
    });

# Changelog

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
