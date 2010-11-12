var fs = require('fs'),
    http = require('http'),
    url = require('url');

var downloadAndGet = function(file_url, filename, callback) {
    var file_url = url.parse(file_url);
    var c = http.createClient(file_url.port || 80, file_url.hostname);
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

var safe64 = function(s) {
    var b = new Buffer(s, 'utf-8');
    return b.toString('base64');
}

module.exports = {
    downloadAndGet: downloadAndGet,
    safe64: safe64
};
