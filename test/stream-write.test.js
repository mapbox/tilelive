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
    get.on('error', function(err) { t.ifError(err); });
    put.on('error', function(err) { t.ifError(err); });
    get.pipe(put);
    setTimeout(function() {
        t.deepEqual(get.stats, { ops: 20, total: 85, skipped: 1, done: 10 });
        t.deepEqual(put.stats, { ops: 10, total: 0, skipped: 0, done: 0 });
    }, 20);
    put.on('stop', function() {
        t.deepEqual(get.stats, { ops: 85, total: 85, skipped: 28, done: 85 });
        // Multiwrites continue after 'finish' event.
        t.deepEqual(put.stats, { ops: 58, total: 0, skipped: 0, done: 58 });
        t.end();
    });
});


