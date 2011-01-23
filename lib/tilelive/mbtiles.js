var sqlite = require('sqlite').sqlite3_bindings;
var Step = require('step');

function MBTiles(filename, options) {
  this.filename = filename;
  this.options = options || {};
  this.db = new sqlite.Database();
}

MBTiles.prototype.setup = function(callback) {
    var that = this;
    that.db.open(that.filename, function(err) {
        that.db.prepare(
            'CREATE TABLE IF NOT EXISTS tiles ('
            + 'zoom_level integer, '
            + 'tile_column integer, '
            + 'tile_row integer, '
            + 'tile_data blob);'
            + 'CREATE UNIQUE INDEX IF NOT EXISTS tile_index on tiles '
            + '(zoom_level, tile_column, tile_row);'
            + 'CREATE TABLE IF NOT EXISTS "metadata" ('
            + '"name" TEXT ,'
            + '"value" TEXT);'
            + 'CREATE UNIQUE INDEX IF NOT EXISTS "name" ON "metadata" '
            + '("name");',
            function(err, statement) {
                statement.step(function(err) {
                    console.log('... Creating mbtiles database at %s', that.filename);
                    callback(err);
                });
            }
        );
    });
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
                    console.log('... Inserted tile at [%s, %s, %s]', z, x, y);
                    callback(err);
                });
            }
            else {
                console.log(err);
                callback(err);
            }
        }
    );
};

/**
 * @TODO
MBTiles.prototype.metadata = function(callback) {
    var that = this;
    this.db.open(this.filename, function(err) {
        that.db.executeScript(
            'CREATE TABLE IF NOT EXISTS tiles ('
            + 'zoom_level integer, '
            + 'tile_column integer, '
            + 'tile_row integer, '
            + 'tile_data blob);'
            + 'CREATE UNIQUE INDEX IF NOT EXISTS tile_index on tiles '
            + '(zoom_level, tile_column, tile_row);'
            + 'CREATE TABLE IF NOT EXISTS "metadata" ('
            + '"name" TEXT ,'
            + '"value" TEXT);'
            + 'CREATE UNIQUE INDEX IF NOT EXISTS "name" ON "metadata" '
            + '("name");',
            function(err) {
                that.db.finalizeAndClose();
                callback(err);
            }
        );
    });
};
*/

module.exports = MBTiles;
