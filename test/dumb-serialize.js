var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');
var path = require('path');
var tmp = require('os').tmpdir();

var infile = path.join(__dirname, '/fixtures/plain_1.mbtiles');
var outfile = path.join(tmp, 'binary-one');
var src;

test('serialize: src', function(t) {
    new MBTiles(infile, function(err, s) {
        t.ifError(err);
        src = s;
        t.end();
    });
});

test('serialize: how big', function(t) {
    try { fs.unlinkSync(outfile); } catch(err) {}
    tilelive.createReadStream(src, {type: 'scanline'})
        .pipe(tilelive.serialize())
        .pipe(fs.createWriteStream(outfile))
        .on('finish', function() {
            console.log(fs.statSync(infile).size);
            console.log(fs.statSync(outfile).size);
            t.end();
        });
});
