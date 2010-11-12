var app = require('server'),
    tl = require('tl');

app.get('/:scheme/:mapfile_64/:z/:x/:y.:format', function(req, res) {
    /*
     * scheme: (xyz|tms|tile (tms))
     *
     * format:
     * - Tile: (png|jpg)
     * - Data Tile: (geojson)
     * - Grid Tile: (*.grid.json)
     */
    try {
        var tile = new tl.Tile(
            req.params.scheme,
            req.params.mapfile_64,
            req.params.z,
            req.params.x,
            req.params.y,
            req.params.format);
    } catch(err) {
        res.send('Tile invalid: ' + err.message);
    }

    tile.render(function(err, data) {
        if (!err) {
            res.send.apply(data);
        } else {
            res.send('Tile rendering error: ' + err);
        }
    });
});
