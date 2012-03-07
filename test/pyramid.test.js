var assert = require('assert');
var Scheme = require('../lib/scheme');
var PyramidScheme = require('../lib/pyramidscheme');



describe('pyramid enumeration scheme', function() {
    it('should enumerate all tiles if the source doesn\'t skip', function(done) {
        var scheme = new PyramidScheme({
            minzoom: 0,
            maxzoom: 3,
            metatile: 1
        });

        assert.deepEqual(scheme, {
            type: 'pyramid',
            concurrency: 8,
            minzoom: 0,
            maxzoom: 0,
            maxdepth: 3,
            metatile: 1,
            bounds: {
                0: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
                1: { minX: 0, minY: 0, maxX: 1, maxY: 1 },
                2: { minX: 0, minY: 0, maxX: 3, maxY: 3 },
                3: { minX: 0, minY: 0, maxX: 7, maxY: 7 }
            },
            stats: { history: [], total: 85 },
            pos: { z: 0, x: -1, y: 0 },
            stack: [],
            box: [],
            pending: []
        });

        var tiles = {};
        scheme.task = {
            render: function(tile) {
                if (!tiles[tile.id]) tiles[tile.id] = 1;
                else tiles[tile.id]++;
                scheme.unique(tile);
            },
            finished: function() {
                assert.deepEqual(tiles, [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
                    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
                    1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,
                    1,1,1,1,1]);
                done();
            }
        };

        scheme.start()
    });

    it('should skip some tiles if the renderer produces skips', function(done) {
        var scheme = new PyramidScheme({
            minzoom: 0,
            maxzoom: 18,
            metatile: 1
        });

        var tiles = [];
        scheme.task = {
            render: function(tile) {
                if (!tiles[tile.id]) tiles[tile.id] = 1;
                else tiles[tile.id]++;
                if (tile.z <= 1) scheme.unique(tile);
                else scheme.skip(tile);
            },
            finished: function() {
                assert.deepEqual(tiles, [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]);
                assert.deepEqual(scheme.stats, { history: [],
                    total: 91625968981,
                    pending: 0,
                    unique: 5,
                    skipped: 91625968976
                });
                done();
            }
        };

        scheme.start()
    });

    it('should only produce those tiles within the bbox', function(done) {
        var scheme = new PyramidScheme({
            minzoom: 0,
            maxzoom: 2,
            metatile: 1,
            bbox: [ 0, -85.05112877980659, 180, 85.05112877980659 ]
        });

        var tiles = {};
        scheme.task = {
            render: function(tile) {
                if (!tiles[tile.id]) tiles[tile.id] = 1;
                else tiles[tile.id]++;
                scheme.unique(tile);
            },
            finished: function() {
                assert.deepEqual(tiles, {0:1, 3:1, 4:1, 13:1, 14:1, 15:1, 16:1, 17:1, 18:1, 19:1, 20:1});
                done();
            }
        };

        scheme.start()
    });

    it('should produce tiles in the correct order', function(done) {
        var scheme = new PyramidScheme({
            minzoom: 0,
            maxzoom: 2,
            concurrency: 1,
            metatile: 1
        });

        var tiles = [];
        scheme.task = {
            render: function(tile) {
                tiles.push(tile.toString());
                scheme.unique(tile);
            },
            finished: function() {
                assert.deepEqual(tiles, [ '0/0/0', '1/0/0', '2/0/0', '2/1/0', '2/0/1',
                    '2/1/1', '1/1/0', '2/2/0', '2/3/0', '2/2/1', '2/3/1', '1/0/1', '2/0/2',
                    '2/1/2', '2/0/3', '2/1/3', '1/1/1', '2/2/2', '2/3/2', '2/2/3', '2/3/3' ]);
                done();
            }
        };

        scheme.start()
    });

    it('should produce tiles in a different order with metatile:2', function(done) {
        var scheme = new PyramidScheme({
            minzoom: 0,
            maxzoom: 2,
            concurrency: 128,
            metatile: 2
        });

        var tiles = [];
        scheme.task = {
            render: function(tile) {
                tiles.push(tile.toString());
                process.nextTick(function() {
                    scheme.unique(tile);
                });
            },
            finished: function() {
                assert.equal(scheme.stats.total, 21);
                assert.equal(scheme.stats.pending, 0);
                assert.equal(scheme.stats.unique, 21);
                assert.equal(scheme.stats.duplicate, 0);
                assert.equal(scheme.stats.failed, 0);
                assert.equal(scheme.stats.skipped, 0);
                assert.deepEqual(tiles, [ '0/0/0', '1/0/0', '1/1/0', '1/0/1', '1/1/1',
                    '2/0/0', '2/1/0', '2/0/1', '2/1/1', '2/2/0', '2/3/0', '2/2/1',
                    '2/3/1', '2/0/2', '2/1/2', '2/0/3', '2/1/3', '2/2/2', '2/3/2',
                    '2/2/3', '2/3/3' ]);
                done();
            }
        };

        scheme.start()
    });

    it('should skip child tiles if parent files have been skipped with metatiling', function(done) {
        var scheme = new PyramidScheme({
            minzoom: 0,
            maxzoom: 2,
            concurrency: 128,
            metatile: 2
        });

        var tiles = [];
        scheme.task = {
            render: function(tile) {
                tiles.push(tile.toString());
                process.nextTick(function() {
                    if (tile.key !== false) {
                        scheme.duplicate(tile);
                    } else if (tile.z === 1 && tile.x === 0 && tile.y === 0) {
                        scheme.skip(tile);
                    } else if (tile.z === 1 && tile.x === 0 && tile.y === 1) {
                        tile.key = 42;
                        scheme.duplicate(tile);
                    }
                    else scheme.unique(tile);
                });
            },
            finished: function() {
                assert.equal(scheme.stats.total, 21);
                assert.equal(scheme.stats.pending, 0);
                assert.equal(scheme.stats.unique, 11);
                assert.equal(scheme.stats.duplicate, 5);
                assert.equal(scheme.stats.failed, 0);
                assert.equal(scheme.stats.skipped, 5);
                assert.deepEqual(tiles, [ '0/0/0', '1/0/0', '1/1/0', '1/0/1', '1/1/1',
                    '2/2/0', '2/3/0', '2/2/1', '2/3/1', '2/0/2/42', '2/1/2/42',
                    '2/0/3/42', '2/1/3/42', '2/2/2', '2/3/2', '2/2/3', '2/3/3' ]);
                done();
            }
        };

        scheme.start()
    });
});

