var assert = require('assert');
var Scheme = require('../lib/scheme');
var ScanlineScheme = require('../lib/scanlinescheme');

describe('scanline enumeration scheme', function() {
    it('should enumerate all tiles in the correct order', function(done) {
        var scheme = new ScanlineScheme({
            minzoom: 0,
            maxzoom: 3,
            metatile: 1
        });

        assert.deepEqual(scheme, {
            type: 'scanline',
            concurrency: 8,
            minzoom: 0,
            maxzoom: 3,
            metatile: 1,
            bounds: {
                0: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
                1: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
                2: { minX: 0, minY: 0, maxX: 3, maxY: 3 },
                3: { minX: 0, minY: 0, maxX: 7, maxY: 7 }
            },
            stats: { history: [], total: 85 },
            pos: { z: 0, x: -1, y: 0 },
            box: [],
            pending: []
        });

        var tiles = [];
        scheme.task = {
            render: function(tile) {
                tiles.push(tile.toString());
                scheme.unique(tile);
            },
            finished: function() {
                assert.deepEqual(tiles, [
                    '0/0/0',

                    '1/0/0', '1/1/0', '1/0/1', '1/1/1',

                    '2/0/0', '2/1/0', '2/2/0', '2/3/0',
                    '2/0/1', '2/1/1', '2/2/1', '2/3/1',
                    '2/0/2', '2/1/2', '2/2/2', '2/3/2',
                    '2/0/3', '2/1/3', '2/2/3', '2/3/3',

                    '3/0/0', '3/1/0', '3/2/0', '3/3/0', '3/4/0', '3/5/0', '3/6/0', '3/7/0',
                    '3/0/1', '3/1/1', '3/2/1', '3/3/1', '3/4/1', '3/5/1', '3/6/1', '3/7/1',
                    '3/0/2', '3/1/2', '3/2/2', '3/3/2', '3/4/2', '3/5/2', '3/6/2', '3/7/2',
                    '3/0/3', '3/1/3', '3/2/3', '3/3/3', '3/4/3', '3/5/3', '3/6/3', '3/7/3',
                    '3/0/4', '3/1/4', '3/2/4', '3/3/4', '3/4/4', '3/5/4', '3/6/4', '3/7/4',
                    '3/0/5', '3/1/5', '3/2/5', '3/3/5', '3/4/5', '3/5/5', '3/6/5', '3/7/5',
                    '3/0/6', '3/1/6', '3/2/6', '3/3/6', '3/4/6', '3/5/6', '3/6/6', '3/7/6',
                    '3/0/7', '3/1/7', '3/2/7', '3/3/7', '3/4/7', '3/5/7', '3/6/7', '3/7/7'
                ]);
                done();
            }
        };

        scheme.start()
    });


    it('should enumerate all tiles in the correct order when supplying a bbox', function(done) {
        var scheme = new ScanlineScheme({
            minzoom: 2,
            maxzoom: 3,
            metatile: 1,
            bbox: [32, -40, 140, -20]
        });

        assert.deepEqual(scheme, {
            type: 'scanline',
            concurrency: 8,
            minzoom: 2,
            maxzoom: 3,
            metatile: 1,
            bounds: {
                2: { minX: 2, minY: 2, maxX: 3, maxY: 2 },
                3: { minX: 4, minY: 4, maxX: 7, maxY: 4 }
            },
            stats: { history: [], total: 6 },
            pos: { z: 2, x: 1, y: 2 },
            box: [],
            pending: []
        });

        var tiles = [];
        scheme.task = {
            render: function(tile) {
                tiles.push(tile.toString());
                scheme.unique(tile);
            },
            finished: function() {
                assert.deepEqual(tiles, [
                    '2/2/2', '2/3/2',
                    '3/4/4', '3/5/4', '3/6/4', '3/7/4'
                ]);
                done();
            }
        };

        scheme.start()
    });

    it('should enumerate all tiles in the correct order when metatiling', function(done) {
        var scheme = new ScanlineScheme({
            minzoom: 0,
            maxzoom: 3,
            metatile: 2
        });

        assert.deepEqual(scheme, {
            type: 'scanline',
            concurrency: 8,
            minzoom: 0,
            maxzoom: 3,
            metatile: 2,
            bounds: {
                0: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
                1: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
                2: { minX: 0, minY: 0, maxX: 3, maxY: 3 },
                3: { minX: 0, minY: 0, maxX: 7, maxY: 7 }
            },
            stats: { history: [], total: 85 },
            pos: { z: 0, x: -2, y: 0 },
            box: [],
            pending: []
        });

        var tiles = [];
        scheme.task = {
            render: function(tile) {
                tiles.push(tile.toString());
                scheme.unique(tile);
            },
            finished: function() {
                assert.deepEqual(tiles, [
                    '0/0/0',

                    '1/0/0', '1/1/0', '1/0/1', '1/1/1',

                    '2/0/0', '2/1/0', '2/0/1', '2/1/1',
                    '2/2/0', '2/3/0', '2/2/1', '2/3/1',
                    '2/0/2', '2/1/2', '2/0/3', '2/1/3',
                    '2/2/2', '2/3/2', '2/2/3', '2/3/3',

                    '3/0/0', '3/1/0', '3/0/1', '3/1/1',
                    '3/2/0', '3/3/0', '3/2/1', '3/3/1',
                    '3/4/0', '3/5/0', '3/4/1', '3/5/1',
                    '3/6/0', '3/7/0', '3/6/1', '3/7/1',
                    '3/0/2', '3/1/2', '3/0/3', '3/1/3',
                    '3/2/2', '3/3/2', '3/2/3', '3/3/3',
                    '3/4/2', '3/5/2', '3/4/3', '3/5/3',
                    '3/6/2', '3/7/2', '3/6/3', '3/7/3',
                    '3/0/4', '3/1/4', '3/0/5', '3/1/5',
                    '3/2/4', '3/3/4', '3/2/5', '3/3/5',
                    '3/4/4', '3/5/4', '3/4/5', '3/5/5',
                    '3/6/4', '3/7/4', '3/6/5', '3/7/5',
                    '3/0/6', '3/1/6', '3/0/7', '3/1/7',
                    '3/2/6', '3/3/6', '3/2/7', '3/3/7',
                    '3/4/6', '3/5/6', '3/4/7', '3/5/7',
                    '3/6/6', '3/7/6', '3/6/7', '3/7/7'
                ]);
                done();
            }
        };

        scheme.start()
    });

    it('should enumerate all tiles in the correct order when metatiling with a bbox', function(done) {
        var scheme = new ScanlineScheme({
            minzoom: 2,
            maxzoom: 4,
            metatile: 2,
            bbox: [32, -40, 140, -20]
        });

        assert.deepEqual(scheme, {
            type: 'scanline',
            concurrency: 8,
            minzoom: 2,
            maxzoom: 4,
            metatile: 2,
            bounds: {
                2: { minX: 2, minY: 2, maxX: 3, maxY: 2 },
                3: { minX: 4, minY: 4, maxX: 7, maxY: 4 },
                4: { minX: 9, minY: 8, maxX: 14, maxY: 9 }
            },
            stats: { history: [], total: 18 },
            pos: { z: 2, x: 0, y: 2 },
            box: [],
            pending: []
        });

        var tiles = [];
        scheme.task = {
            render: function(tile) {
                tiles.push(tile.toString());
                scheme.unique(tile);
            },
            finished: function() {
                assert.deepEqual(tiles, [
                    '2/2/2', '2/3/2', // incomplete metatile

                    '3/4/4', '3/5/4', '3/6/4', '3/7/4',

                    '4/9/8', '4/9/9', // incomplete metatile
                    '4/10/8', '4/11/8', '4/10/9', '4/11/9',
                    '4/12/8', '4/13/8', '4/12/9', '4/13/9',
                    '4/14/8', '4/14/9' // incomplete metatile
                ]);
                done();
            }
        };

        scheme.start()
    });
});

