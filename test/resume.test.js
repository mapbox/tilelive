var Step = require('step');
var assert = require('assert');
var fs = require('fs');
var CopyTask = require('../lib/copytask');
var Scheme = require('../lib/scheme');

var tilelive = require('..');
tilelive.protocols['mbtiles:'] = require('mbtiles');
tilelive.protocols['tilejson:'] = require('tilejson');

describe('resume', function() {
    var job;

    before(function() {
        try { fs.unlinkSync(__dirname + '/resumed.mbtiles'); }
        catch(err) { if (err.code !== 'ENOENT') throw err; }
        try { fs.unlinkSync(__dirname + '/resumed.job'); }
        catch(err) { if (err.code !== 'ENOENT') throw err; }

        // Write resumed.mbtiles.
        fs.writeFileSync(__dirname + '/resumed.mbtiles', fs.readFileSync(__dirname + '/fixtures/resume.mbtiles'));

        // Write resumed.job.
        job = JSON.parse(fs.readFileSync(__dirname + '/fixtures/resume.job', 'utf8'));
        job.from.href = job.from.href.replace('{DIRNAME}', __dirname);
        job.from.path = job.from.path.replace('{DIRNAME}', __dirname);
        job.from.pathname = job.from.pathname.replace('{DIRNAME}', __dirname);
        job.to.href = job.to.href.replace('{DIRNAME}', __dirname);
        job.to.path = job.to.path.replace('{DIRNAME}', __dirname);
        job.to.pathname = job.to.pathname.replace('{DIRNAME}', __dirname);
        fs.writeFileSync(__dirname + '/resumed.job', JSON.stringify(job));
    });

    it('should copy', function(done) {
        var scheme = Scheme.unserialize(job.scheme);
        var task = new CopyTask(job.from, job.to, scheme, __dirname + '/resumed.job');
        task.start(function() {});
        task.on('error', function(err) {
            if (err.message === 'Tile does not exist') return;
            throw err;
        });
        task.on('finished', done);
    });

    it('should verify the information', function(done) {
        tilelive.load('mbtiles://' + __dirname + '/resumed.mbtiles', function(err, source) {
            source._db.get('SELECT COUNT(*) AS count FROM tiles', function(err, res) {
                if (err) throw err;
                assert.equal(res.count, 285);
                done();
            });
        });
    })

    after(function() {
        try { fs.unlinkSync(__dirname + '/resumed.mbtiles'); }
        catch(err) { if (err.code !== 'ENOENT') throw err; }
        try { fs.unlinkSync(__dirname + '/resumed.job'); }
        catch(err) { if (err.code !== 'ENOENT') throw err; }
    });
});
