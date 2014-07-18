var test = require('tape');
var MBTiles = require('mbtiles');
var tilelive = require('..');
var fs = require('fs');
var path = require('path');
var tmp = require('os').tmpdir();

var infile = path.join(__dirname, '/fixtures/plain_1.mbtiles');
var cerealfile = path.join(tmp, 'binary-one');
var outfile = path.join(tmp, 'out.mbtiles');
var src, dst, cereal;

test('deserialize: src', function(t) {
    new MBTiles(infile, function(err, s) {
        t.ifError(err);
        src = s;
        t.end();
    });
});

test('deserialize: dst', function(t) {
    try { fs.unlinkSync(outfile); } catch(err) {}
    new MBTiles(outfile, function(err, s) {
        t.ifError(err);
        dst = s;
        t.end();
    });
});

test('deserialize: cereal', function(t) {
    try { fs.unlinkSync(cerealfile); } catch(err) {}
    tilelive.createReadStream(src, {type: 'scanline'})
        .pipe(tilelive.serialize())
        .pipe(fs.createWriteStream(cerealfile))
        .on('finish', t.end);
});

test('deserialize: roundtrip', function(t) {
    var decerealeyes = tilelive.deserialize()
        .on('error', function(err) { t.ifError(err); });

    fs.createReadStream(cerealfile)
        .pipe(decerealeyes)
        .pipe(tilelive.createWriteStream(dst))
        .on('stop', function() {
            console.log(fs.statSync(infile).size);
            console.log(fs.statSync(outfile).size);
            t.end();
        });
});
