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

var thisFile = fs.readFileSync(__filename, 'utf8');
var lines = thisFile.split('\n');
var l = '',
    template = [],
    i = lines.length - 3;

while (l !== '/*' && i > 0) {
    template.unshift(l);
    l = lines[i--];
}

app.get('/', function(req, res) {
    res.send(template.join('\n'));
});



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
    sys.error('Please provide a mapfile.');
}

sys.debug('tilelive listening on port: ' + PORT);
app.listen(PORT);

/*
<html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <title>Test Map</title>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    <style type="text/css">
      html, body { height: 100%; }
      body {margin: 0px;}
      #map {
        width: 100%;
        height: 100%;
        background: url('checker-bg.png');
      }
      .olImageLoadError {
        background: transparent;
      }
    </style>
    <script src="js/OpenLayers.js"></script>
    <script type="text/javascript">
    function init() {
        OpenLayers.ImgPath = 'http://js.mapbox.com/theme/dark/';
        OpenLayers.theme = 'http://js.mapbox.com/theme/dark/dark.css';
        var map = new OpenLayers.Map('map', {
            projection: new OpenLayers.Projection("EPSG:900913"),
            displayProjection: new OpenLayers.Projection("EPSG:4326"),
            units: "m",
            numZoomLevels: 18,
            maxResolution: 156543.0339,
            maxExtent: new OpenLayers.Bounds(
              -20037500,
              -20037500,
              20037500,
              20037500
            ),
        });
        map.addLayers([
            new OpenLayers.Layer.TMS(
                'TileLive Map',
                'http://localhost:8888/',
                {
                    sphericalMercator: true,
                    layername: 'map',
                    type: 'png'
                })])
        map.zoomTo(1);
    }
    </script>
  </head>
  <body onload="init()">
    <div id="map">
    </div>
  </body>
</html>
*/
