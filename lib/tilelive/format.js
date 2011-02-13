var Buffer = require('buffer').Buffer;

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
                try {
                    var resolution = 4;

                    // TODO: When updating to node 0.4.x, this function should
                    // return a buffer directly, but as the Buffer api changes
                    // dramatically from 0.2 to 0.4, this returns JSON atm.
                    var json = map.generate_hit_grid(
                        parseInt(tile.format_options.layer, 10),
                        resolution,
                        tile.format_options.key_name
                    );

                    // We need to manually stringify the JSON as we don't want
                    // UTF-8 characters to be escaped by the default behavior.
                    var keys = new Buffer(JSON.stringify(json.keys), 'utf8');
                    var grid = new Buffer(json.grid, 'utf8');

                    // If caller has included response object, send buffer
                    // immediately.
                    if (tile.format_options.res) {
                        var req = tile.format_options.req;
                        var res = tile.format_options.res;

                        // Start response.
                        res.writeHead(200, {
                            'Content-Type': 'text/javascript; charset=utf-8'
                        });
                        // Manually wrap the JSON in JSONp in order to
                        // avoid re-encoding the UTF-8 in griddata
                        req.query.callback && res.write(req.query.callback + '({"grid":');
                        res.write('{"grid":');
                        res.write(grid);
                        res.write(',"keys":');
                        res.write(keys);
                        res.write('}');
                        req.query.callback && res.write('});');
                        res.end();
                        callback(null);
                    } else {
                        var length = keys.length +
                                     grid.length +
                                     '{"grid":,"keys":}'.length;
                        var buffer = Buffer(length, 'utf8');
                        var index = buffer.write('{"grid":', 0, 'utf8');
                        grid.copy(buffer, index, 0);
                        index += grid.length;
                        index += buffer.write(',"keys":', index, 'utf8');
                        keys.copy(buffer, index, 0);
                        index += keys.length;
                        index += buffer.write('}', index, 'utf8');
                        callback(null, [buffer,
                            {'Content-Type': 'text/javascript; charset=utf-8'},
                            { keys: json.keys }]);
                    }
                    tile.map.mapnik_map_release(map);
                } catch(err) {
                    callback(err);
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
