# tilelive.js

tilelive.js is a tile server for [node.js](http://nodejs.org/) which supports on-the-fly
configuration and advanced interaction output. It's powered by [Mapnik](http://mapnik.org/) and
can be used to add a tile server to an existing web application or wrapped with
a light standalone web tile server.

## Examples

Tilelive includes a `tilelive_server.js` binary which can be used to serve a tileset from a `.mml` file (with [carto](https://github.com/mapbox/carto) or Mapnik XML).

This server requires Express 0.1.x (see below for installation instructions).

Usage:

    tilelive_server.js world.mml

    tilelive_server.js stylesheet.xml

Examples are given in `examples/`.

## Requirements

- [node-mapnik](https://github.com/mapnik/node-mapnik)
- [carto](https://github.com/mapbox/carto)
- [node-get](https://github.com/tmcw/node-get)
- [node-sqlite3](https://github.com/developmentseed/node-sqlite3)
- [underscore](https://github.com/documentcloud/underscore)
- [node-pool](https://github.com/coopernurse/node-pool) (aka generic-pool)
- [step](https://github.com/creationix/step)
- [node-compress](https://github.com/kkaefer/node-compress/tarball/master)

Note: if you are looking for simple server examples see the [node-mapnik examples](https://github.com/mapnik/node-mapnik/tree/master/examples).


## Install

Install master:

    git clone git://github.com/mapbox/tilelive.js.git
    cd tilelive.js
    npm install .

Or install latest release via npm repositories:

    npm install tilelive

If you want to use the example server 'tilelive_server.js' then also install express:

    npm install express@1.0.7

## Install troubleshooting

Buggy versions of npm (or the apps package.json file) may cause installation to fail for some dependencies.

For example you may need to install node-compress manually like:

    git clone git://github.com/kkaefer/node-compress.git
    cd node-compress
    npm install .

## Tests

To run the tests you first need to install expresso:

    npm install expresso

Then from within this directory do:

    expresso


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
