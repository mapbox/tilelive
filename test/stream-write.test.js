var test = require('tape');
var tilelive = require('..');
var fs = require('fs');
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
        t.equal(get.length, 81);
    }, 20);
    put.on('stop', function() {
        t.equal(get.length, 43);
        t.deepEqual(get.stats, { ops: 85, total: 85, skipped: 42, done: 85 });
        t.deepEqual(put.stats, { ops: 44, total: 0, skipped: 0, done: 44 });
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

test('write: highWaterMark', function(t) {
    var fast = new Timedsource({time: 1, maxzoom: 5});
    var slow = new Timedsource({time: 1000});
    var get = tilelive.createReadStream(fast, {type: 'scanline'});
    var put = tilelive.createWriteStream(slow);

    get.pipe(put);

    setTimeout(function() {
        t.equal(put._writableState.buffer.length, 19, 'expected default highWaterMark');
        get.unpipe(put);

        put = tilelive.createWriteStream(slow, {highWaterMark: 5});
        get.pipe(put);
        setTimeout(function() {
            t.equal(put._writableState.buffer.length, 4, 'set highWaterMark');
            get.unpipe(put);
            t.end();
        }, 500);

    }, 500);
});

test('write: err + no retry', function(assert) {
    var get = tilelive.createReadStream(new Timedsource({}), {type:'scanline'});
    var put = tilelive.createWriteStream(new Timedsource({fail:1}));
    var errored = false;
    put.on('error', function(err) {
        if (errored) return;
        assert.equal(err.toString(), 'Error: Fatal', 'errors');
        errored = true;
        assert.end();
    });
    get.pipe(put);
});

test('write: err + retry', function(assert) {
    require('../lib/stream-util').retryBackoff = 1;
    var get = tilelive.createReadStream(new Timedsource({}), {type:'scanline'});
    var put = tilelive.createWriteStream(new Timedsource({fail:1}), {retry:1});
    get.on('error', assert.ifError);
    put.on('error', assert.ifError);
    get.pipe(put);
    put.on('stop', function() {
        require('../lib/stream-util').retryBackoff = 1000;
        assert.deepEqual(put.stats, { ops: 44, total: 0, skipped: 0, done: 44 });
        assert.end();
    });
});

