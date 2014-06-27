var test = require('tape');

test('protocols', function(t) {
    var tileliveA = require('../');
    tileliveA.protocols['foobar:'] = function() {};

    // Clear the require cache.
    for (var key in require.cache) delete require.cache[key];

    var tileliveB = require('../');
    t.ok(tileliveA !== tileliveB, 'separate tilelive instances');
    t.ok(tileliveA.protocols === tileliveB.protocols, 'protocols are identical');
    t.ok(tileliveA.protocols['foobar:'], 'foobar: registered with tilelive A');
    t.ok(tileliveB.protocols['foobar:'], 'foobar: registered with tilelive B');

    t.end();
});
