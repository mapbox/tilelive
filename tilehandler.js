var app = require('server'),
    _ = require('underscore')._,
    tl = require('tl');

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
        var tile = new tl.Tile(
            req.params.scheme,
            req.params.mapfile_64,
            req.params.z,
            req.params.x,
            req.params.y,
            req.params[0]);
    } catch (err) {
        res.send('Tile invalid: ' + err.message);
    }

    tile.render(function(err, data) {
        if (!err) {
            // Using apply here allows the tile rendering
            // function to send custom heades without access
            // to the request object.
            data[1] = _.extend(app.set('settings')('header_defaults'), data[1]);
            res.send.apply(res, data);
            // res.send.apply(res, ['hello', { 'Content-Type': 'image/png' }]);
        } else {
            res.send('Tile rendering error: ' + err);
        }
    });
});
