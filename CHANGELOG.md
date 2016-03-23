## 5.12.2

* Allow transform-like streams to be used in the `transform` property
* Catch errors in transform stream

## 5.12.1

* Ignore negative x and y that are generated from wide bounds

## 5.12.0

* Add an `--exit` flag to `tilelive-copy` to exit explicitly when copy completes successfully

## 5.11.0

* Attempt to generate a default list stream from source in `tilelive.copy()` if no explicit list is provided

## 5.10.0

* Add option for slow tile logging in `tilelive.copy()`

## 5.9.1

* Fixes for uri parsing and protocol handling in `tilelive.auto()`

## 5.9.0

* Added the ability for headers to pass information to tilelive to continue pyramid tiling if the tree below contains data.

## 5.8.3

* Adds smarter handling of low zoom level tiles to pyramid scheme such that early empty tiles are tolerated without skipping.

## 5.8.2

* Exposes `tilelive.copy()` timeout option to commandline util.

## 5.8.1

* Fixes a bug in `tilelive.copy()` that caused every copy operation to timeout after 60s (or the specified timeout interval).

## 5.8.0

* `tilelive.copy()` operations that stop doing any processing for 60s will error. This timeout interval is configurable.
* `tilelive.copy()` callers can provide a transform stream which will receive each tile read from the source on its way to the destination.

## 5.7.1

* Fixes a bug that allowed `NaN` values in metadata to pass `tilelive.validate`

## 5.7.0

* Adds a `close` option to `tilelive.copy()` which determines whether sources are closed at the end of a copy operation. The shell-executable script `tilelive-copy` hard-wires this option to `true`.

## 5.6.3

* Fixes a bug where list streams could miss tile coordinates under certain conditions
* List streams now throw errors when encountering invalid tile coordinates

## 5.6.2

* Read streams confirm that the tilesource's extent is valid

## 5.6.1

* No retry on 'Does not exist' getTile errors.

## 5.6.0

* Loosens `bounds` validation to be more forgiving of datasets that exceed mercator extents.
* Adds a `retry` option to read/write copy streams for the number of additional times to attempt a getTile/putTile operation if the first attempt fails.

## 5.5.4

* Sets an appropriate default highWaterMark on write streams

## 5.4.1

* Fix liststream by switching to Transform-based stream

## 5.4.0

* Expose copy function as an API
* Fix handling of paths with spaces

## 5.3.3

* Bugfix: list stream continues to read if internal buffer starts with a newline

## 5.3.2

* Bugfix: deserialize streams return the info object as part of every job

## 5.3.1

* Job numbering starts with `0`

## 5.3.0

* Allows read streams to be split into parallel jobs.

## 5.2.0

* Adds serialize/deserialize streams for tilelive copy.

## 5.1.0

* Adds tilelive.validate method for a non-restrictive way to validate tilejson and other common info keys.
* Refactors tilelive.verify to leverage tilelive.validate and optionally take a list of keys to require.

## 5.0.0

* Refactor CopyTask into read/write streams
* Register tilelive protocols globally

## 4.5.3

* Add tilelive.auto method from tilelive-copy for detection and autoloading of
  protocol modules.

## 4.5.2

* Declare support for node v0.10.x in package.json

## 4.5.1

* Minor package.json fixes and updated dependencies

## 4.5.0

* Bug fixes.
* Removes underscore, step dependencies.

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
