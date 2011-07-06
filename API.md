
```javascript
Tilesink.prototype.startWriting = function(callback) {
    // Opens the Tilestore in write mode.
    // Call the callback function when done.
    function callback(err) {
        // err is null when write mode could be established successfully.
        // err is an Error object otherwise.
    }

    // This function must be reentrant: Write mode may only be ended after the
    // same number of calls to .stopWriting(). Use a counter to keep track of
    // how often write mode was started.
};
```

```javascript
Tilesink.prototype.stopWriting = function(callback) {
    // Ends the write mode.
    // Call the callback function when the request was successfully completed.
    // This doesn't mean that write mode has been ended (see below).
    function callback(err) {
        // err is null when write mode could be established successfully.
        // err is an Error object otherwise.
    }

    // When caching and batch-writing tiles, they must be committed to the tile
    // store when this function is called, even when write mode is not ended.
    // This is true for grids as well.

    // This function must be reentrant: Write mode may only be ended after the
    // same number of calls to .stopWriting(). Use a counter to keep track of
    // how often write mode was started.
};
```

```javascript
Tilesink.prototype.putTile = function(z, x, y, tile, callback) {
    // Stores a tile into the data store. Parameters are in XYZ format.
    // `tile` must be a Buffer containing the compressed image.
    
    function callback(err) {
        // err is null when the write request was received successfully.
        // This doesn't mean that the tile was already written to the data store.
        // err is an Error object otherwise.
    }
    
    // Implementations may decide to cache multiple tile requests and only
    // commit them to the data store periodically to improve performance.
    // Therefore, users MUST NOT rely on this function to persist changes.
    // If you want to make sure that all changes are persisted, call
    // .stopWriting().
};
```

```javascript
Tilesink.prototype.putGrid = function(z, x, y, grid, callback) {
    // Identical to .putTile(), but grid is a JS hash containing the grid.
};
