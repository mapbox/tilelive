require.paths.unshift(__dirname + '/modules',
        __dirname + '/lib/node', __dirname);

var mapnik = require('./modules/mapnik.node');

mapnik.register_datasources('/usr/local/lib/mapnik2/input');
mapnik.register_fonts('/usr/local/lib/mapnik2/fonts/');

var settings = require('./settings');

/**
 * Wireframe of TileLive.js
 */

require('tilehandler.js');

var app = require('server');
app.listen(8889);
console.log('TileLive server started on port %s', app.address().port);
