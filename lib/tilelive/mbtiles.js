var sqlite = require('sqlite'),
    Step = require('step');

function MBTiles(filename, options) {
  this.filename = filename;
  this.options = options || {};
  this.db = new sqlite.Database();
}

MBTiles.prototype.setup = function(callback) {
  this.open(function(err, db) {
    err && console.log(err);
    db.executeScript(
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
      + '("name");', function(err) {
          err && console.log(err);
    });
  });
};

MBTiles.prototype.metadata = function(callback) {
  this.open(function(err, db) {
    err && console.log(err);
    db.executeScript(
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
      + '("name");', function(err) {
          err && console.log(err);
    });
  });
};

MBTiles.prototype.open = function(callback) {
  var that = this;
  this.db.open(this.filename, function(err) {
    callback(err, that.db);
  });
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
