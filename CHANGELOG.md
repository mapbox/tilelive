## 4.4.0

* Remove deprecated tilelive.copy method in favor of CopyTask.
* Rewrite tilelive-copy with better interface and detection of protocols.

## 4.3.3

* Remove uncaughtException handler from CopyTask.

## 4.3.2

* More lenient validation of north and south bbox values.
* CopyTask treats 'Tile|Grid does not exist' errors as skips.
* CopyTask can now accept loaded tilelive sources.
* Add "all" and "clean" rules to Makefile, by @strk.

## 4.3.1

* Node v0.8 support.

## 4.3.0

* Bug fixes for CopyTask.
* Removes use of `putDuplicateTile` from TileSink interface.

## 4.2.0

* Rewritten copy command with swappable schemes.

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

