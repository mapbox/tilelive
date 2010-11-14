// Lib for dealing with nasty externals

var fs = require('fs'),
    netlib = require('./netlib'),
    url = require('url'),
    path = require('path'),
    _ = require('underscore')._,
    spawn = require('child_process').spawn,
    app = require('server');

var External = {
    /**
     * Download and process a file, returning a filesystem path
     * of the required resource for Mapnik
     */
    processors: function(key) {
        return {
            '.zip': External.unzip,
            '.geojson': External.plainfile,
            '.kml': External.plainfile
        }[key];
    },

    pos: function(ext) {
        return app.set('settings')('data_dir') + '/' + netlib.safe64(ext);
    },

    tmppos: function(ext) {
        return app.set('settings')('data_dir') + '/' + require('crypto').createHash('md5').update(ext).digest('hex');
    },

    process: function(resource_url, callback) {
        console.log('process called');

        // TODO: handle no-format urls, read mime, etc
        var file_format = path.extname(resource_url);
        netlib.download(resource_url, External.tmppos(resource_url), function(err, url, filename) {
            console.log('downloaded resource');
            if (External.processors(file_format)) {
                External.processors(file_format)(filename, resource_url, callback);
            } else {
                console.log('no processor found for %s', file_format);
            }
        });

    },

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
                    console.log('recursing into %d dirs', dirs.length);
                    for (var i = 0, l = dirs.length; i < l; i++) {
                        var located = locateShp(dir + '/' + dirs[i]);
                        if (located) {
                            return located;
                        }
                    }
                }
            }
            else {
                console.log('returning %s', shp);
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
