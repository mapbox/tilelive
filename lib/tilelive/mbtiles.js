var sqlite = require('sqlite');
var Step = require('step');
var crypto = require('crypto');
var compress = require('compress');

function deflate(buffer, callback) {
    var gz = new compress.Gzip();
    var data = '';
    gz.write(buffer, function(err, chunk) {
        if (err) {
            callback(err);
            callback = undefined;
        }
        else data += chunk;
    });
    gz.close(function(err, chunk) {
        if (err) {
            if (callback) callback(err);
        }
        else data = callback(null, data + chunk);
    });
}

// Wrapper around `statement.step()` for handling multi-row result sets.
function rows(data, callback) {
    // If only one argument is given, it's the callback
    if (!callback) {
        callback = data;
        data = null;
    }
    return function(err, statement) {
        if (err) throw err;
        if (data) {
            statement.bindArray(data, grab);
        } else {
            grab(null);
        }

        function grab(err) {
            if (err) throw err;
            var rows = [];
            var next = function(err, row) {
                if (err || !row) {
                    statement.finalize(function() {
                        callback(err, rows);
                    });
                } else {
                    rows.push(row);
                    statement.step(next);
                }
            }
            statement.step(next);
        }
    };
}

// Wrapper around `statement.bind()`. Allows an array of values to be bound to
// a statement, steps through and finalizes.
function bind(data, callback) {
    return function(err, statement) {
        if (err) throw err;
        statement.bindArray(data, function(err) {
            if (err) throw err;
            statement.step(function(err, row) {
                if (err) throw sqlite.sanitizeError(err, data);
                statement.finalize(function() {
                    callback(err, row);
                });
            });
        });
    };
}

// MBTiles
// -------
// MBTiles class for doing common operations (schema setup, tile reading,
// insertion, etc.)
function MBTiles(filename, options) {
  this.filename = filename;
  this.options = options || {};
  this.db = new sqlite.Database();
}

// Wrapper method around `db.open()`.
MBTiles.prototype.open = function(callback) {
  this.db.open(this.filename, callback);
}

// Retrieve the schema of the current mbtiles database and inform the caller of
// whether the specified table exists.
MBTiles.prototype.exists = function(table, callback) {
    if (this.schema) {
        if (this.schema.indexOf(table) !== -1) {
            return callback(null, true);
        } else {
            return callback(null, false);
        }
    }

    var that = this;
    that.schema = [];
    Step(
        function() {
            that.db.prepare(
                'SELECT name '
                + 'FROM sqlite_master '
                + 'WHERE type IN ("table", "view");',
                rows(this)
            );
        },
        function(err, rows) {
            if (err) return callback(err);
            for (var i = 0; i < rows.length; i++) {
                that.schema.push(rows[i].name);
            }
            that.exists(table, callback);
        }
    );
}

// Setup schema, indices, views for a new mbtiles database.
MBTiles.prototype.setup = function(callback) {
    var that = this;
    Step(
        function() {
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS map ('
                + 'zoom_level integer, '
                + 'tile_column integer, '
                + 'tile_row integer, '
                + 'tile_id TEXT, '
                + 'grid_id TEXT);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS map_index ON map '
                + '(zoom_level, tile_column, tile_row);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS grid_key ('
                + 'grid_id TEXT, '
                + 'key_name TEXT);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS grid_key_lookup ON grid_key '
                + '(grid_id, key_name);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS keymap ('
                + 'key_name TEXT, '
                + 'key_json TEXT);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS keymap_lookup ON keymap '
                + '(key_name);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS grid_utfgrid ('
                + 'grid_id TEXT, '
                + 'grid_utfgrid TEXT);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS grid_utfgrid_lookup ON grid_utfgrid '
                + '(grid_id);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS images ('
                + 'tile_data blob, '
                + 'tile_id text);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS images_id ON images '
                + '(tile_id);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE VIEW IF NOT EXISTS tiles AS SELECT '
                + 'map.zoom_level AS zoom_level, '
                + 'map.tile_column AS tile_column, '
                + 'map.tile_row AS tile_row, '
                + 'images.tile_data AS tile_data '
                + 'FROM map '
                + 'JOIN images ON images.tile_id = map.tile_id',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE VIEW IF NOT EXISTS grids AS SELECT '
                + 'map.zoom_level AS zoom_level, '
                + 'map.tile_column AS tile_column, '
                + 'map.tile_row AS tile_row, '
                + 'grid_utfgrid.grid_utfgrid AS grid '
                + 'FROM map '
                + 'JOIN grid_utfgrid ON grid_utfgrid.grid_id = map.grid_id',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE VIEW IF NOT EXISTS grid_data AS SELECT ' +
                'map.zoom_level AS zoom_level, ' +
                'map.tile_column AS tile_column, ' +
                'map.tile_row AS tile_row, ' +
                'keymap.key_name AS key_name, ' +
                'keymap.key_json AS key_json ' +
                'FROM map ' +
                'JOIN grid_key ON map.grid_id = grid_key.grid_id ' +
                'JOIN keymap ON grid_key.key_name = keymap.key_name;',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS metadata ('
                + 'name text,'
                + 'value text);',
                rows(this)
            );
        },
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS name ON metadata '
                + '(name);',
                rows(this)
            );
        },
        // Set the synchronous flag to OFF for (much) faster inserts.
        // See http://www.sqlite.org/pragma.html#pragma_synchronous
        function(err) {
            if (err) throw err;
            that.db.prepare(
                'PRAGMA synchronous = 0',
                rows(this)
            );
        },
        callback
    );
};


