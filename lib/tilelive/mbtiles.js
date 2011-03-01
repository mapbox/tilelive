var sqlite3 = require('sqlite3');
var fs = require('fs');
var Step = require('step');
var crypto = require('crypto');
var compress = require('compress');

// Helper wrapper around `compress.Gnzip` that
// takes a compressed buffer and calls a callback
// with an deflated (compressed) string.
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

// Helper wrapper around `compress.Gunzip` that
// takes a decompressed buffer and calls a callback 
// with an inflated (decompressed) string.
function inflate(buffer, callback) {
    var gz = new compress.Gunzip();
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

// MBTiles
// -------
// MBTiles class for doing common operations (schema setup, tile reading,
// insertion, etc.)
function MBTiles(filename, options, callback) {
    this.options = options || {};
    this.filename = filename;
    this.db = new sqlite3.Database(filename, callback);
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

    this.db.all('SELECT name FROM sqlite_master WHERE type IN (?, ?)',
        'table',
        'view',
        function(err, rows) {
            if (err) return callback(err);
            for (var i = 0; i < rows.length; i++) {
                that.schema.push(rows[i].name);
            }
            that.exists(table, callback);
        });
}

// Setup schema, indices, views for a new mbtiles database.
MBTiles.prototype.setup = function(callback) {
    var db = this.db;
    fs.readFile(__dirname + '/schema.sql', 'utf8', function(err, sql) {
        if (err) return callback(err);

        db.serialize(function() {
            // Set the synchronous flag to OFF for (much) faster inserts.
            // See http://www.sqlite3.org/pragma.html#pragma_synchronous
            db.run('PRAGMA synchronous = 0');
            db.exec(sql, callback);
        });
    });
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
            grid_id = crypto.createHash('md5')
                .update(renders[i][0]).digest('hex');
        } else {
            // Generate ID from tile coordinates (unique).
            grid_id = crypto.createHash('md5')
                .update(JSON.stringify(tiles[i])).digest('hex');
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

            that.insertUTFGrids(grids, group());
            that.insertGridKeys(grid_keys, group());
            that.insertGridTiles(map, group());
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
            tile_id = crypto.createHash('md5')
                .update(renders[i]).digest('hex');
        } else {
            // Generate ID from tile coordinates (unique).
            tile_id = crypto.createHash('md5')
                .update(JSON.stringify(tiles[i])).digest('hex');
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

// Given an array of mappings of grid_id to key_name, insert
// them all into the `grid_key` table.
MBTiles.prototype.insertGridKeys = function(grid_keys, callback) {
    var stmt = this.db.prepare('INSERT OR IGNORE INTO grid_key' +
                          '    (grid_id, key_name) VALUES (?, ?)');
    for (var i = 0; i < grid_keys.length; i++) {
        stmt.run(
            grid_keys[i].grid_id,
            grid_keys[i].key_name
        );
    }
    stmt.finalize(callback);
};

// Insert a single feature into the grid_data table,
// with the key/axis of `key`
MBTiles.prototype.insertGridData = function(data, key_name, callback) {
    this.db.run(
        'INSERT OR IGNORE INTO keymap (key_name, key_json) VALUES (?, ?)',
        data[key_name],
        JSON.stringify(data),
        callback
    );
};

// Insert a single tile into the mbtiles database.
//
// - @param {Object} tile tile object to be inserted.
// - @param {Function} callback
MBTiles.prototype.insertTile = function(tile, callback) {
    this.db.run(
        'INSERT INTO map (tile_id, zoom_level, tile_column, tile_row) VALUES (?, ?, ?, ?)',
        tile.tile_id,
        tile.zoom_level,
        tile.tile_column,
        tile.tile_row,
        callback
    );
};

// Insert a single tile into the mbtiles database.
//
// - @param {Object} tile tile object to be inserted.
// - @param {Function} callback
MBTiles.prototype.insertGridTiles = function(map, callback) {
    var stmt = this.db.prepare('UPDATE OR REPLACE map SET grid_id = ? WHERE ' +
        ' zoom_level = ? AND tile_column = ? AND tile_row = ?');

    for (var i = 0; i < map.length; i++) {
        stmt.run(
            map[i].grid_id,
            map[i].zoom_level,
            map[i].tile_column,
            map[i].tile_row
        );
    }

    stmt.finalize(callback);
};

// Insert a single grid into the mbtiles database.
//
// - @param {Object} image object to be inserted.
// - @param {Function} callback
MBTiles.prototype.insertUTFGrids = function(grids, callback) {
    var stmt = this.db.prepare('INSERT OR IGNORE INTO grid_utfgrid'
                             + '    (grid_id, grid_utfgrid) VALUES (?, ?)');

    var total = grids.length, ran = 0;
    grids.forEach(function(grid) {
        deflate(grid.grid_utfgrid, function(err, data) {
            if (err) throw err;
            stmt.run(grid.grid_id, data);
            if (++ran === total) stmt.finalize(callback);
        });
    });
};

// Insert a single image into the mbtiles database.
//
// - @param {Object} image object to be inserted.
// - @param {Function} callback
MBTiles.prototype.insertImage = function(image, callback) {
    this.db.run(
        'INSERT OR IGNORE INTO images (tile_id, tile_data) VALUES (?, ?)',
        image.tile_id,
        image.tile_data,
        callback
    );
};

// Insert metadata into the mbtiles database.
//
// - @param {Object} metadata key, value hash of metadata to be inserted.
// - @param {Function} callback
MBTiles.prototype.insertMetadata = function(metadata, callback) {
    var stmt = this.db.prepare('INSERT INTO metadata (name, value) VALUES (?, ?)');
    for (var name in metadata) {
        stmt.run(name, metadata[name]);
    }
    stmt.finalize(callback);
};

// Select a tile from an mbtiles database.
//
// - @param {Number} x tile x coordinate.
// - @param {Number} y tile y coordinate.
// - @param {Number} z tile z coordinate.
// - @param {Function} callback
MBTiles.prototype.tile = function(x, y, z, callback) {
    this.db.get('SELECT tile_data FROM tiles WHERE ' +
        'zoom_level = ? AND tile_column = ? AND tile_row = ?',
        z, x, y,
        function(err, row) {
            if (err) callback(err);
            else if (!row || !row.tile_data) callback('Tile does not exist');
            else callback(null, row.tile_data);
        });
};

// Get grid data at a certain `x, y, z` coordinate, calling
// back with an error argument if the grid is not found.
MBTiles.prototype.grid_data = function(x, y, z, callback) {
    this.db.all('SELECT key_name, key_json FROM grid_data WHERE ' +
        'zoom_level = ? AND tile_column = ? AND tile_row = ?',
        z, x, y,
        function(err, rows) {
            if (err) callback(err);
            else if (!rows.length) callback('Grid data does not exist');
            else callback(null, rows.reduce(function(memo, r) {
                memo[r.key_name] = JSON.parse(r.key_json);
                return memo;
            }, {}));
        });
};

// Select a tile from an mbtiles database.
//
// - @param {Number} x tile x coordinate
// - @param {Number} y tile y coordinate
// - @param {Number} z tile z coordinate
// - @param {Function} callback
MBTiles.prototype.grid = function(x, y, z, callback) {
    this.db.get('SELECT grid FROM grids WHERE ' +
        'zoom_level = ? AND tile_column = ? AND tile_row = ?',
        z, x, y,
        function(err, row) {
            if (err) callback(err);
            else if (!row || !row.grid) callback('Grid does not exist');
            else callback(null, row.grid);
        });
};

// Select a metadata value from the database.
//
// - @param {Function} callback
MBTiles.prototype.metadata = function(key, callback) {
    this.db.get('SELECT value FROM metadata WHERE name = ?',
        key,
        function(err, row) {
            if (err) callback(err);
            else if (!row) callback('Key does not exist');
            else callback(null, row.value);
        });
};

// Render handler for a given tile request.
MBTiles.prototype.render = function(tile, callback) {
    switch (tile.format) {
    case 'layer.json':
        var that = this,
            layer = {};
        Step(
            function() {
                that.metadata('formatter', this);
            },
            function(err, f) {
                if (err) return this();
                layer.formatter = f;
                this();
            },
            function() {
                that.metadata('legend', this);
            },
            function(err, l) {
                if (err) return this();
                layer.legend = l;
                this();
            },
            function() {
                callback(null, layer);
            }
        );
        break;
    case 'grid.json':
        var that = this,
            grid;
        Step(
            function() {
                that.grid(tile.x, tile.y, tile.z, this);
            },
            function(err, g) {
                if (err) throw err;
                inflate(new Buffer(g, 'binary'), this);
            },
            function(err, g) {
                if (err) throw err;
                grid = g.toString();
                that.grid_data(tile.x, tile.y, tile.z, this);
            },
            function(err, gd) {
                if (err) return callback(err);

                // Manually append grid data as a string to the grid buffer.
                // Ideally we would
                //
                //     JSON.stringify(_.extend(JSON.parse(grid), { data: gd }))
                //
                // But calling JSON stringify will escape UTF8 characters of a
                // high enough ordinal making the grid data unusable. Instead,
                // manipulate the JSON string directly, popping the trailing }
                // off and splicing the grid data in at the "data" key.
                grid = grid.substr(0, grid.length - 1)
                    + ', "data":'
                    + JSON.stringify(gd)
                    + '}';
                callback(err, grid);
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
