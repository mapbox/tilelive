var assert = require('assert');

var tilelive = require('..');
tilelive.protocols['mbtiles:'] = require('mbtiles');
tilelive.protocols['tilejson:'] = require('tilejson');

exports['test loading invalid url'] = function(beforeExit) {
    var completed = false;

    tilelive.load('http://foo/bar', function(err, source) {
        completed = true;
        assert.ok(err);
        assert.equal(err.message, 'Invalid tilesource protocol');
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};

exports['test loading url'] = function(beforeExit) {
    var completed = false;

    tilelive.load('mbtiles://' + __dirname + '/fixtures/plain_2.mbtiles', function(err, source) {
        completed = true;
        if (err) throw err;
        assert.equal(typeof source.getTile, 'function');
        assert.equal(typeof source.getGrid, 'function');
        assert.equal(typeof source.getInfo, 'function');
        source._close();
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};

exports['test loading metadata'] = function(beforeExit) {
    var completed = false;

    tilelive.info('mbtiles://' + __dirname + '/fixtures/plain_2.mbtiles', function(err, info, handler) {
        completed = true;
        if (err) throw err;
        assert.deepEqual(info, { filesize: 874496,
              scheme: 'tms',
              basename: 'plain_2.mbtiles',
              id: 'plain_2',
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
        });
        handler._close();
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};

exports['test loading metadata'] = function(beforeExit) {
    var completed = false;

    tilelive.info('tilejson://' + __dirname + '/fixtures/mapquest.tilejson', function(err, info, handler) {
        completed = true;
        if (err) throw err;
        assert.deepEqual(info, {
            id: 'mapquest',
            name: 'MapQuest Open',
            description: '',
            version: '1.0.0',
            bounds: [ -180, -85, 180, 85 ],
            minzoom: 0,
            maxzoom: 18,
            center: [ 0, 0, 2 ],
            legend: null,
            scheme: 'tms',
            tiles: [ 'http://otile1.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.jpg' ]
        });
        handler._close();
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};

exports['test loading all'] = function(beforeExit) {
    var completed = false;

    tilelive.all('test/fixtures', function(err, info, handlers) {
        completed = true;
        if (err) throw err;

        // Sort tilesets before deepEqual.
        info.sort(function(a, b) {
            return (a.basename || '0') < (b.basename || '0') ? -1 : 1;
        });
        data = [{
            name: 'MapQuest Open',
            scheme: 'tms',
            tiles: [ 'http://otile1.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.jpg' ],
            minzoom: 0,
            maxzoom: 18,
            bounds: [ -180, -85, 180, 85 ],
            center: [ 0, 0, 2 ],
            id: 'mapquest',
            description: '',
            version: '1.0.0',
            legend: null 
        },{ filesize: 561152,
            scheme: 'tms',
            basename: 'plain_1.mbtiles',
            id: 'plain_1',
            name: 'plain_1',
            type: 'baselayer',
            description: 'demo description',
            version: '1.0.3',
            formatter: null,
            minzoom: 0,
            maxzoom: 4,
            legend: null
        },{ filesize: 874496,
            scheme: 'tms',
            basename: 'plain_2.mbtiles',
            id: 'plain_2',
            name: 'plain_2',
            type: 'baselayer',
            description: '',
            version: '1.0.0',
            formatter: 'function(options, data) { if (options.format === \'full\') { return \'\' + data.NAME + \' (Population: \' + data.POP2005 + \')\'; } else { return \'\' + data.NAME + \'\'; } }',
            minzoom: 0,
            maxzoom: 4,
            legend: null
        },{ filesize: 684032,
            scheme: 'tms',
            basename: 'plain_4.mbtiles',
            id: 'plain_4',
            name: 'plain_2',
            type: 'baselayer',
            description: '',
            version: '1.0.0',
            formatter: 'function(options, data) { if (options.format === \'full\') { return \'\' + data.NAME + \' (Population: \' + data.POP2005 + \')\'; } else { return \'\' + data.NAME + \'\'; } }',
            minzoom: 0,
            maxzoom: 4,
            legend: null
        }];

        for (i = 0; i < data.length; i++) {
            for (j in data[i]) {
                assert.deepEqual(data[i][j], info[i][j]);
            }
        }
        for (i = 0; i < handlers.length; i++) {
            handlers[i]._close();
        }
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};
