#!/bin/sh

for metatile in 2 3 4
do
  for zoom in 15 16 17
  do
    for concurrency in 25 50 75 100 150
    do
      rm devseed.mbtiles
      bin/tilelive copy "mapnik://./devseed-hq.xml?metatile=$metatile" \
          mbtiles://./devseed.mbtiles \
          --bbox="-77.1292,38.8506,-76.9541,38.9644" \
          --zoom=$zoom \
          --copy-tiles \
          --concurrency=$concurrency \
          --benchmark

      if [ $? -ne 0 ] ; then exit ; fi
    done
  done
done


