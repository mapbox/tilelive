#!/usr/bin/env node

/**
 * Tile server using the node web framework Express (http://expressjs.com).
 */
var express = require('express'),
    Tile = require(__dirname + '/../lib/tilelive').Tile,
    path = require('path'),
    sys = require('sys'),
    fs = require('fs'),
    app = express.createServer();

var PORT = 8888;
var MAPFILE_DIR = path.join(__dirname, 'tmp');
var args = process.argv.slice(1);

try {
    fs.statSync(MAPFILE_DIR);
} catch (e) {
    sys.debug('Creating mapfile dir: ' + MAPFILE_DIR);
    fs.mkdirSync(MAPFILE_DIR, 0777);
}

app.use(express.staticProvider(__dirname + '/'));

function renderTile(res, mapfile, language, z, x, y) {
    try {
        var tile = new Tile({
            scheme: 'tms',
            datasource: mapfile,
            language: language,
            xyz: [x, y, z],
            format: 'png',
            mapfile_dir: MAPFILE_DIR
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

if (args[1]) {
    var language = (path.extname(args[1]).toLowerCase() == '.mml') ?
        'carto' :
        'xml';
    app.get('/1.0.0/map/:z/:x/:y.*', function(req, res) {
        renderTile(res, args[1],
            language,
            req.params.z,
            req.params.x, 
            req.params.y); 
    });
} else {
    sys.err('Please provide a mapfile.');
}

sys.debug('tilelive listening on port: ' + PORT);
app.listen(PORT);
