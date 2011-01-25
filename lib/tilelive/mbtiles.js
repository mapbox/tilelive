var sqlite = require('sqlite').sqlite3_bindings;
var Step = require('step');

function MBTiles(filename, options) {
  this.filename = filename;
  this.options = options || {};
  this.db = new sqlite.Database();
}

MBTiles.prototype.setup = function(callback) {
    var that = this;
    Step(
        function() {
            that.db.open(that.filename, this);
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE TABLE IF NOT EXISTS tiles ('
                + 'zoom_level integer, '
                + 'tile_column integer, '
                + 'tile_row integer, '
                + 'tile_data blob);',
                function(err, statement) { statement.step(next); }
            );
        },
        function() {
            var next = this;
            that.db.prepare(
                'CREATE UNIQUE INDEX IF NOT EXISTS tile_index on tiles '
                + '(zoom_level, tile_column, tile_row);',
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
        function() {
            callback();
        }
    );
};

MBTiles.prototype.insertTile =  function(tile, x, y, z, callback) {
    var that = this;
    that.db.prepare(
        'INSERT INTO tiles ('
        + 'tile_data, '
        + 'zoom_level, '
        + 'tile_column, '
        + 'tile_row) '
        + 'VALUES (?, ?, ?, ?);',
        function(err, statement) {
            if (statement) {
                statement.bind(1, tile);
                statement.bind(2, z);
                statement.bind(3, x);
                statement.bind(4, y);
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
 * TODO: broken because of no node-sqlite blob support
 *
 * "Assertion failed: (0 && "unsupported type"), function EIO_FetchAll, file ../src/statement.cc, line 919."
 */
MBTiles.prototype.tile = function(x, y, z, callback) {
  this.open(function(err, db) {
    db.execute('SELECT tile_data FROM tiles WHERE'
        + ' zoom_level = ' + z
        + ' and tile_column = ' + x
        + ' and tile_row = ' + y, function(err, tile) {
            console.log(err);
            callback(tile);
        });
  });
};

module.exports = MBTiles;