// Insert a set of tiles into an mbtiles database.
//
// - @param {Array} tiles array of tile [z, x, y] coordinates to be inserted.
// - @param {Array} renders array of tile images to be inserted. Indices should
//   correspond to the coordinates of the tiles array.
// - @param {Boolean} compress whether to "compress" the mbtiles database by
//   inserting only unique tile renders.
// - @param {Function} callback
MBTiles.prototype.insertGrids = function(tiles, renders, compress, callback) {
    var that = this,
        map = [],
        grids = [],
        grid_keys = [],
        ids = [],
        inserted = [];
    for (var i = 0; i < tiles.length; i++) {
        var grid_id;
        if (compress) {
            // Generate ID from MD5 hash of actual image data.
            grid_id = crypto.createHash('md5').update(renders[i][0]).digest('hex');
        } else {
            // Generate ID from tile coordinates (unique).
            grid_id = crypto.createHash('md5').update(JSON.stringify(tiles[i])).digest('hex');
        }
        if (ids.indexOf(grid_id) === -1) {
            ids.push(grid_id);
            grids.push({
                grid_id: grid_id,
                grid_utfgrid: renders[i][0]
            });
        }
        renders[i][2].keys.forEach(function(k) {
            grid_keys.push({
                grid_id: grid_id,
                key_name: k
            });
        });
        map.push({
            grid_id: grid_id,
            zoom_level: tiles[i][0],
            tile_column: tiles[i][1],
            tile_row: tiles[i][2]
        });
    }

    Step(
        function() {
            var group = this.group();
            for (var i = 0; i < grids.length; i++) {
                that.insertGrid(grids[i], group());
            }
            for (var i = 0; i < grid_keys.length; i++) {
                that.insertGridKey(grid_keys[i], group());
            }
            for (var i = 0; i < map.length; i++) {
                that.insertGridTile(map[i], group());
            }
        },
        callback
    );
};

// Insert a set of tiles into an mbtiles database.
//
// - @param {Array} tiles array of tile [z, x, y] coordinates to be inserted.
// - @param {Array} renders array of tile images to be inserted. Indices should
//   correspond to the coordinates of the tiles array.
// - @param {Boolean} compress whether to "compress" the mbtiles database by
//   inserting only unique tile renders.
// - @param {Function} callback
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
        callback
    );
};

MBTiles.prototype.insertGridKey = function(grid_key, callback) {
    this.db.prepare(
        'INSERT OR IGNORE INTO grid_key ('
        + 'grid_id, '
        + 'key_name) '
        + 'VALUES (?, ?);',
        bind([
            grid_key.grid_id,
            grid_key.key_name
        ], callback)
    );
};

// Insert a single feature into the grid_data table,
// with the key/axis of `key`
MBTiles.prototype.insertGridData = function(data, key_name, callback) {
    this.db.prepare(
        'INSERT OR IGNORE INTO keymap ('
        + 'key_name, '
        + 'key_json) '
        + 'VALUES (?, ?);',
        bind([
            data[key_name],
            JSON.stringify(data)
        ], callback)
    );
};

// Insert a single tile into the mbtiles database.
//
// - @param {Object} tile tile object to be inserted.
// - @param {Function} callback
MBTiles.prototype.insertTile = function(tile, callback) {
    this.db.prepare(
        'INSERT INTO map ('
        + 'tile_id, '
        + 'zoom_level, '
        + 'tile_column, '
        + 'tile_row) '
        + 'VALUES (?, ?, ?, ?);',
        bind([
            tile.tile_id,
            tile.zoom_level,
            tile.tile_column,
            tile.tile_row
        ], callback)
    );
};

// Insert a single tile into the mbtiles database.
//
// - @param {Object} tile tile object to be inserted.
// - @param {Function} callback
MBTiles.prototype.insertGridTile = function(tile, callback) {
    this.db.prepare(
        'UPDATE OR REPLACE map SET grid_id = ? WHERE '
        + ' zoom_level = ? AND'
        + ' tile_column = ? AND'
        + ' tile_row = ?;',
        bind([
            tile.grid_id,
            tile.zoom_level,
            tile.tile_column,
            tile.tile_row
        ], callback)
    );
};

