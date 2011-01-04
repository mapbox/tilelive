/**
 * Tile server using the node web framework Express (http://expressjs.com).
 */
var express = require('express'),
    Tile = require('tilelive.js').Tile,
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
        var tile = new Tile(
            req.params.scheme,
            req.params.mapfile_64,
            req.params.z,
            req.params.x,
            req.params.y,
            req.params[0],
            '/tmp/mapfiles');
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

app.listen(8888);

