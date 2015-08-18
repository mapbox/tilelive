# tilelive.js

[![Coverage Status](https://coveralls.io/repos/mapbox/tilelive.js/badge.svg)](https://coveralls.io/r/mapbox/tilelive.js)

- Tilelive is a module to help interactions between tilelive source modules.
- A tilelive source is an interface implemented by node modules that deal with reading and writing map tiles.

[![Build Status](https://secure.travis-ci.org/mapbox/tilelive.js.svg)](http://travis-ci.org/mapbox/tilelive.js)

## Implementing modules

- [node-mbtiles](https://github.com/mapbox/node-mbtiles)
- [node-tilejson](https://github.com/mapbox/node-tilejson)
- [tilelive-mapnik](https://github.com/mapbox/tilelive-mapnik)
- [tilelive-vector](https://github.com/mapbox/tilelive-vector)
- [tilelive-bridge](https://github.com/mapbox/tilelive-bridge)

## Usage

Tilelive doesn't ship with any implementing modules by default. To register a module as one tilelive recognizes:

    require('[implementation]').registerProtocols(tilelive);

* `tilelive.list(source, callback)`: Lists all tilesets in a directory. `source` is a folder that is used by registered implementations to search for individual tilesets. `callback` receives an error object (or `null`) and a hash hash with keys being Tilestore IDs and values being Tilestore URIs. Example:

```javascript
{
    "world-light": "mbtiles:///path/to/file/world-light.mbtiles",
    "mapquest": "tilejson:///path/to/file/mapquest.tilejson"
}
```

* `tilelive.findID(source, id, callback)`: Looks for a particular tileset ID in a directory. `callback` receives an error object (or `null`) and the URI of the tileset.


* `tilelive.load(uri, callback)`: Loads the Tilestore object associated with the specified `uri`. `callback` receives an error object (or `null`) and the [Tilestore object](API.md).

* `tilelive.info(uri, callback)`: Loads the Tilestore object associated with the specified `uri` and retrieves its metadata in a [TileJSON](http://github.com/mapbox/tilejson-spec) compliant format. `callback` receives an error object (or `null`), the metadata hash and the Tilestore object.

* `tilelive.all(source, callback)`: Loads metadata in a [TileJSON](http://github.com/mapbox/tilejson-spec) compliant format for all tilesets in the `source` directory. `callback` receives an error object (or `null`) and an array with TileJSON metadata about each tileset in that directory.

* `tilelive.verify(tilejson)`: Validates a TileJSON object and returns error objects for invalid entries.

## Read/write streams

Tilelive provides an implementation of node object streams for copying tiles from one source to another.

    // Copy all tiles and metadata from source A to source B.
    var get = tilelive.createReadStream(sourceA);
    var put = tilelive.createWriteStream(sourceB);
    get.pipe(put);
    put.on('finish', function() {
        console.log('done!');
    });

See `tilelive-copy` and the streams tests for example usage of copy streams.

## Parallel read streams

Tilelive can split a read operation into an arbitrary number of jobs. Pass a `job` parameter to options when using `tilelive.createReadStream` or `tilelive.deserialize`:

```javascript
var readable = tilelive.createReadStream(src, { type: 'scanline', job: { total: 4, num: 1 } });
```

This instructs tilelive to only read tiles that would fall into job `1` of `4`. A complete read would mean four calls each with a different `num`.

## bin/tilelive-copy

tilelive can be used to copy data between tilestores. For a full list of options, run `tilelive-copy`.

## Tests

To run the tests

    npm test
