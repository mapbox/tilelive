module.exports = Tile;
function Tile(z, x, y, key) {
    this.z = z;
    this.x = x;
    this.y = y;
    this.key = key || false;
}

Tile.fromArray = function(coords) {
    return new Tile(coords[0], coords[1], coords[2], coords[3]);
};

Tile.prototype.toJSON = function() {
    return this.z + '/' + this.x + '/' + this.y + '/' + this.key;
};

Tile.prototype.children = function() {
    return [
        new Tile(this.z+1, this.x*2, this.y*2, this.key),
        new Tile(this.z+1, this.x*2+1, this.y*2, this.key),
        new Tile(this.z+1, this.x*2, this.y*2+1, this.key),
        new Tile(this.z+1, this.x*2+1, this.y*2+1, this.key)
    ];
};

Tile.prototype.descendantCount = function(bounds) {
    var sum = 0;
    var size = 1;

    for (var x = this.x, y = this.y, z = this.z + 1; bounds[z]; z++) {
        x *= 2; y *= 2; size *= 2;
        var width = Math.min(bounds[z].maxX, x + size - 1) - Math.max(bounds[z].minX, x) + 1;
        var height = Math.min(bounds[z].maxY, y + size - 1) - Math.max(bounds[z].minY, y) + 1;
        sum += width * height;
    }
    return sum;
};
