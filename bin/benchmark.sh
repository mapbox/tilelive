#!/bin/sh

STYLESHEET="/home/mapbox/benchmarking/data/devseed-appliance.xml"
BBOX="-77.1292,38.8506,-76.9541,38.9644"

for buffersize in 128 0 256
do
  for metatile in 2 3 4
  do
    for zoom in 15 16 17
    do
      for concurrency in 25 50 100 200
      do
        rm out.mbtiles
        bin/tilelive copy "mapnik://$STYLESHEET?metatile=$metatile&bufferSize=$buffersize" \
            mbtiles://./out.mbtiles \
            --bbox="$BBOX" \
            --zoom=$zoom \
            --copy-tiles \
            --concurrency=$concurrency \
            --benchmark

        if [ $? -ne 0 ] ; then exit ; fi
      done
    done
  done
done


