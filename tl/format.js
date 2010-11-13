var Format = {
    /**
     * Select a format
     */
    select: function(format) {
        for (i in Format) {
            // don't consider this function
            if (Format[i].hasOwnProperty('find')) {
                if (Format[i].find) {
                    return Format[i].render;
                }
            }
        }
    },

    /**
     * Generate a PNG file and call callback
     * @param Function callback the function to call when
     *  data is rendered.
     */
    png: {
        'render': function(tile, callback) {
            // TODO: make explicitly mapnik_map call
            tile.map.mapnik_map().render(
                tile.bbox,
                function(image) {
                    callback(null, [
                        image, {
                            'Content-Type': 'image/png'
                        }, 204]);
                }
            );
        },
        'find': /png/
    },

    jpg: function(callback) { },

    grid: function(callback) { },

    geojson: function(callback) { }
}

module.exports = Format;
