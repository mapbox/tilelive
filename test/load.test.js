var assert = require('assert');
var Step = require('step');

var tilelive = require('..');
tilelive.protocols['mbtiles:'] = require('mbtiles');
tilelive.protocols['tilejson:'] = require('tilejson');

var data = [
    {
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
        maxzoom: 22,
        center: null
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
        maxzoom: 22,
        bounds: [ -180, -85.05112877980659, 180, 85.05112877980659 ],
        center: null
    }
];

describe('loading', function() {
    it('should refuse loading an invalid url', function(done) {
        tilelive.load('http://foo/bar', function(err) {
            assert.ok(err);
            assert.equal(err.message, 'Invalid tilesource protocol');
            done();
        });
    });

    it('should load an existing mbtiles file', function(done) {
        tilelive.load('mbtiles://' + __dirname + '/fixtures/plain_2.mbtiles', function(err, source) {
            if (err) throw err;
            assert.equal(typeof source.getTile, 'function');
            assert.equal(typeof source.getGrid, 'function');
            assert.equal(typeof source.getInfo, 'function');
            source.close(done);
        });
    });

    it('should load metadata about an existing mbtiles file', function(done) {
        tilelive.info('mbtiles://' + __dirname + '/fixtures/plain_2.mbtiles', function(err, info, handler) {
            if (err) throw err;
            assert.deepEqual(info, data[3]);
            handler.close(done);
        });
    });

    it('should load metadata from an existing tilejson file', function(done) {
        tilelive.info('tilejson://' + __dirname + '/fixtures/mapquest.tilejson', function(err, info, handler) {
            if (err) throw err;
            assert.deepEqual(info, data[0]);
            handler.close(done);
        });
    });

    it('should load all tile sources in a directory', function(done) {
        tilelive.all('test/fixtures', function(err, info, handlers) {
            if (err) throw err;

            // Sort tilesets before deepEqual.
            info.sort(function(a, b) {
                return (a.basename || '0') < (b.basename || '0') ? -1 : 1;
            });

            assert.deepEqual(data, info);

            Step(function() {
                for (var i = 0; i < handlers.length; i++) {
                    handlers[i].close(this.parallel());
                }
            }, done);
        });
    });
});
