module.exports = Tile;
function Tile(z, x, y) {
    this.z = z;
    this.x = x;
    this.y = y;
}

Tile.fromArray = function(coords) {
    return new Tile(coords[0], coords[1], coords[2]);
};

Tile.prototype.toJSON = function() {
    return this.z + '/' + this.x + '/' + this.y;
};
