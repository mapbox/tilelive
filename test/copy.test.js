var Step = require('step');
var assert = require('assert');
var fs = require('fs');

var tilelive = require('..');
tilelive.protocols['mbtiles:'] = require('mbtiles');
tilelive.protocols['tilejson:'] = require('tilejson');

describe('copying', function() {
    describe('workflow', function() {
        var source, sink;

        before(function() {
            try { fs.unlinkSync(__dirname + '/copy.mbtiles'); }
            catch(err) { if (err.code !== 'ENOENT') throw err; }
        });

        it('should open the source', function(done) {
            tilelive.load('mbtiles://' + __dirname + '/fixtures/plain_1.mbtiles', function(err, s) {
                source = s;
                done(err);
            });
        });

        it('should open the sink', function(done) {
            tilelive.load('mbtiles://' + __dirname + '/copy.mbtiles', function(err, s) {
                sink = s;
                done(err);
            });
        });

        it('should copy', function(done) {
            var scheme = tilelive.Scheme.create('scanline', {
                bbox: [ -10, -10, 10, 10 ],
                minzoom: 3,
                maxzoom: 5
            });
            var task = new tilelive.CopyTask(source, sink, scheme);
            task.on('error', done);
            task.on('finished', done);
            task.start();
        });

        it('should verify the information', function(done) {
            tilelive.info('mbtiles://' + __dirname + '/copy.mbtiles', function(err, info) {
                if (err) throw err;
                assert.deepEqual({
                    scheme: 'tms',
                    basename: 'copy.mbtiles',
                    id: 'copy',
                    filesize: 39936,
                    minzoom: 3,
                    maxzoom: 4,
                    bounds: [ -45, -40.97989806962013, 45, 40.97989806962013 ],
                    center: [ 0, 0, 4 ],
                    name: '',
                    description: '',
                    version: '1.0.0',
                    legend: null
                }, info);
                done();
            });
        })

        after(function() {
            try { fs.unlinkSync(__dirname + '/copy.mbtiles'); }
            catch(err) { if (err.code !== 'ENOENT') throw err; }
        });
    });
});
