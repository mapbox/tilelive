// Mapnik tile formats. Each format should provide a `render()` method and a
// regex at `find` that can be used to select the format for use with a given
// tile request. `render(tile, map, callback)` takes the following arguments:
//
// - `tile` an instance of the `Tile` class representing the single tile to be
//   rendered.
// - `map` an instantiated `node-mapnik` `Map` object. Will have the map XML
//   for the given tile request already loaded.
// - `callback` callback function to call once rendering is complete.
var Buffer = require('buffer').Buffer,
    path = require('path'),
    fs = require('fs');

try { var mapnik = require('mapnik'); } catch (e) {}

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
            map.render(tile.bbox, format, function(err, buffer) {
                if (err) return callback(err, null);
                callback(null, [
                    buffer,
                    {'Content-Type': 'image/png'}
                ]);
            });
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
            map.render(tile.bbox, format, function(err, buffer) {
                if (err) return callback(err, null);
                callback(null, [
                    buffer, {
                        'Content-Type': 'image/jpeg'
                    }
                ]);
            });
        },
        'find': /jpg|jpeg/
    },

    // UTF8-grid format.
    grid: {
        'render': function(tile, map, callback) {
            // node-mapnik latest defaults to
            // key:"__id__", resolution:4,fields:[]
            // but specify here for clarify and backwards compatibility
            tile.format_options = tile.format_options || {};
            tile.format_options.fields = tile.format_options.fields || [];
            tile.format_options.key = tile.format_options.key || tile.format_options.key_name || "__id__";
            tile.format_options.resolution = tile.format_options.resolution || 4;
            map.zoom_to_box(tile.bbox);
            try {
                if (mapnik.supports.grid) {
                    var json = map.render_grid(
                        tile.format_options.layer,
                        tile.format_options,
                        function (err, json) {
                            if (err) return callback(err, null);
                             callback(null, [
                                new Buffer(JSON.stringify(json), 'utf8'),
                                { 'Content-Type': 'text/javascript; charset=utf-8' },
                                { keys: json.keys }
                            ]);
                        });
                } else {
                    var resolution = 4;
                    var json = map._render_grid(
                        tile.format_options.layer,
                        tile.format_options.resolution,
                        tile.format_options.key,
                        Boolean(tile.format_options.data),
                        tile.format_options.fields,
                        function (err, json) {
                            if (err) return callback(err, null);
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
                })
            }
          } catch (err) {
              callback(err, null);
          }
        },
        'find': /grid\.json/
    }
};

module.exports = Format;
