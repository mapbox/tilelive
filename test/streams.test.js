var assert = require('assert');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');

//try { fs.unlinkSync('/tmp/testwrite.mbtiles'); } catch(e) {}

//new MBTiles(__dirname + '/fixtures/plain_1.mbtiles', function(err, from) {
//    if (err) throw err;
//    new MBTiles('/tmp/testwrite.mbtiles', function(err, to) {
//        if (err) throw err;
//        to._batchSize = 1;
//        from = tilelive.createReadStream(from, {type:'pyramid'});
//        to = tilelive.createWriteStream(to);
//        from.on('error', function(err) { console.warn(err); });
//        to.on('error', function(err) { console.warn(err); });
//        from.pipe(to);
//        to.on('finish', function() {
//            console.warn('DONE');
//            console.warn(from.stats);
//        });
//    });
//});

var file = fs.createReadStream(__dirname + '/fixtures/filescheme.flat');
var List = tilelive.streamTypes.list;

new MBTiles(__dirname + '/fixtures/plain_1.mbtiles', function(err, from) {
    if (err) throw err;
    new MBTiles('/tmp/testwrite.mbtiles', function(err, to) {
        if (err) throw err;
        var to = tilelive.createWriteStream(to);
        var list = new List(from);
        file.pipe(list).pipe(to);
    });
});

