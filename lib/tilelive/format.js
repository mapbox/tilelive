var Format = {
    /**
     * Select a format
     *
     * @param {String} format the extension of the tile.
     * @return {Function} renderer function.
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

    png: {
        /**
         * Generate a PNG file and call callback
         *
         * @param {Object} tile tile object.
         * @param {Function} callback the function to call when
         *  data is rendered.
         */
        'render': function(tile, callback) {
            var format = tile.format === 'png8' ? 'png8' : 'png';
            tile.map.mapnik_map_acquire(function(err, map) {
                if (err) return callback(err);
                map.zoom_to_box(tile.bbox);
                try {
                    map.render(map.extent(), format, function(err, buffer) {
                        if (err) callback(err, null);
                        tile.map.mapnik_map_release(map);
                        callback(null, [
                            buffer,
                            {'Content-Type': 'image/png'}
                        ]);
                    });
                } catch (e) {
                    console.log(e);
                }
            });
        },
        'find': /png/
    },

    pdf: {
        /**
         * Generate a PDF file and call callback
         *
         * @param {Object} tile tile object.
         * @param {Function} callback the function to call when
         *  data is rendered.
         */
        'render': function(tile, callback) {
            tile.map.mapnik_map_acquire(function(err, map) {
                if (err) return callback(err);

                var path = require('path');
                var fs = require('fs');
                var hash = 'pdf-'
                    + require('crypto').createHash('md5')
                        .update(+new Date).digest('hex').substring(0, 6)
                    + '.pdf';
                var filepath = path.join(tile.map.mapfile_dir, hash);

                // @TODO: blocking call. Update when node-mapnik supports async
                // rendering of PDF.
                map.zoom_to_box(tile.bbox);
                map.render_to_file(filepath, {format: 'pdf'});
                tile.map.mapnik_map_release(map);
                fs.readFile(filepath, 'binary', function(err, buffer) {
                    fs.unlink(filepath, function(err) {
                        callback(null, [
                            buffer,
                            {'Content-Type': 'application/pdf'}
                        ]);
                    });
                });
            });
        },
        'find': /pdf/
    },

    jpg: {
        /**
         * Generate a JPG file and call callback
         *
         * @param {Object} tile tile object.
         * @param {Function} callback the function to call when
         *  data is rendered.
         */
        'render': function(tile, callback) {
            var format = tile.format.match(/(jpg|jpeg)[\d]{0,2}/)
                ? tile.format.replace('jpg', 'jpeg')
                : 'jpeg';
            tile.map.mapnik_map_acquire(function(err, map) {
                if (err) return callback(err);
                map.zoom_to_box(tile.bbox);
                try {
                    map.render(map.extent(), format, function(err, buffer) {
                        if (err) callback(err, null);
                        tile.map.mapnik_map_release(map);
                        callback(null, [
                            buffer,
                            {'Content-Type': 'image/jpeg'}
                        ]);
                    });
                } catch (e) {
                    console.log(e);
                }
            });
        },
        'find': /jpg|jpeg/
    },

    grid: {
        /**
         * Generate a grid file and call callback
         *
         * @param {Object} tile tile object.
         * @param {Function} callback the function to call when
         *  data is rendered.
         */
        'render': function(tile, callback) {
            tile.map.mapnik_map_acquire(function(err, map) {
                if (err) return callback(err);
                map.zoom_to_box(tile.bbox);
                map.generate_hit_grid(tile.format_options.layer, 4, tile.format_options.key_name);
                console.log('done')
                try {
                    callback(null, [
                        map.generate_hit_grid(tile.format_options.layer, 4, tile.format_options.key_name),
                        {'Content-Type': 'text/javascript'}]);
                    tile.map.mapnik_map_release(map);
                } catch (e) {
                    console.log(e);
                }
            });
        },
        'find': /grid\.json/
    },

    geojson: {
        'render': function(callback) { },
        'find': /geojson/
    }
};

module.exports = Format;
