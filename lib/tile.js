// For each zoom level, stores the sum of all tiles on lower zoom levels.
var cumulative = [];
for (var sum = 0, z = 0; z <= 22; z++) {
    cumulative[z] = sum;
    sum += (1 << z) * (1 << z);
}

exports.unserialize = function(tiles) {
    return tiles.map(function(tile) {
        if (tile.size) return Metatile.unserialize(tile);
        else return Tile.unserialize(tile);
    });
};

exports.Metatile = Metatile;
function Metatile(z, x, y, size) {
    this.z = z;
    this.x = x;
    this.y = y;

    this.size = size; // Metatile side length.
    this.members = []; // Members of the current metatile.
    this.children = []; // Tiles that could be members of of child metatiles.
}

Metatile.unserialize = function(state) {
    var metatile = new Metatile(state.z, state.x, state.y, state.size);
    metatile.members = state.members.map(function(state) {
        var tile = Tile.unserialize(state);
        tile.metatile = metatile;
        return tile;
    });
    metatile.children = exports.unserialize(state.children);
    return metatile;
};

Metatile.prototype.toJSON = function() {
    return {
        z: this.z,
        x: this.x,
        y: this.y,
        size: this.size,
        members: this.members.slice(),
        children: this.children.slice()
    };
};

Metatile.prototype.addChildrenTo = function(array) {
    if (!this.children.length) return;

    // We have up to four children.
    var tl, tr, bl, br;

    // Middle axis of the child tiles.
    var midX = this.x * 2 + this.size;
    var midY = this.y * 2 + this.size;

    // Distribute all possible children onto actual child metatiles, generating
    // them as we go.
    for (var i = 0; i < this.children.length; i++) {
        var child = this.children[i];
        if (child.x < midX) {
            // It's on the left side.
            if (child.y < midY) {
                // It's on the top left.
                if (!tl) tl = new Metatile(this.z + 1, this.x * 2, this.y * 2, this.size);
                child.metatile = tl;
                tl.members.push(child);
            } else {
                // It's on the bottom left.
                if (!bl) bl = new Metatile(this.z + 1, this.x * 2, midY, this.size);
                child.metatile = bl;
                bl.members.push(child);
            }
        } else {
            // It's on the right side.
            if (child.y < midY) {
                // It's on the top right.
                if (!tr) tr = new Metatile(this.z + 1, midX, this.y * 2, this.size);
                child.metatile = tr;
                tr.members.push(child);
            } else {
                // It's on the bottom right.
                if (!br) br = new Metatile(this.z + 1, midX, midY, this.size);
                child.metatile = br;
                br.members.push(child);
            }
        }
    }

    if (br) array.push(br);
    if (bl) array.push(bl);
    if (tr) array.push(tr);
    if (tl) array.push(tl);
};



exports.Tile = Tile;
function Tile(z, x, y, key) {
    this.z = z;
    this.x = x;
    this.y = y;
    this.key = key || false;
    this.id = cumulative[z] + x*(1<<z) + y;
}

Tile.fromArray = function(coords) {
    return new Tile(coords[0], coords[1], coords[2], coords[3]);
};

Tile.unserialize = function(state) {
    return new Tile(state.z, state.x, state.y, state.key);
};

Tile.prototype.toJSON = function() {
    return {
        z: this.z,
        x: this.x,
        y: this.y,
        key: this.key
    };
};

Tile.prototype.toString = function() {
    return this.z + '/' + this.x + '/' + this.y + (this.key !== false ? '/' + this.key : '');
};

Tile.prototype.addChildrenInBoundsTo = function(bounds, array) {
    var z = this.z + 1, x = this.x * 2, y = this.y * 2;
    if (y >= bounds.minY) {
        if (x >= bounds.minX) array.push(new Tile(z, x, y, this.key));
        if (x + 1 <= bounds.maxX) array.push(new Tile(z, x + 1, y, this.key));
    }
    if (y + 1 <= bounds.maxY) {
        if (x >= bounds.minX) array.push(new Tile(z, x, y + 1, this.key));
        if (x + 1 <= bounds.maxX) array.push(new Tile(z, x + 1, y + 1, this.key));
    }
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
