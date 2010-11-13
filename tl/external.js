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
            '.zip':     External.unzip,
            '.geojson': External.plainfile,
            '.kml':     External.plainfile
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
        console.log([filename, '-d', External.pos(resource_url)]);
        var unzip_op = spawn('unzip', [filename, '-d', External.pos(resource_url)]);

        unzip_op.on('exit', function(code) {
            if (code > 0) {
                console.log('Unzip returned a code of %d', code);
            } else {
                fs.readdir(External.pos(resource_url), function(err, unzipped_files) {
                    console.log(unzipped_files);
                    var shpfile = External.pos(resource_url) + _.detect(unzipped_files,
                        function(f) {
                            return path.extname(f) == '.shp';
                        }
                    );
                    callback(resource_url, shpfile);
                });
            }
        });
    }
}

module.exports = External;