describe('scanline enumeration scheme serialization', function() {
    it('should serialize the scanline scheme', function(done) {
        var scheme = new ScanlineScheme({
            minzoom: 0,
            maxzoom: 3,
            concurrency: 4,
            metatile: 2
        });

        assert.deepEqual('{"type":"scanline","concurrency":4,"minzoom":0,"maxzoom":3,"metatile":2,"bounds":{"0":{"minX":0,"minY":0,"maxX":0,"maxY":0},"1":{"minX":0,"minY":0,"maxX":1,"maxY":1},"2":{"minX":0,"minY":0,"maxX":3,"maxY":3},"3":{"minX":0,"minY":0,"maxX":7,"maxY":7}},"stats":{"history":[],"total":85,"pending":0,"unique":0,"duplicate":0,"failed":0,"skipped":0},"pos":{"z":0,"x":-2,"y":0},"box":[],"finished":false,"pending":[],"paused":true}', JSON.stringify(scheme));

        var i = 0;
        scheme.task = {
            render: function(tile) {
                if (i++ === 8) {
                    // Tests that pending items change the pos of the serialized version,
                    // respecting metatiling settings.
                    var stringified = JSON.stringify(scheme);
                    assert.deepEqual('{"type":"scanline","concurrency":4,"minzoom":0,"maxzoom":3,"metatile":2,"bounds":{"0":{"minX":0,"minY":0,"maxX":0,"maxY":0},"1":{"minX":0,"minY":0,"maxX":1,"maxY":1},"2":{"minX":0,"minY":0,"maxX":3,"maxY":3},"3":{"minX":0,"minY":0,"maxX":7,"maxY":7}},"stats":{"history":[],"total":85,"pending":0,"unique":8,"duplicate":0,"failed":0,"skipped":0},"pos":{"z":2,"x":-2,"y":0},"box":[],"finished":false,"pending":[],"paused":true}', stringified);

                    var scheme2 = Scheme.unserialize(JSON.parse(stringified));
                    assert.equal(stringified, JSON.stringify(scheme2));
                }
                scheme.unique(tile);
            },
            finished: function() {
                done();
            }
        };

        scheme.start();
    });
});