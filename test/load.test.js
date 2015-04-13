var test = require('tape');
var assert = require('assert');
var tilelive = require('../');
tilelive.protocols['mbtiles:'] = require('mbtiles');
tilelive.protocols['tilejson:'] = require('tilejson');

var data = [ 
    { 
        bounds: [ -180, -85, 180, 85 ], 
        center: [ 0, 0, 2 ], 
        description: '', 
        id: 'mapquest', 
        legend: null, 
        maxzoom: 18, 
        minzoom: 0, 
        name: 'MapQuest Open', 
        scheme: 'tms', 
        tiles: [ 'http://otile1.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.jpg' ], 
        version: '1.0.0' 
    }, 
    { 
        basename: 'faulty.mbtiles', 
        bounds: [ -180, -100, 180, 100 ], 
        center: null, 
        description: '', 
        filesize: 16384, 
        id: 'faulty', 
        legend: null, 
        maxzoom: 22, 
        minzoom: 0, 
        name: '', 
        scheme: 'tms', 
        version: '1.0.0' 
    }, 
    { 
        basename: 'null-tile.mbtiles', 
        bounds: [ -179.9999999749438, -69.99999999526695, 179.9999999749438, 84.99999999782301 ], 
        center: [ 0, 7.500000001278025, 1 ], 
        description: 'demo description', 
        filesize: 561152, 
        formatter: null, 
        id: 'null-tile', 
        legend: null, 
        level1: { level2: 'property' }, 
        maxzoom: 1, 
        minzoom: 1, 
        name: 'plain_1', 
        scheme: 'tms', 
        type: 'baselayer', 
        version: '1.0.3' 
    }, 
    { 
        basename: 'plain_1.mbtiles', 
        bounds: [ -179.9999999749438, -69.99999999526695, 179.9999999749438, 84.99999999782301 ], 
        center: [ 0, 7.500000001278025, 2 ], 
        description: 'demo description', 
        filesize: 561152, 
        formatter: null, 
        id: 'plain_1', 
        legend: null, 
        maxzoom: 4, 
        minzoom: 0, 
        name: 'plain_1', 
        scheme: 'tms', 
        type: 'baselayer', 
        version: '1.0.3' 
    }, 
    { 
        basename: 'plain_2.mbtiles', 
        bounds: [ -179.9999999749438, -69.99999999526695, 179.9999999749438, 79.99999999662558 ], 
        center: [ 0, 5.0000000006793215, 2 ], 
        description: '', 
        filesize: 874496, 
        formatter: 'function(options, data) { if (options.format === \'full\') { return \'\' + data.NAME + \' (Population: \' + data.POP2005 + \')\'; } else { return \'\' + data.NAME + \'\'; } }', 
        id: 'plain_2', 
        legend: null, 
        maxzoom: 4, 
        minzoom: 0, 
        name: 'plain_2', 
        scheme: 'tms', 
        type: 'baselayer', 
        version: '1.0.0' 
    }, 
    { 
        basename: 'plain_4.mbtiles', 
        bounds: [ -179.9999999749438, -69.99999999526695, 179.9999999749438, 79.99999999662558 ], 
        center: [ 0, 5.0000000006793215, 2 ], 
        description: '', 
        filesize: 684032, 
        formatter: 'function(options, data) { if (options.format === \'full\') { return \'\' + data.NAME + \' (Population: \' + data.POP2005 + \')\'; } else { return \'\' + data.NAME + \'\'; } }', 
        id: 'plain_4', 
        legend: null, 
        maxzoom: 4, 
        minzoom: 0, 
        name: 'plain_2', 
        scheme: 'tms', 
        type: 'baselayer', 
        version: '1.0.0' 
    }, 
    { 
        basename: 'resume.mbtiles', 
        bounds: [ -180, -85.05112877980659, 180, 85.05112877980659 ], 
        center: null, 
        description: '', 
        filesize: 16384, 
        id: 'resume', 
        legend: null, 
        maxzoom: 22, 
        minzoom: 0, 
        name: '', 
        scheme: 'tms', 
        version: '1.0.0' 
    } 
];

test('loading: should refuse loading an invalid url', function(t) {
    tilelive.load('http://foo/bar', function(err) {
        t.ok(err);
        t.equal(err.message, 'Invalid tilesource protocol: http:');
        t.end();
    });
});

test('loading: should load an existing mbtiles file', function(t) {
    tilelive.load('mbtiles://' + __dirname + '/fixtures/plain_2.mbtiles', function(err, source) {
        if (err) throw err;
        t.equal(typeof source.getTile, 'function');
        t.equal(typeof source.getGrid, 'function');
        t.equal(typeof source.getInfo, 'function');
        source.close(t.end);
    });
});

test('loading: should load metadata about an existing mbtiles file', function(t) {
    tilelive.info('mbtiles://' + __dirname + '/fixtures/plain_2.mbtiles', function(err, info, handler) {
        if (err) throw err;
        t.deepEqual(info, data[4]);
        handler.close(t.end);
    });
});

test('loading: should load metadata from an existing tilejson file', function(t) {
    tilelive.info('tilejson://' + __dirname + '/fixtures/mapquest.tilejson', function(err, info, handler) {
        if (err) throw err;
        t.deepEqual(info, data[0]);
        handler.close(t.end);
    });
});

test('loading: should load mbtiles file from a path containing a space', function(t) {
    tilelive.info('mbtiles://' + __dirname + '/fixtures/path with space/plain_1.mbtiles', function(err, info, handler) {
        if (err) throw err;
        t.deepEqual(info, data[3]);
        handler.close(t.end);
    });
});


test('loading: should load all tile sources in a directory', function(t) {
    tilelive.all(__dirname + '/fixtures', function(err, info, handlers) {
        if (err) throw err;

        // Sort tilesets before deepEqual.
        info.sort(function(a, b) {
            return (a.basename || '0') < (b.basename || '0') ? -1 : 1;
        });

        t.deepEqual(data, info);

        var doit = function(err) {
            t.ifError(err);
            if (!handlers.length) return t.end();
            handlers.shift().close(doit);
        };
        doit();
    });

});
