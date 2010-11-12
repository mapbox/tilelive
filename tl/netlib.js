var fs = require('fs'),
    http = require('http'),
    url = require('url');

var downloadAndGet = function(filename, filename, callback) {
    var file_url = url.parse(filename);
    var c = http.createClient(file_url.port, file_url.hostname);
    var request = c.request('GET', file_url.pathname, {
        host: file_url.hostname
    });
    request.end();

    var data = '';
    var f = fs.WriteStream(filename);
    request.on('response', function(response) {
        response.on('data', function(chunk) {
            data += chunk;
            f.write(chunk);
        });
        response.on('end', function() {
            f.destroy();
            callback(null, data);
        });
        response.on('error', function(err) {
            callback(err, null);
        });
    });
};

module.exports = { downloadAndGet: downloadAndGet };
