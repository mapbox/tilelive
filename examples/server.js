// Tile server using the node web framework Express (http://expressjs.com).
var express = require("express"),
    app = express(),
    tilelive = require('tilelive');

require('tilelive-mapnik').registerProtocols(tilelive);

var filename = __dirname + '/stylesheet.xml';

tilelive.load('mapnik://' + filename, function(err, source) {
    if (err) throw err;
    app.get('/:z/:x/:y.*', function(req, res) {
        source.getTile(req.param('z'), req.param('x'), req.param('y'), function(err, tile, headers) {
            // `err` is an error object when generation failed, otherwise null.
            // `tile` contains the compressed image file as a Buffer
            // `headers` is a hash with HTTP headers for the image.
            if (!err) {
                res.send(tile);
            } else {
                res.send('Tile rendering error: ' + err + '\n');
            }
        });
    });
});

console.log('Listening on port: ' + 8888);
app.listen(8888);

