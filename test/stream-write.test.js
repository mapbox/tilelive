var test = require('tape');
var tilelive = require('..');
var fs = require('fs');
var tmp = require('os').tmpdir();
var path = require('path');
var Timedsource = require('./timedsource');

test('write: slowput', function(t) {
    var fast = new Timedsource({time:5});
    var slow = new Timedsource({time:50});
    var get = tilelive.createReadStream(slow, {type:'scanline'});
    var put = tilelive.createWriteStream(fast);
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    get.pipe(put);
    setTimeout(function() {
        t.deepEqual(get.stats, { ops: 10, total: 85, skipped: 0, done: 0 });
        t.deepEqual(put.stats, { ops: 1, total: 0, skipped: 0, done: 1 });
    }, 10);
    put.on('finish', function() {
        t.deepEqual(get.stats, { ops: 85, total: 85, skipped: 28, done: 85 });
        t.deepEqual(put.stats, { ops: 58, total: 0, skipped: 0, done: 58 });
        t.end();
    });
});


