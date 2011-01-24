/**
 * Tile server using the node web framework Express (http://expressjs.com).
 */
var express = require('express'),
    Tile = require('tilelive').Tile,
    app = express.createServer();

app.get('/:scheme/:mapfile_64/:z/:x/:y.*', function(req, res) {
    /*
     * scheme: (xyz|tms|tile (tms))
     *
     * format:
     * - Tile: (png|jpg)
     * - Data Tile: (geojson)
     * - Grid Tile: (*.grid.json)
     */
    try {
        var tile = new Tile({
            scheme: req.params.scheme,
            mapfile: req.params.mapfile_64,
            z: req.params.z,
            x: req.params.x,
            y: req.params.y,
            format: req.params[0],
            mapfile_dir: '/tmp/mapfiles'
        });
    } catch (err) {
        res.send('Tile invalid: ' + err.message);
    }

    tile.render(function(err, data) {
        if (!err) {
            res.send.apply(res, data);
        } else {
            res.send('Tile rendering error: ' + err);
        }
    });
});

console.log("Listening on port: " + 8888);
app.listen(8888);

