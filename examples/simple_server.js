/**
 * Tile server using the node web framework Express (http://expressjs.com).
 */
var express = require('express'),
    Tile = require(__dirname + '/../lib/tilelive').Tile,
    app = express.createServer();

var PORT = 8888;

var args = process.argv.slice(1);

function renderTile(res, mapfile, z, x, y) {
    try {
        var tile = new Tile({
            scheme: 'tms',
            datasource: mapfile,
            language: 'xml',
            xyz: [x, y, z],
            format: 'png',
            mapfile_dir: 'tmp/'
        });
    } catch (err) {
        res.send('Tile invalid: ' + err.message + '\n');
    }

    tile.render(function(err, data) {
        if (!err) {
            res.send.apply(res, data);
        } else {
            res.send('Tile rendering error: ' + err + '\n');
        }
    });
}

app.use(express.staticProvider(__dirname + '/'));

if (args[1]) {
    app.get('/1.0.0/map/:z/:x/:y.*', function(req, res) {
        renderTile(res, args[1],
            req.params.z,
            req.params.x, 
            req.params.y); 
    });
} else {
    console.log('Please provide a mapfile.');
}

console.log('tilelive listening on port: ' + PORT);
app.listen(PORT);
