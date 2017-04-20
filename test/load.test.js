var test = require('tape');
var assert = require('assert');
var tilelive = require('../');
tilelive.protocols['mbtiles:'] = require('@mapbox/mbtiles');
tilelive.protocols['tilejson:'] = require('@mapbox/tilejson');

var data = [
    {
        name: 'MapQuest Open',
        scheme: 'xyz',
        tiles: [ 'http://otile1.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.jpg' ],
        minzoom: 0,
        maxzoom: 18,
        bounds: [ -180, -85, 180, 85 ],
        center: [ 0, 0, 2 ],
        id: 'mapquest',
        description: '',
        version: '1.0.0',
        legend: null
    },
    {
        basename: 'empty.mbtiles',
        bounds: [ -180, -85.05112877980659, 180, 85.05112877980659 ],
        center: [ 0, 0, 1 ],
        description: '',
        filesize: 7168,
        id: 'empty',
        legend: '<div id=\'legend-debt\'>\n  Total US foreign held debt:<br>\n  <strong style="font-size: 18px; font-weight: bold; line-height: 1">$4.45 trillion</strong><br>\n<span style="font-size: 10px">\nSource: <a href=\'http://www.washingtonpost.com/wp-srv/special/business/foreign-held-us-debt/\' target=\'_blank\'>The Washington Post, 2011</a>\n</span>\n</div>',
        maxzoom: 1,
        minzoom: 1,
        name: 'US Debt Held By Foreign Nations',
        scheme: 'tms',
        spec: '1.2',
        template: '{{#__teaser__}}{{Country}}{{/__teaser__}}',
        version: '1.0.0'
    },
    {
        scheme: 'tms',
        basename: 'faulty.mbtiles',
        id: 'faulty',
        filesize: 16384,
        bounds: [ -180, -100, 180, 100 ],
        name: '',
        description: '',
        version: '1.0.0',
        legend: null,
        minzoom: 0,
        maxzoom: 30,
        center: null
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
        scheme: 'tms',
        basename: 'plain_1.mbtiles',
        id: 'plain_1',
        filesize: 561152,
        name: 'plain_1',
        type: 'baselayer',
        description: 'demo description',
        version: '1.0.3',
        formatter: null,
        bounds:
         [ -179.9999999749438,
           -69.99999999526695,
           179.9999999749438,
           84.99999999782301 ],
        minzoom: 0,
        maxzoom: 4,
        center: [ 0, 7.500000001278025, 2 ],
        legend: null
    },
    {
        scheme: 'tms',
        basename: 'plain_2.mbtiles',
        id: 'plain_2',
        filesize: 874496,
        name: 'plain_2',
        type: 'baselayer',
        description: '',
        version: '1.0.0',
        formatter: 'function(options, data) { if (options.format === \'full\') { return \'\' + data.NAME + \' (Population: \' + data.POP2005 + \')\'; } else { return \'\' + data.NAME + \'\'; } }',
        bounds:
         [ -179.9999999749438,
           -69.99999999526695,
           179.9999999749438,
           79.99999999662558 ],
        minzoom: 0,
        maxzoom: 4,
        center: [ 0, 5.0000000006793215, 2 ],
        legend: null
    },
    {
        scheme: 'tms',
        basename: 'plain_4.mbtiles',
        id: 'plain_4',
        filesize: 684032,
        name: 'plain_2',
        type: 'baselayer',
        description: '',
        version: '1.0.0',
        formatter: 'function(options, data) { if (options.format === \'full\') { return \'\' + data.NAME + \' (Population: \' + data.POP2005 + \')\'; } else { return \'\' + data.NAME + \'\'; } }',
        bounds:
         [ -179.9999999749438,
           -69.99999999526695,
           179.9999999749438,
           79.99999999662558 ],
        minzoom: 0,
        maxzoom: 4,
        center: [ 0, 5.0000000006793215, 2 ],
        legend: null
    },
    {
        scheme: 'tms',
        basename: 'resume.mbtiles',
        id: 'resume',
        filesize: 16384,
        name: '',
        description: '',
        version: '1.0.0',
        legend: null,
        minzoom: 0,
        maxzoom: 30,
        bounds: [ -180, -85.05112877980659, 180, 85.05112877980659 ],
        center: null
    }
];

test('loading: url without pathname', function(t) {
    // Create a dummy protocol handler
    tilelive.protocols['nopathname:'] = function NoPathNameSource(uri, callback) {
        this.search = uri.search;
        callback(undefined, this);
    };
    var searchStr = '?test=1';
    tilelive.load('nopathname://' + searchStr, function(err, source) {
        if (err) throw err;
        t.equal(source.search, searchStr);
        delete tilelive.protocols['nopathname:'];
        t.end();
    });
});

test('loading: no callback no fun', function(t) {
    t.throws(function() {
        tilelive.load('http://foo/bar');
    });
    t.end();
});

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
        t.deepEqual(info, data[5]);
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
        t.deepEqual(info, data[4]);
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
