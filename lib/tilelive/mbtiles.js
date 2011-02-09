var sqlite = require('sqlite').sqlite3_bindings;
var Step = require('step');
var crypto = require('crypto');

function MBTiles(filename, options) {
  this.filename = filename;
  this.options = options || {};
  this.db = new sqlite.Database();
}

/**
 * Setup schema, indices, views for a new mbtiles database.
 */
MBTiles.prototype.setup = function(callback) {
    var that = this;
    Step(
        function() {
            that.db.open(that.filename, this);
        },
        // # Map
        function() {
            var next = this;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS map ('
                + 'zoom_level INTEGER, '
                + 'tile_column INTEGER, '
                + 'tile_row INTEGER, '
                + 'tile_id TEXT,'
                + 'grid_id TEXT);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS map_index on map '
                + '(zoom_level, tile_column, tile_row);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS grid_key ('
                + 'grid_id TEXT, '
                + 'key_id TEXT);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS grid_key_lookup on grid_key '
                + '(grid_id, key_id);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS keymap ('
                + 'key_id TEXT, '
                + 'key_json TEXT);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS keymap_lookup on keymap '
                + '(key_id);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS grid_utfgrid ('
                + 'grid_id TEXT, '
                + 'grid_utfgrid TEXT);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS grid_utfgrid_lookup on grid_utfgrid '
                + '(grid_id);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS images ('
                + 'tile_data blob, '
                + 'tile_id text);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS images_id on images '
                + '(tile_id);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE view IF NOT EXISTS tiles AS SELECT '
                + 'map.zoom_level AS zoom_level, '
                + 'map.tile_column as tile_column, '
                + 'map.tile_row as tile_row, '
                + 'images.tile_data as tile_data '
                + 'FROM map '
                + 'JOIN images ON images.tile_id = map.tile_id;',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS metadata ('
                + 'name text,'
                + 'value text);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS name on metadata '
                + '(name);',
                function(err, statement) { statement.step(next); }
            );
        },
        // Set the synchronous flag to NORMAL for (much) faster inserts.
        // See http://www.sqlite.org/pragma.html#pragma_synchronous
        function() {
            var next = this;
            that.db.prepare(
                'PRAGMA synchronous = 1',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            callback();
        }
    );
};


/**
 * Insert a set of tiles into an mbtiles database.
 *
 * @param {Array} tiles array of tile [z, x, y] coordinates to be inserted.
 * @param {Array} renders array of tile images to be inserted. Indices should
 *   correspond to the coordinates of the tiles array.
 * @param {Boolean} compress whether to "compress" the mbtiles database by
 *   inserting only unique tile renders.
 * @param {Function} callback
 */
MBTiles.prototype.insertGrid = function(tiles, renders, compress, callback) {
    var that = this,
        map = [],
        images = [],
        ids = [],
        inserted = [];
    for (var i = 0; i < tiles.length; i++) {
        var tile_id;
        if (compress) {
            // Generate ID from MD5 hash of actual image data.
            tile_id = crypto.createHash('md5').update(renders[i]).digest('hex');
        } else {
            // Generate ID from tile coordinates (unique).
            tile_id = crypto.createHash('md5').update(JSON.stringify(tiles[i])).digest('hex');
        }
        if (ids.indexOf(tile_id) === -1) {
            ids.push(tile_id);
            images.push({
                tile_id: tile_id,
                tile_data: renders[i]
            });
        }
        map.push({
            tile_id: tile_id,
            zoom_level: tiles[i][0],
            tile_column: tiles[i][1],
            tile_row: tiles[i][2]
        });
    }

    Step(
        function() {
            var group = this.group();
            for (var i = 0; i < images.length; i++) {
                that.insertGrid(images[i], group());
            }
            for (var i = 0; i < map.length; i++) {
                that.insertGridTile(map[i], group());
            }
        },
        function(err) {
            callback(err);
        }
    );
};

/**
 * Insert a set of tiles into an mbtiles database.
 *
 * @param {Array} tiles array of tile [z, x, y] coordinates to be inserted.
 * @param {Array} renders array of tile images to be inserted. Indices should
 *   correspond to the coordinates of the tiles array.
 * @param {Boolean} compress whether to "compress" the mbtiles database by
 *   inserting only unique tile renders.
 * @param {Function} callback
 */
MBTiles.prototype.insertTiles = function(tiles, renders, compress, callback) {
    var that = this,
        map = [],
        images = [],
        ids = [],
        inserted = [];
    for (var i = 0; i < tiles.length; i++) {
        var tile_id;
        if (compress) {
            // Generate ID from MD5 hash of actual image data.
            tile_id = crypto.createHash('md5').update(renders[i]).digest('hex');
        } else {
            // Generate ID from tile coordinates (unique).
            tile_id = crypto.createHash('md5').update(JSON.stringify(tiles[i])).digest('hex');
        }
        if (ids.indexOf(tile_id) === -1) {
            ids.push(tile_id);
            images.push({
                tile_id: tile_id,
                tile_data: renders[i]
            });
        }
        map.push({
            tile_id: tile_id,
            zoom_level: tiles[i][0],
            tile_column: tiles[i][1],
            tile_row: tiles[i][2]
        });
    }

    Step(
        function() {
            var group = this.group();
            for (var i = 0; i < images.length; i++) {
                that.insertImage(images[i], group());
            }
            for (var i = 0; i < map.length; i++) {
                that.insertTile(map[i], group());
            }
        },
        function(err) {
            callback(err);
        }
    );
};

/**
 * Insert a single feature into the grid_data table,
 * with the key/axis of `key`
 */
MBTiles.prototype.insertGridData = function(data, key_name, callback) {
    var that = this;
    that.db.prepare(
        'INSERT OR ABORT INTO grid_data ('
        + 'key, '
        + 'value) '
        + 'VALUES (?, ?);',
        function(err, statement) {
            if (statement) {
                callback(err);
                statement.bind(1, data[key_name]);
                statement.bind(2, JSON.stringify(data));
                statement.step(function(err) {
                    callback(err);
                });
            }
            else {
                callback(err);
            }
        }
    );
};

/**
 * Insert a single tile into the mbtiles database.
 *
 * @param {Object} tile tile object to be inserted.
 * @param {Function} callback
 */
MBTiles.prototype.insertTile = function(tile, callback) {
    var that = this;
    that.db.prepare(
        'INSERT INTO map ('
        + 'tile_id, '
        + 'zoom_level, '
        + 'tile_column, '
        + 'tile_row) '
        + 'VALUES (?, ?, ?, ?);',
        function(err, statement) {
            if (statement) {
                statement.bind(1, tile.tile_id);
                statement.bind(2, tile.zoom_level);
                statement.bind(3, tile.tile_column);
                statement.bind(4, tile.tile_row);
                statement.step(function(err) {
                    callback(err);
                });
            }
            else {
                callback(err);
            }
        }
    );
};

/**
 * Insert a single tile into the mbtiles database.
 *
 * @param {Object} tile tile object to be inserted.
 * @param {Function} callback
 */
MBTiles.prototype.insertGridTile = function(tile, callback) {
    var that = this;
    that.db.prepare(
        'INSERT INTO  ('
        + 'tile_id, '
        + 'zoom_level, '
        + 'tile_column, '
        + 'tile_row) '
        + 'VALUES (?, ?, ?, ?);',
        function(err, statement) {
            if (statement) {
                statement.bind(1, tile.tile_id);
                statement.bind(2, tile.zoom_level);
                statement.bind(3, tile.tile_column);
                statement.bind(4, tile.tile_row);
                statement.step(function(err) {
                    callback(err);
                });
            }
            else {
                callback(err);
            }
        }
    );
};

/**
 * Insert a single image into the mbtiles database.
 *
 * @param {Object} image object to be inserted.
 * @param {Function} callback
 */
MBTiles.prototype.insertImage = function(image, callback) {
    var that = this;
    that.db.prepare(
        'INSERT OR ABORT INTO images ('
        + 'tile_id, '
        + 'tile_data) '
        + 'VALUES (?, ?);',
        function(err, statement) {
            if (statement) {
                statement.bind(1, image.tile_id);
                statement.bind(2, image.tile_data);
                statement.step(function(err) {
                    callback(err);
                });
            }
            else {
                callback(err);
            }
        }
    );
};

/**
 * Insert metadata into the mbtiles database.
 *
 * @param {Object} metadata key, value hash of metadata to be inserted.
 * @param {Function} callback
 */
MBTiles.prototype.metadata = function(metadata, callback) {
    var that = this;
    var insert = function(err, key, value, callback) {
        that.db.prepare(
            'INSERT INTO metadata (name, value) VALUES (?, ?);',
            function(err, statement) {
                statement.bind(1, key);
                statement.bind(2, value);
                statement.step(callback);
            }
        );
    };
    Step(
        function() {
            var group = this.group();
            for (var name in metadata) {
                insert(null, name, metadata[name], group());
            }
        },
        function(err) {
            callback(err);
        }
    );
};

/**
 * Select a tile from an mbtiles database.
 *
 * @param {Number} x tile x coordinate.
 * @param {Number} y tile y coordinate.
 * @param {Number} z tile z coordinate.
 * @param {Function} callback
 */
MBTiles.prototype.tile = function(x, y, z, callback) {
    var that = this;
    Step(
        function() {
            that.db.open(that.filename, this);
        },
        function() {
            var next = this;
            that.db.prepare(
                'SELECT tile_data FROM tiles WHERE '
                + 'zoom_level = ? AND '
                + 'tile_column = ? AND '
                + 'tile_row = ?;',
                function(err, statement) {
                    if (statement) {
                        statement.bind(1, z);
                        statement.bind(2, x);
                        statement.bind(3, y);
                        statement.step(next);
                    }
                    else {
                        next(err);
                    }
                }
            );
        },
        function(err, row) {
            that.db.close();
            if (!err && row && row.tile_data) {
                callback(err, row.tile_data);
            } else {
                callback(err);
            }
        }
    );
};

module.exports = MBTiles;