// Insert a single grid into the mbtiles database.
//
// - @param {Object} image object to be inserted.
// - @param {Function} callback
MBTiles.prototype.insertGrid = function(grid, callback) {
    var that = this;
    deflate(grid.grid_utfgrid, function(err, data) {
        if (err) throw err;
        that.db.prepare(
            'INSERT OR IGNORE INTO grid_utfgrid ('
            + 'grid_id, '
            + 'grid_utfgrid) '
            + 'VALUES (?, ?);',
            bind([
                grid.grid_id,
                data
            ], callback)
        );
    });
};

// Insert a single image into the mbtiles database.
//
// - @param {Object} image object to be inserted.
// - @param {Function} callback
MBTiles.prototype.insertImage = function(image, callback) {
    this.db.prepare(
        'INSERT OR IGNORE INTO images ('
        + 'tile_id, '
        + 'tile_data) '
        + 'VALUES (?, ?);',
        bind([
            image.tile_id,
            image.tile_data
        ], callback)
    );
};

// Insert metadata into the mbtiles database.
//
// - @param {Object} metadata key, value hash of metadata to be inserted.
// - @param {Function} callback
MBTiles.prototype.metadata = function(metadata, callback) {
    var that = this;
    Step(
        function() {
            var group = this.group();
            for (var name in metadata) {
                that.db.prepare(
                    'INSERT INTO metadata (name, value) VALUES (?, ?);',
                    bind([
                        name,
                        metadata[name]
                    ], group())
                );
            }
        },
        callback
    );
};

// Select a tile from an mbtiles database.
//
// - @param {Number} x tile x coordinate.
// - @param {Number} y tile y coordinate.
// - @param {Number} z tile z coordinate.
// - @param {Function} callback
MBTiles.prototype.tile = function(x, y, z, callback) {
    var that = this;
    Step(
        function() {
            that.exists('tiles', this);
        },
        function(err, exists) {
            if (err || !exists) {
                throw new Error('tiles table does not exist');
            }
            that.db.prepare(
                'SELECT tile_data FROM tiles WHERE '
                + 'zoom_level = ? AND '
                + 'tile_column = ? AND '
                + 'tile_row = ?;',
                bind([ z, x, y ], this)
            );
        },
        function(err, row) {
            if (err) callback(err);
            else if (!row || !row.tile_data) callback('empty row');
            else callback(null, row.tile_data);
        }
    );
};


MBTiles.prototype.grid_data = function(x, y, z, callback) {
    var that = this;
    Step(
        function(exists) {
            that.exists('grid_data', this);
        },
        function(err, exists) {
            if (err || !exists) {
                throw new Error('grid_data table does not exist');
            }
            that.db.prepare(
                'SELECT key_name, key_json FROM grid_data WHERE '
                + 'zoom_level = ? AND '
                + 'tile_column = ? AND '
                + 'tile_row = ?;',
                rows([z, x, y], this)
            );
        },
        function(err, rows) {
            if (err) return callback(err);
            else if (!rows) return callback('empty');
            callback(null, rows.reduce(function(memo, r) {
                memo[r.key_name] = JSON.parse(r.key_json);
                return memo;
            }, {}));
        }
    );
};

// Select a tile from an mbtiles database.
//
// - @param {Number} x tile x coordinate
// - @param {Number} y tile y coordinate
// - @param {Number} z tile z coordinate
// - @param {Function} callback
MBTiles.prototype.grid = function(x, y, z, callback) {
    var that = this;
    Step(
        function() {
            that.exists('grids', this);
        },
        function(err, exists) {
            if (err || !exists) {
                throw new Error('grids table does not exist');
            }
            that.db.prepare(
                'SELECT grid FROM grids WHERE '
                + 'zoom_level = ? AND '
                + 'tile_column = ? AND '
                + 'tile_row = ?;',
                bind([ z, x, y ], this)
            );
        },
        function(err, row) {
            if (err) callback(err);
            else if (!row || !row.grid) callback('empty row');
            else callback(null, row.grid);
        }
    );
};

// Select a formatter from an mbtiles database.
//
// - @param {Function} callback
MBTiles.prototype.formatter = function(callback) {
    var that = this;
    Step(
        function() {
            that.db.prepare(
                'SELECT value FROM metadata WHERE '
                + 'name = "formatter";',
                rows(this))
        },
        function(err, rows) {
            if (err) callback(err);
            else if (!rows[0] || !rows[0].value) callback('empty row');
            else callback(null, rows[0].value);
        }
    );
};

// Render handler for a given tile request.
MBTiles.prototype.render = function(tile, callback) {
    switch (tile.format) {
    case 'formatter.json':
        this.formatter(callback);
        break;
    case 'grid.json':
        var that = this,
            grid,
            grid_data;
        Step(
            function() {
                that.grid(tile.x, tile.y, tile.z, this);
            },
            function(err, g) {
                grid = g;
                that.grid_data(tile.x, tile.y, tile.z, this);
            },
            function(err, gd) {
                grid_data = gd;
                callback(err, [grid, grid_data]);
            }
        );
        break;
    default:
        this.tile(tile.x, tile.y, tile.z, function(err, image) {
            callback(err, [image, { 'Content-Type': 'image/png' }]);
        });
        break;
    }
};

module.exports = MBTiles;
