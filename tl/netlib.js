var fs = require('fs'),
    http = require('http'),
    url = require('url');

module.exports = {
    downloadAndGet: function(file_url, filename, callback) {
        var file_url = url.parse(file_url);
        var c = http.createClient(file_url.port || 80, file_url.hostname);
        var request = c.request('GET', file_url.pathname, {
            host: file_url.hostname
        });
        request.end();

        var data = '';
        var f = fs.createWriteStream(filename);
        request.on('response', function(response) {
            response.on('data', function(chunk) {
                data += chunk;
                f.write(chunk);
            });
            response.on('end', function() {
                f.destroy();
                callback(null, filename, data);
            });
            response.on('error', function(err) {
                console.log('error downloading file');
                callback(err, null);
            });
        });
    },

    get: function(file_url, filename, callback) {
        var file_url = url.parse(file_url);
        var c = http.createClient(file_url.port || 80, file_url.hostname);
        var request = c.request('GET', file_url.pathname, {
            host: file_url.hostname
        });
        request.end();

        var data = '';
        request.on('response', function(response) {
            response.on('data', function(chunk) {
                data += chunk;
            });
            response.on('end', function() {
                callback(null, filename, data);
            });
            response.on('error', function(err) {
                console.log('error downloading file');
                callback(err, null);
            });
        });
    },

    download: function(file_url_raw, filename, callback) {
        var file_url = url.parse(file_url_raw);
        var c = http.createClient(file_url.port || 80, file_url.hostname);
        var request = c.request('GET', file_url.pathname, {
            host: file_url.hostname
        });
        request.end();

        console.log('downloading: %s', file_url.hostname);
        var f = fs.createWriteStream(filename);
        request.on('response', function(response) {
            response.on('data', function(chunk) {
                f.write(chunk);
            });
            response.on('end', function() {
                f.destroy();
                console.log('download finished');
                callback(null, file_url_raw, filename);
            });
            response.on('error', function(err) {
                console.log('error downloading file');
                callback(err, null);
            });
        });
    },

    safe64: function(s) {
        var b = new Buffer(s, 'utf-8');
        return b.toString('base64');
    }
};
