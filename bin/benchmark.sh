#!/bin/sh

for metatile in 1 2 3 4 6 8
do
  for concurrency in 5 10 25 40 55 70 85 100 125 150 200
  do
    rm devseed.mbtiles
    bin/tilelive copy "mapnik://./devseed-hq.xml?metatile=$metatile" \
        mbtiles://./devseed.mbtiles \
        --bbox="-77.1292,38.8506,-76.9541,38.9644" \
        --zoom=13-13 \
        --copy-tiles \
        --concurrency=$concurrency \
        --benchmark

    if [ $? -ne 0 ] ; then exit ; fi
  done
done


