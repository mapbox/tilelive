var Timedsource = require('./timedsource');
var tilelive = require('..');
var progress = require('progress-stream');
var util = require('util');
var setConcurrency = require('../lib/stream-util').setConcurrency;

var max = 9;
var readSpeed = 100;
var readsPerWrite = 5;
var speedVariation = 10;
var numReads = 0;
var numWrites = 0;
var numDrains = 0;
var writeHighWater = 2 * setConcurrency();
var startTime = Infinity;

console.log(
  'Calculated concurrency: %s - Write stream high water mark: %s - Target write speed: %s/s',
  setConcurrency(), writeHighWater, 60 * 1000 / (readSpeed * readsPerWrite)
);

function report() {
  var writesPerSecond = Math.floor(numWrites / (Date.now() - startTime) * 1000);
  var readsPerSecond = Math.floor(numReads / (Date.now() - startTime) * 1000);
  util.print(
    util.format(
      '\r\033[KReads: %s - Writes: %s - Queued: %s - Drains: %s - Write concurrency: %s - Write speed: %s/s - Read speed: %s/s',
      numReads, numWrites, write._writableState.buffer.length, numDrains, write._multiwriting, writesPerSecond, readsPerSecond
    )
  );
}

var readsource = new Timedsource({
  time: readSpeed,
  variation: speedVariation,
  maxzoom: max
});
var read = tilelive.createReadStream(readsource, { type: 'scanline' });
var readProgress = progress({
  objectMode: true,
  length: Math.pow(4, max),
  time: 1
}, function(prog) {
  if (prog.transferred > numReads) {
    numReads = prog.transferred;
  }
});
readProgress.once('progress', function() {
  startTime = Date.now();
});

var writesource = new Timedsource({
  time: readSpeed * readsPerWrite,
  variation: speedVariation,
  maxzoom: max
});
var write = tilelive.createWriteStream(writesource, { highWaterMark: writeHighWater });
write.on('_write', function() {
  numWrites++;
  writeConcurrency = write._multiwriting;
});
write.on('drain', function() {
  numDrains++;
  writeConcurrency = write._multiwriting;
});

setInterval(report, 1);
read.pipe(readProgress).pipe(write).on('stop', function() {
  console.log('finished');
  process.exit(0);
});
