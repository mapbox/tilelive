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
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};


exports['test loading metadata'] = function(beforeExit) {
    var completed = false;

    tilelive.info('mbtiles://' + __dirname + '/fixtures/plain_2.mbtiles', function(err, info) {
        completed = true;
        if (err) throw err;
        assert.deepEqual(info, { basename: 'plain_2.mbtiles',
            id: 'plain_2',
            name: 'plain_2',
            type: 'baselayer',
            description: '',
            version: '1.0.0',
            formatter: 'function(options, data) { if (options.format === \'full\') { return \'\' + data.NAME + \' (Population: \' + data.POP2005 + \')\'; } else { return \'\' + data.NAME + \'\'; } }',
            bounds: [ -179.9999999749438, -69.99999999526695, 179.9999999749438, 79.99999999662558 ],
            minzoom: 0,
            maxzoom: 4,
            center: [ 0, 5.0000000006793215, 2 ],
            legend: null,
            scheme: 'xyz'
        });
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};


exports['test loading metadata'] = function(beforeExit) {
    var completed = false;

    tilelive.info('tilejson://' + __dirname + '/fixtures/mapquest.tilejson', function(err, info) {
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
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};


exports['test loading all'] = function(beforeExit) {
    var completed = false;

    tilelive.all('test/fixtures', function(err, info) {
        completed = true;
        if (err) throw err;
        assert.deepEqual(info, [{
            name: 'MapQuest Open',
            scheme: 'tms',
            tiles: ['http://otile1.mqcdn.com/tiles/1.0.0/osm/${z}/${x}/${y}.jpg'],
            minzoom: 0,
            maxzoom: 18,
            bounds: [ -180, -85, 180, 85 ],
            center: [ 0, 0, 2 ],
            id: 'mapquest',
            description: '',
            version: '1.0.0',
            legend: null
        }, {
            basename: 'plain_1.mbtiles',
            id: 'plain_1',
            name: 'plain_1',
            type: 'baselayer',
            description: 'demo description',
            version: '1.0.3',
            formatter: null,
            bounds: [ -179.9999999749438, -69.99999999526695, 179.9999999749438, 84.99999999782301 ],
            minzoom: 0,
            maxzoom: 4,
            center: [ 0, 7.500000001278025, 2 ],
            legend: null,
            scheme: 'tms',
            size: 561152
        }, {
            basename: 'plain_2.mbtiles',
            id: 'plain_2',
            name: 'plain_2',
            type: 'baselayer',
            description: '',
            version: '1.0.0',
            formatter: 'function(options, data) { if (options.format === \'full\') { return \'\' + data.NAME + \' (Population: \' + data.POP2005 + \')\'; } else { return \'\' + data.NAME + \'\'; } }',
            bounds: [ -179.9999999749438, -69.99999999526695, 179.9999999749438, 79.99999999662558 ],
            minzoom: 0,
            maxzoom: 4,
            center: [ 0, 5.0000000006793215, 2 ],
            legend: null,
            scheme: 'tms',
            size: 874496,
        }, {
            basename: 'plain_4.mbtiles',
            id: 'plain_4',
            name: 'plain_2',
            type: 'baselayer',
            description: '',
            version: '1.0.0',
            formatter: 'function(options, data) { if (options.format === \'full\') { return \'\' + data.NAME + \' (Population: \' + data.POP2005 + \')\'; } else { return \'\' + data.NAME + \'\'; } }',
            bounds: [ -179.9999999749438, -69.99999999526695, 179.9999999749438, 79.99999999662558 ],
            minzoom: 0,
            maxzoom: 4,
            center: [ 0, 5.0000000006793215, 2 ],
            legend: null,
            scheme: 'tms',
            size: 684032
        }]);
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};

