var sqlite = require('sqlite');
var Step = require('step');

function MBTiles(filename, options) {
  this.filename = filename;
  this.options = options || {};
  this.db = new sqlite.Database();
}

MBTiles.prototype.setup = function(callback) {
  var that = this;
  this.open(function() {
    that.db.execute(
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

module.exports = MBTiles;
