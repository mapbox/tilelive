var Format = {
    /**
     * Select a format
     */
    select: function(format) {
        for (i in Format) {
            // don't consider this function
            if (Format[i].hasOwnProperty('find')) {
                if (format.match(Format[i].find)) {
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
            tile.map.mapnik_map().render(
                tile.bbox,
                function(image) {
                    callback(null, [
                        image, {
                            'Content-Type': 'image/png'
                        }]);
                }
            );
        },
        'find': /png/
    },

    jpg: {
        'render': function(tile, callback) {
            /*
             * TODO: mapnik driver only supports png
            tile.map.mapnik_map().render(
                tile.bbox,
                function(image) {
                    callback(null, [
                        image, {
                            'Content-Type': 'image/jpeg'
                        }]);
                }
            );
            */
        },
        'find': /(jpg|jpeg)/
    },

    grid: {
        'render': function(tile, callback) {
            tile.map.mapnik_map().zoom_to_box(tile.bbox);
            callback(null, [
                tile.map.mapnik_map().query_map_point(0, 4, 'COUNTRY_ID'), {
                    'Content-Type': 'application/json'
            }]);
        },
        'find': /json/
    },

    geojson: {
        'render': function(callback) { },
        'find': /geojson/
    }
};

module.exports = Format;
