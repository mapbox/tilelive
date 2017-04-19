# tilelive.js

[![Build Status](https://travis-ci.org/mapbox/tilelive.svg?branch=master)](https://travis-ci.org/mapbox/tilelive)
[![Coverage Status](https://coveralls.io/repos/github/mapbox/tilelive/badge.svg?branch=master)](https://coveralls.io/github/mapbox/tilelive?branch=master)

- Tilelive is a module to help interactions between tilelive source modules.
- A tilelive source is an interface implemented by node modules that deal with reading and writing map tiles.


## Awesome tilelive modules

- [tilelive-vector](https://github.com/mapbox/tilelive-vector) - Implements the tilelive API for rendering mapnik vector tiles to raster images.
- [tilelive-bridge](https://github.com/mapbox/tilelive-bridge) - Implements the tilelive API for generating mapnik vector tiles from traditional mapnik datasources.
- [tilelive-mapnik](https://github.com/mapbox/tilelive-mapnik) - mapnik renderer backend for tilelive.
- [tilelive-s3](https://github.com/mapbox/tilelive-s3) - Extends TileJSON for S3-specific tasks.
- [tilelive-file](https://github.com/mapbox/tilelive-file) - tilelive.js adapter for reading from the filesystem.
- [tilelive-postgis](https://github.com/stepankuzmin/tilelive-postgis) - A tilelive source for outputting PBF-encoded tiles from PostGIS.
- [tilelive-tmsource](https://github.com/mojodna/tilelive-tmsource) - A tilelive provider for TM2 sources.
- [tilelive-cache](https://github.com/mojodna/tilelive-cache) - A caching wrapper for tilelive.js
- [tilelive-overlay](https://github.com/mapbox/tilelive-overlay) - Render GeoJSON features with simplestyle styles in a tilelive pipeline.
- [tilelive-tmstyle](https://github.com/mojodna/tilelive-tmstyle) - A tilelive provider for tmstyle sources.
- [tilelive-http](https://github.com/mojodna/tilelive-http) - An HTTP source for tilelive.
- [node-mbtiles](https://github.com/mapbox/node-mbtiles) - A mbtiles renderer and storage backend for tilelive.
- [tl](https://github.com/mojodna/tl) - An alternate command line interface to tilelive.
- [tilelive-omnivore](https://github.com/mapbox/tilelive-omnivore) - Implements the tilelive api for a variety of data sources.
- [tilelive-xray](https://github.com/mojodna/tilelive-xray) - Tilelive vector tile visualization.
- [tilelive-merge](https://github.com/mojodna/tilelive-merge) - A tilelive source that merges sources.
- [tilelive-streaming](https://github.com/mojodna/tilelive-streaming) - Streaming functionality for tilelive modules.
- [tilelive-redis](https://github.com/mapbox/tilelive-redis) - Redis wrapping source for tilelive.
- [tilelive-modules](https://github.com/mojodna/tilelive-modules) - A listing of known tilelive modules.
- [tilelive-decorator](https://github.com/mapbox/tilelive-decorator) - Load vector tiles from a tilelive source and decorate them with properties from redis.
- [tilelive-blend](https://github.com/mojodna/tilelive-blend) - A tilelive provider that blends.
- [tilelive-carto](https://github.com/mojodna/tilelive-carto) - A Carto style source for tilelive
- [mongotiles](https://github.com/vsivsi/mongotiles) - mongotiles is a tilelive backend plug-in for MongoDB GridFS.
- [tilelive-rasterpbf](https://github.com/mojodna/tilelive-rasterpbf) - A tilelive source for outputting PBF-encoded rasters from PostGIS.
- [tilelive-memcached](https://github.com/mapbox/tilelive-memcached) - A memcached wrapping source for tilelive.
- [tilelive-csvin](https://github.com/mojodna/tilelive-csvin) - A streaming tilelive source for CSV inputs.
- [tilelive-tms](https://github.com/oscarfonts/tilelive-tms) - A tilelive.js adapter for reading from a TMS service.
- [tilelive-multicache](https://github.com/mapbox/tilelive-multicache) - Module for adding a caching layer in front a tilelive source. 
- [tilelive-cardboard](https://github.com/mapbox/tilelive-cardboard) - Renders vector tiles from a cardboard dataset.
- [tilelive-utfgrid](https://github.com/mojodna/tilelive-utfgrid) - A tilelive provider that treats grids as tiles
- [tilelive-arcgis](https://github.com/FuZhenn/tilelive-arcgis) - A tilelive.js adapter for ArcGIS tile caches.
- [tilelive-mapbox](https://github.com/mojodna/tilelive-mapbox) - A tilelive.js source for mapbox:// URIs.
- [tilelive-solid](https://github.com/mojodna/tilelive-solid) - A tilelive provider that generates solid colored tiles.
- [tilelive-raster](https://github.com/mojodna/tilelive-raster) - A tilelive source for simple rasters, both local and remote.
- [tilelive-null](https://github.com/mojodna/tilelive-null) - A noop sink for tilelive.
- [tilelive-noop](https://github.com/mapbox/tilelive-noop) - A no-op tilelive source.
- [tilelive-csv](https://github.com/mojodna/tilelive-csv) - PBF → CSV with tilelive.
- [tilelive-error](https://github.com/mojodna/tilelive-error) - Avoid repeating error-prone initialization.
- [tilelive-lambda](https://github.com/mojodna/tilelive-lambda) - AWS Lambda source for tilelive.
- [tilelive-cartodb](https://github.com/mojodna/tilelive-cartodb) - A tilelive source for CartoDB.
- [cdbtiles](https://github.com/vsivsi/cdbtiles) - A tilelive backend plug-in for CouchDB.
- [node-tilejson](https://github.com/mapbox/node-tilejson) - Tile source backend for online tile sources.
- [tilelive-foxgis](https://github.com/FoxGIS/tilelive-foxgis) - A tilelive plugin to serve tiles with mongodb
- [tessera](https://github.com/mojodna/tessera) - A tilelive-based tile server.

## Ecosytem of tilelive
![image](https://cloud.githubusercontent.com/assets/1522494/16645056/a8f8fff2-4453-11e6-8ba7-b9aff033f2cd.png)




## Usage

Tilelive doesn't ship with any implementing modules by default. To register a module as one tilelive recognizes:

    require('[implementation]').registerProtocols(tilelive);

* `tilelive.list(source, callback)`: Lists all tilesets in a directory. `source` is a folder that is used by registered implementations to search for individual tilesets. `callback` receives an error object (or `null`) and a hash with keys being Tilestore IDs and values being Tilestore URIs. Example:

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
