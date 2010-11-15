var fs = require('fs'),
    netlib = require('./netlib'),
    url = require('url'),
    path = require('path'),
    _ = require('underscore')._,
    spawn = require('child_process').spawn,
    app = require('server');

var External = {
    /**
     * Get a processor, given a file's extension
     * @param String extension the file's extension.
     * @return Function processor function.
     */
    processors: function(extension) {
        return {
            '.zip': External.unzip,
            '.geojson': External.plainfile,
            '.kml': External.plainfile
        }[extension];
    },

    /**
     * Get the final resting position of an external's directory
     * @param ext name of the external.
     * @return file path.
     */
    pos: function(ext) {
        return app.set('settings')('data_dir') + '/' + netlib.safe64(ext);
    },

    /**
     * Get the temporary path of an external before processing
     * @param ext filename of the external.
     * @return file path.
     */
    tmppos: function(ext) {
        return app.set('settings')('data_dir') + '/' + require('crypto')
            .createHash('md5').update(ext).digest('hex');
    },

    plainname: function(resource_url) {
        return require('crypto')
            .createHash('md5').update(resource_url).digest('hex') +
            path.extname(resource_url);

    }

    /**
     * Download an external, process it, and return the usable filepath for
     * Mapnik
     * @param String resource_url the URI of the datasource from a mapfile.
     * @param Function callback passed into processor function after localizing.
     */
    process: function(resource_url, callback) {
        var file_format = path.extname(resource_url);
        netlib.download(resource_url, External.tmppos(resource_url), function(err, url, filename) {
            if (External.processors(file_format)) {
                External.processors(file_format)(filename, resource_url, callback);
            } else {
                console.log('no processor found for %s', file_format);
            }
        });

    },

    /**
     * Deal with a plain file, which is likely to be 
     * GeoJSON, KML, or one of the other OGR-supported formats, 
     * returning a Mapnik-usable filename
     * 
     * @param String filename the place of the file on your system
     * @param String resource_url
     * @param Function callback
     */
    plainfile: function(filename, resource_url, callback) {
        // TODO: possibly decide upon default extension
        var extension = path.extname(resource_url);
        if (extension !== '') {
            // TODO: make sure dir doesn't exist
            var destination = External.pos(resource_url) + '/' + External.plainname(resource_url);
            fs.mkdirSync(External.pos(resource_url));
            fs.renameSync(
                filename, 
                destination);
            return destination;
        } else {
            throw Exception('Non-extended files cannot be processed');
        }
    },

    /**
     * Unzip a file and return a shapefile contained within it
     *
     * TODO: handle other files than shapefiles
     * @param String filename the place of the shapefile on your system
     * @param String resource_url
     * @param Function callback
     */
    unzip: function(filename, resource_url, callback) {
        // regrettably complex because zip library isn't written for
        // node yet.
        var locateShp = function(dir) {
            var unzipped = fs.readdirSync(dir);
            var shp = _.detect(unzipped,
                function(f) {
                    return path.extname(f) == '.shp';
                }
            );
            if (!shp) {
                var dirs = _.select(unzipped,
                    function(f) {
                        return fs.statSync(dir + '/' + f).isDirectory();
                    }
                );
                if (dirs) {
                    for (var i = 0, l = dirs.length; i < l; i++) {
                        var located = locateShp(dir + '/' + dirs[i]);
                        if (located) {
                            return located;
                        }
                    }
                }
            }
            else {
                return dir + '/' + shp;
            }
        };

        spawn('unzip', [filename, '-d', External.pos(resource_url)])
            .on('exit', function(code) {
            if (code > 0) {
                console.log('Unzip returned a code of %d', code);
            } else {
                // TODO; eliminate locality of reference
                var shpfile = '../' + locateShp(External.pos(resource_url));
                callback(null, [resource_url, shpfile]);
            }
        });
    }
};

module.exports = External;
