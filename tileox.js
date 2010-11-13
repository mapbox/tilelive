#!/usr/bin/env node

// A proxy for tilelive

var sys = require('sys'), http = require('http'), url = require('url');
var apiPort = process.ARGV[2] || 8000;
var toPort = process.ARGV[3] || 8888;
var toHost = '127.0.0.1';
var cache = {};

http.createServer(function(req, res) {
    var parsedUrl = url.parse(req.url);
    var fragment = parsedUrl.pathname + (parsedUrl.search || '');

    if (cache[fragment]) {
        res.writeHead(200, cache[fragment].headers);
        res.write(cache[fragment].body);
        res.end();
    }

    var client = http.createClient(toPort, toHost);
    var request = client.request('GET', fragment, {
        Host: toHost,
        Accept: '*/*',
        'User-Agent' : 'Mozilla/5.0 (compatible; MSIE 6.0; Windows NT5.0)',
        'Accept-Language' : 'en-us',
        'Accept-Charset' : 'ISO-8859-1,utf-8;q=0.7,*;q=0.7'
    });

    request.addListener('response', function(response) {
        var body = '';
        res.writeHead(200, response.headers);
        response.setEncoding('utf8');
        response.addListener('data', function(chunk) {
            res.write(chunk);
            body += chunk;
        });
        response.addListener('end', function() {
            cache[fragment] = {
                body: body,
                headers: response.headers
            };
            return res.end();
        });
    });
    request.end();
}).listen(apiPort);

sys.puts('Server running at http://127.0.0.1:' + apiPort);
