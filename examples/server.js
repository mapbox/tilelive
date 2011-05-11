// Tile server using the node web framework Express (http://expressjs.com).
var app = require('express').createServer(),
    mapnik = require('tilelive-mapnik'),
    tilelive = new (require('tilelive').Server)(mapnik);

app.get('/:z/:x/:y.*', function(req, res) {
    var options = {
        x: req.param('x'),
        y: req.param('y'),
        z: req.param('z'),
        format: req.params[0],
        datasource: __dirname + '/stylesheet.xml'
    };
    tilelive.serve(options, function(err, data) {
        if (!err) {
            res.send.apply(res, data);
        } else {
            res.send('Tile rendering error: ' + err + '\n');
        }
    });
});

console.log('Listening on port: ' + 8888);
app.listen(8888);

