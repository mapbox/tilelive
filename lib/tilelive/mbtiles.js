var sqlite = require('sqlite');
var Step = require('step');
var crypto = require('crypto');

function MBTiles(filename, options, callback) {
  this.filename = filename;
  this.options = options || {};
  this.db = new sqlite.Database();
  var that = this;
  this.db.open(this.filename, function() {
      if (typeof callback === 'function') {
          callback(that);
      }
  });
}

/**
 * Setup schema, indices, views for a new mbtiles database.
 */
MBTiles.prototype.setup = function(callback) {
    var that = this;
    Step(
        function() {
            var next = this;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS map ('
                + 'zoom_level integer, '
                + 'tile_column integer, '
                + 'tile_row integer, '
                + 'tile_id VARCHAR(256));',
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
                'CREATE TABLE IF NOT EXISTS images ('
                + 'tile_data blob, '
                + 'tile_id VARCHAR(256));',
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
                'CREATE view tiles AS SELECT '
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
MBTiles.prototype.insert = function(tiles, renders, compress, callback) {
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
 * Insert a single tile into the mbtiles database.
 *
 * @param {Object} tile tile object to be inserted.
 * @param {Function} callback
 */
MBTiles.prototype.insertTile =  function(tile, callback) {
    var that = this;
    var statement;
    that.db.prepare(
        'INSERT INTO map ('
        + 'tile_id, '
        + 'zoom_level, '
        + 'tile_column, '
        + 'tile_row) '
        + 'VALUES (?, ?, ?, ?);',
        function(err, state) {
            statement = state;
            if (statement) {
                statement.bind(1, tile.tile_id, that);
            }
            else {
                callback(err);
            }
        },
        function(err) {
            statement.bind(2, tile.zoom_level, this);
        },
        function(err) {
            statement.bind(3, tile.tile_column, this);
        },
        function(err) {
            statement.bind(4, tile.tile_row, this);
        },
        function(err) {
            statement.step(function(err) {
                callback(err);
            });
        }
    );
};

/**
 * Insert a single image into the mbtiles database.
 *
 * @param {Object} image object to be inserted.
 * @param {Function} callback
 */
MBTiles.prototype.insertImage =  function(image, callback) {
    var that = this;
    var statement;
    that.db.prepare(
        'INSERT OR ABORT INTO images ('
        + 'tile_id, '
        + 'tile_data) '
        + 'VALUES (?, ?);',
        function(err, state) {
            statement = state;
            if (statement) {
                statement.bind(1, image.tile_id, that);
            }
            else {
                callback(err);
            }
        },
        function(err) {
            statement.bind(2, image.tile_data, this);
        },
        function(err) {
            statement.step(function(err) {
                callback(err);
            });
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
    var statement;
    var insert = function(err, key, value, callback) {
        that.db.prepare(
            'INSERT INTO metadata (name, value) VALUES (?, ?);',
            function(err, state) {
                statement = state;
                statement.bind(1, key, this);
            },
            function(err) {
                statement.bind(2, value);
            },
            function(err) {
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
 * @param {Number} x tile x coordinate
 * @param {Number} y tile y coordinate
 * @param {Number} z tile z coordinate
 * @param {Function} callback
 */
MBTiles.prototype.tile = function(x, y, z, callback) {
    var that = this;
    var statement;
    Step(
        function() {
            var next = this;
            that.db.prepare(
                'SELECT tile_data FROM tiles WHERE '
                + 'zoom_level = ? AND '
                + 'tile_column = ? AND '
                + 'tile_row = ?;',
                function(err, state) {
                    statement = state;
                    if (statement) {
                        statement.bind(1, z, next);
                    }
                    else {
                        next(err);
                    }
                }
            );
        },
        function(err) {
            statement.bind(2, x, this);
        },
        function(err) {
            statement.bind(3, y, this);
        },
        function(err) {
            statement.step(this);
        },
        function(err, row) {
            if (!err && row && row.tile_data) {
                callback(err, row.tile_data);
            } else {
                callback(err);
            }
        }
    );
};

module.exports = MBTiles;
