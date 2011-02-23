// Mapnik tile formats. Each format should provide a `render()` method and a
// regex at `find` that can be used to select the format for use with a given
// tile request. `render(tile, map, callback)` takes the following arguments:
//
// - `tile` an instance of the `Tile` class representing the single tile to be
//   rendered.
// - `map` an instantiated `node-mapnik` `Map` object. Will have the map XML
//   for the given tile request already loaded.
// - `callback` callback function to call once rendering is complete.
var Buffer = require('buffer').Buffer;

var Format = {
    // Select a format. Returns the renderer function of the matching format.
    // - `format` {String} format the extension of the tile request
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

    // PNG format.
    png: {
        'render': function(tile, map, callback) {
            var format = (tile.format === 'png8') ? 'png8' : 'png';
            map.zoom_to_box(tile.bbox);
            try {
                map.render(map.extent(), format, function(err, buffer) {
                    if (err) return callback(err, null);
                    callback(null, [
                        buffer,
                        {'Content-Type': 'image/png'}
                    ]);
                });
            } catch (e) {
                console.log(e);
            }
        },
        'find': /png/
    },

    // PDF format. Renders PDF to disk and then reads the file back into a
    // buffer to pass to the callback. @TODO:
    // - uses `map.render_to_file()` which is a blocking call. Update to async
    //   once supported by `node-mapnik`.
    // - skip writing to disk once possible to render to string in
    //   `node-mapnik`.
    pdf: {
        'render': function(tile, map, callback) {
            var path = require('path');
            var fs = require('fs');
            var date = +new Date();
            var hash = 'pdf-' + date + '.pdf';
            var filepath = path.join('/tmp', hash);

            map.zoom_to_box(tile.bbox);
            map.render_to_file(filepath, {
                format: 'pdf'
            });
            fs.readFile(filepath, 'binary', function(err, buffer) {
                fs.unlink(filepath, function(err) {
                    callback(null, [
                        buffer,
                        {'Content-Type': 'application/pdf'}
                    ]);
                });
            });
        },
        'find': /pdf/
    },

    // JPEG format.
    jpg: {
        'render': function(tile, map, callback) {
            var format = tile.format.match(/(jpg|jpeg)[\d]{0,2}/)
                ? tile.format.replace('jpg', 'jpeg')
                : 'jpeg';
            map.zoom_to_box(tile.bbox);
            try {
                map.render(map.extent(), format, function(err, buffer) {
                    if (err) return callback(err, null);
                    callback(null, [
                        buffer, {
                            'Content-Type': 'image/jpeg'
                        }
                    ]);
                });
            } catch (e) {
                console.log(e);
            }
        },
        'find': /jpg|jpeg/
    },

    // UTF8-grid format.
    grid: {
        'render': function(tile, map, callback) {
            map.zoom_to_box(tile.bbox);
            try {
                var resolution = 4;

                // TODO: When updating to node 0.4.x, this function should
                // return a buffer directly, but as the Buffer api changes
                // dramatically from 0.2 to 0.4, this returns JSON atm.
                var json = map._render_grid(
                    tile.format_options.layer,
                    resolution,
                    tile.format_options.key_name,
                    Boolean(tile.format_options.data),
                    function (err, json) {
                        // We need to manually stringify the JSON as we don't want
                        // UTF-8 characters to be escaped by the default behavior.
                        var keys = new Buffer(JSON.stringify(json.keys), 'utf8');
                        var grid = new Buffer(json.grid, 'utf8');

                        var length = keys.length +
                                     grid.length +
                                     '{"grid":,"keys":}'.length;

                        if (tile.format_options.data) {
                            var data = new Buffer(JSON.stringify(json.data), 'utf8');
                            length = length + data.length + ',"data":'.length;
                        }

                        var buffer = Buffer(length, 'utf8');
                        var index = buffer.write('{"grid":', 0, 'utf8');
                        grid.copy(buffer, index, 0);
                        index += grid.length;
                        index += buffer.write(',"keys":', index, 'utf8');
                        keys.copy(buffer, index, 0);
                        index += keys.length;

                        if (tile.format_options.data) {
                            index += buffer.write(',"data":', index, 'utf8');
                            data.copy(buffer, index, 0);
                            index += data.length;
                        }

                        index += buffer.write('}', index, 'utf8');
                        callback(null, [
                            buffer,
                            { 'Content-Type': 'text/javascript; charset=utf-8' },
                            { keys: json.keys }
                        ]);
                });
            } catch (err) {
                callback(err);
            }
        },
        'find': /grid\.json/
    }
};

module.exports = Format;
