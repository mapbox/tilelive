var assert = require('assert');
var tilelive = require('../');

describe('auto', function() {
    var orig = tilelive.protocols;
    after(function() {
        tilelive.protocols = orig;
    });
    it('fails to load .mbtiles', function(done) {
        tilelive.protocols = {};
        tilelive.load('mbtiles://' + __dirname + '/fixtures/plain_1.mbtiles', function(err, source) {
            assert.ok(err);
            assert.equal('Invalid tilesource protocol', err.message);
            done();
        });
    });
    it('auto extname .mbtiles', function(done) {
        tilelive.protocols = {};
        var uri = tilelive.auto(__dirname + '/fixtures/plain_1.mbtiles');
        assert.equal('mbtiles:', uri.protocol);
        tilelive.load(uri, function(err, source) {
            assert.ifError(err);
            assert.ok(source);
            done();
        });
    });
    it('auto protocol mbtiles://', function(done) {
        tilelive.protocols = {};
        var uri = tilelive.auto(__dirname + '/fixtures/plain_1.mbtiles');
        assert.equal('mbtiles:', uri.protocol);
        tilelive.load(uri, function(err, source) {
            assert.ifError(err);
            assert.ok(source);
            done();
        });
    });
    it('auto extname .tilejson', function(done) {
        tilelive.protocols = {};
        var uri = tilelive.auto(__dirname + '/fixtures/mapquest.tilejson');
        assert.equal('tilejson:', uri.protocol);
        tilelive.load(tilelive.auto(__dirname + '/fixtures/mapquest.tilejson'), function(err, source) {
            assert.ifError(err);
            assert.ok(source);
            done();
        });
    });
    it('auto protocol tilejson://', function(done) {
        tilelive.protocols = {};
        var uri = tilelive.auto('tilejson://' + __dirname + '/fixtures/mapquest.tilejson');
        assert.equal('tilejson:', uri.protocol);
        tilelive.load(uri, function(err, source) {
            assert.ifError(err);
            assert.ok(source);
            done();
        });
    });
});
