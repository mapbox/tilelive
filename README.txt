 _   _ _      _ _           
| | (_) |    | (_)          
| |_ _| | ___| |___   _____ 
| __| | |/ _ \ | \ \ / / _ \
| |_| | |  __/ | |\ V /  __/
 \__|_|_|\___|_|_| \_/ \___|
                            

tilelive.js is a tile server for node.js [1] which supports on-the-fly
configuration and advanced interaction output. It's based off of Mapnik [2] and
can be used to add a tile server to an existing web application or wrapped with
a light standalone web tile server.

examples

See `examples/server.js` for an example tile server that leverages Express as
its web framework.

requirements

- https://github.com/mapnik/node-mapnik
- https://github.com/documentcloud/underscore

usage

tilelive.js aims to have an equivalent interface to TileLive (the original
version written in Python). Thus instructions for TileLive usage should
apply.

[1]: http://nodejs.org/
[2]: http://mapnik.org/

