var sqlite = require('sqlite');
var Step = require('step');

function MBTiles(filename, options) {
  this.filename = filename;
  this.options = options || {};
  this.db = new sqlite.Database();
}

MBTiles.prototype.setup = function(callback) {
    var that = this;
    this.db.open(this.filename, function(err) {
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
            + '("name");',
            function(err) {
                that.db.finalizeAndClose(); // is this blocking?
                callback(err);
            }
        );
    });
};

MBTiles.prototype.insertTile =  function(tile, x, y, z, callback) {
    var that = this;
    this.db.open(this.filename, function(err) {
        console.log('... Inserting tile at [%s, %s, %s]', z, x, y);
        that.db.execute(
            'INSERT INTO tiles ('
            + 'tile_data, '
            + 'zoom_level, '
            + 'tile_column, '
            + 'tile_row) '
            + 'VALUES (?, ?, ?, ?);',
            [tile, z, x, y],
            function(err) {
                that.db.finalizeAndClose();
                callback(err);
            }
        );
    });
};

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

module.exports = MBTiles;
