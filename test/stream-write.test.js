var test = require('tape');
var tilelive = require('..');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');
var Timedsource = require('./timedsource');

tilelive.stream.setConcurrency(10);

test('write: slowput', function(t) {
    var fast = new Timedsource({time:10});
    var slow = new Timedsource({time:50});
    var get = tilelive.createReadStream(fast, {type:'scanline'});
    var put = tilelive.createWriteStream(slow);
    get.pipe(put);
    setTimeout(function() {
        t.deepEqual(get.stats, { ops: 20, total: 85, skipped: 4, done: 10 });
        t.deepEqual(put.stats, { ops: 7, total: 0, skipped: 0, done: 0 });
    }, 20);
    put.on('stop', function() {
        t.deepEqual(get.stats, { ops: 85, total: 85, skipped: 42, done: 85 });
        t.deepEqual(put.stats, { ops: 44, total: 0, skipped: 0, done: 35 });
        t.equal(true, slow.stopped, 'dst source stopped');
        t.end();
    });
});

test('write: unpipe', function(t) {
    var fast = new Timedsource({time:10});
    var slow = new Timedsource({time:50});
    var get = tilelive.createReadStream(fast, {type:'scanline'});
    var put = tilelive.createWriteStream(slow);
    get.pipe(put);
    setTimeout(function() {
        get.unpipe();
        setTimeout(function() {
            t.equal(true, slow.stopped, 'dst source stopped');
            t.end();
        }, 100);
    }, 20);
});

test('write: emptymax', function(t) {
    var fast = new Timedsource({time:10, emptymax: true, maxzoom: 4});
    var slow = new Timedsource({time:5});
    var get = tilelive.createReadStream(fast, {type:'scanline'});
    var put = tilelive.createWriteStream(slow);
    get.pipe(put);
    put.on('stop', function() {
        t.end();
    });
});
