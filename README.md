# tilelive.js

tilelive.js is an interface for tilestore modules for [node.js](http://nodejs.org/). It defines an [API](https://github.com/mapbox/tilelive.js/blob/master/API.md) to interact with implementations for a particular tile store.

## Backends

- [MBTiles](https://github.com/mapbox/node-mbtiles)
- [TileJSON](https://github.com/mapbox/node-tilejson)
- [Mapnik](https://github.com/mapbox/tilelive-mapnik)

## Usage

Tilelive doesn't ship with any Tilestore backends by default. To use a particular backend, register it with tilelive using `require('[implementation]').registerProtocols(tilelive);`.

* `tilelive.list(source, callback)`: Lists all tilesets in a directory. `source` is a folder that is used by registered implementations to search for individual tilesets. `callback` receives an error object (or `null`) and a hash hash with keys being Tilestore IDs and values being Tilestore URIs. Example:

```javascript
{
    "world-light": "mbtiles:///path/to/file/world-light.mbtiles",
    "mapquest": "tilejson:///path/to/file/mapquest.tilejson"
}
```

* `tilelive.findID(source, id, callback)`: Looks for a particular tileset ID in a directory. `callback` receives an error object (or `null`) and the URI of the tileset.


* `tilelive.load(uri, callback)`: Loads the Tilestore object associated with the specified `uri`. `callback` receives an error object (or `null`) and the Tilestore object.

* `tilelive.info(uri, callback)`: Loads the Tilestore object associated with the specified `uri` and retrieves its metadata in a [TileJSON](http://github.com/mapbox/tilejson) compliant format. `callback` receives an error object (or `null`), the metadata hash and the Tilestore object.

* `tilelive.all(source, callback)`: Loads metadata in a [TileJSON](http://github.com/mapbox/tilejson) compliant format for all tilesets in the `source` directory. `callback` receives an error object (or `null`) and an array with TileJSON metadata about each tileset in that directory.


* `tilelive.verify(tilejson)`: Validates a TileJSON object and returns error objects for invalid entries.

* `tilelive.copy(args, callback)`: Copies data from one tilestore into another tilestore. `args` is a configuration hash with these keys:

  * `source`: a Tilestore object that implements the Tilesource interface
  * `sink`: a Tilestore object that implements the Tilesink interface
  * `bbox`: an array with W/S/E/N boundaries in WGS84 format (-180...180, -90...90)
  * `minZoom`: the minimum zoom for data to be copied (inclusive)
  * `maxZoom`: the maximum zoom for data to be copied (inclusive)
  * `concurrency`: (default: `100`) how many data objects should be copied simultaneously.
  * `callback`: (optional) called when copying is complete
  * `tiles`: copy tiles (`true` or `false`)
  * `grids`: copy grids (`true` or `false`)

  This function returns an EventEmitter that has these events emitted:

  * `warning`: An error occurred during copying. `err` is the first argument.
  * `error`: An error occured while initializing the tilesource/tilesink.
  * `finished`: Copying completed

  The EventEmitter also has these properties. They are updated continuously while copying. Check them occassionally to report status to the user.

  * `copied`: Number of elements that have been copied so far
  * `failed`: Number of elements that couldn't be copied.
  * `total`: Total number of elements to be copied.
  * `started`: Timestamp of when the action started in milliseconds after epoch

## bin/tilelive

tilelive can be used to copy data between tilestores. For a full list of options, run `bin/tilelive`.

## Tests

To run the tests

    npm test

## Usage

See `examples` or [geode](https://github.com/mapbox/geode) for examples of a tilelive powered server.

# Changelog

## 4.1.0

* Tilesources are not verify()'ed automatically during info(). Clients must now
  do this.

## 4.0.0

* Updated to use Tilestore/Tilesink/Tilesource interface
* Uses the TileJSON format internally
* Switched to Tilestore URIs
* Interfaces updated to XYZ. Order of parameters is now z, x, y
* Added copy command

## 3.0.0

Split out `tilelive-mapnik`, `mbtiles` backends.

## 2.0.3

This release is all distribution fixes:

* Uses devDependencies to support docs and testing
* Fixes test that depended on node-get
* Removes tilelive_server example: replaced by [geode](https://github.com/mapbox/geode).

## 2.0.2

* Now uses and requires node-mapnik 0.3.0

## 2.0.1

Minor release: adds `Pool` argument to `Tile.getMap()`, to let users dispose of used maps.

## 2.0.0

* `node-sqlite3` replaces `node-sqlite` for better performance and stability.
* deep render grid support - `layer.json` now supports legends and interaction.
* `server.js` removed from examples
* `tilelive_server.js` added to `bin/`

## 1.1.0

* Tiles no longer accept `tile` as a scheme. TMS or XYZ are required; TMS is default.
* options.mapfile is now options.datasource, and can accept a Carto MML object.