describe('pyramid enumeration scheme serialization', function() {
    it('should serialize the pyramid scheme', function(done) {
        var scheme = new PyramidScheme({
            minzoom: 0,
            maxzoom: 3,
            concurrency: 4,
            metatile: 2
        });

        var scheme2;

        var state = '{"type":"pyramid","concurrency":4,"minzoom":0,"maxzoom":0,"maxdepth":3,"metatile":2,"bounds":{"0":{"minX":0,"minY":0,"maxX":0,"maxY":0},"1":{"minX":0,"minY":0,"maxX":1,"maxY":1},"2":{"minX":0,"minY":0,"maxX":3,"maxY":3},"3":{"minX":0,"minY":0,"maxX":7,"maxY":7}},"stats":{"history":[],"total":85,"pending":0,"unique":8,"duplicate":0,"failed":0,"skipped":0},"pos":{"z":0,"x":0,"y":0},"stack":[{"z":2,"x":2,"y":2,"size":2,"members":[{"z":2,"x":2,"y":2,"key":false},{"z":2,"x":3,"y":2,"key":false},{"z":2,"x":2,"y":3,"key":false},{"z":2,"x":3,"y":3,"key":false}],"children":[]},{"z":2,"x":0,"y":2,"size":2,"members":[{"z":2,"x":0,"y":2,"key":false},{"z":2,"x":1,"y":2,"key":false},{"z":2,"x":0,"y":3,"key":false},{"z":2,"x":1,"y":3,"key":false}],"children":[]},{"z":2,"x":2,"y":0,"size":2,"members":[{"z":2,"x":2,"y":0,"key":false},{"z":2,"x":3,"y":0,"key":false},{"z":2,"x":2,"y":1,"key":false},{"z":2,"x":3,"y":1,"key":false}],"children":[]},{"z":2,"x":0,"y":0,"size":2,"members":[{"z":2,"x":1,"y":1,"key":false}],"children":[{"z":3,"x":0,"y":0,"key":false},{"z":3,"x":1,"y":0,"key":false},{"z":3,"x":0,"y":1,"key":false},{"z":3,"x":1,"y":1,"key":false},{"z":3,"x":2,"y":0,"key":false},{"z":3,"x":3,"y":0,"key":false},{"z":3,"x":2,"y":1,"key":false},{"z":3,"x":3,"y":1,"key":false},{"z":3,"x":0,"y":2,"key":false},{"z":3,"x":1,"y":2,"key":false},{"z":3,"x":0,"y":3,"key":false},{"z":3,"x":1,"y":3,"key":false}]}],"box":[],"finished":false,"pending":[],"paused":true}';

        var i = 0;
        scheme.task = {
            render: function(tile) {
                if (i++ === 8) {
                    var stringified = JSON.stringify(scheme);
                    assert.equal(state, stringified);
                    scheme2 = Scheme.unserialize(JSON.parse(stringified));
                    assert.equal(state, JSON.stringify(scheme2));

                    scheme2.task = {
                        render: function(tile) {
                            scheme2.unique(tile);
                        },
                        finished: function() {
                            assert.equal(scheme2.stats.total, 85);
                            assert.equal(scheme2.stats.unique, 85);
                            assert.equal(scheme2.stats.pending, 0);
                        }
                    };

                    scheme2.start();
                }

                scheme.unique(tile);
            },
            finished: function() {
                assert.equal(scheme.stats.total, 85);
                assert.equal(scheme.stats.unique, 85);
                assert.equal(scheme.stats.pending, 0);
                done();
            }
        };

        scheme.start()
    });
});
