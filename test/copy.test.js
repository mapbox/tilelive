var Step = require('step');
var fs = require('fs');

var tilelive = require('..');
tilelive.protocols['mbtiles:'] = require('mbtiles');
tilelive.protocols['tilejson:'] = require('tilejson');

exports['test copying'] = function(beforeExit, assert) {
    var completed = false, source, sink;
    Step(function() {
        var next = this;
        tilelive.load('mbtiles://' + __dirname + '/fixtures/plain_1.mbtiles', function(err, s) {
            if (err) throw err;
            source = s;
            next();
        });
    }, function() {
        var next = this;
        tilelive.load('mbtiles://' + __dirname + '/copy.mbtiles', function(err, s) {
            if (err) throw err;
            sink = s;
            next();
        });
    }, function() {
        var next = this;
        tilelive.copy({
            source: source,
            sink: sink,
            bbox: [ -10, -10, 10, 10 ],
            minZoom: 3,
            maxZoom: 5,
            tiles: true
        }, function(err) {
            next();
            if (err) throw err;
        });
    }, function() {
        tilelive.info('mbtiles://' + __dirname + '/copy.mbtiles', function(err, info) {
            if (err) throw err;
            var data = {
                scheme: 'tms',
                basename: 'copy.mbtiles',
                id: 'copy',
                minzoom: 3,
                maxzoom: 4,
                center: [ 0, 0, 4 ],
                name: '',
                description: '',
                version: '1.0.0',
                legend: null 
             };
            for (i in data) {
                assert.deepEqual(data[i], info[i]);
            }
            fs.unlinkSync(__dirname + '/copy.mbtiles');
            completed = true;
        });
    });

    beforeExit(function() {
        assert.ok(completed, "Callback didn't complete");
    });
};
