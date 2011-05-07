var _ = require('underscore'),
    sys = require('sys'),
    Step = require('step'),
    EventEmitter = require('events').EventEmitter,
    Server = require('./server'),
    SphericalMercator = require('./sphericalmercator');

// Batch tile generation class.
//
// Required `options` keys:
// - `filepath` {String} filepath of generated batch.
// - `datasource` {String|Object} datasource for the tile, one of the
//   acceptable datasource formats accepted by the `Tile` class.
// - `storage` {Object} storage backend.
// - `renderer` {Object} render backend.
//
// Optional:
// - `bbox` {Array} bounding box coordinates in the order `[w, s, e, n]`.
//    Defaults to [-180,-90,180,90].
// - `srs` {String} SRS code of `bbox`. Either `900913` or `WGS84`.
// - `minzoom` {Number} minimum zoom level to render (inclusive). Default: 0.
// - `maxzoom` {Number} maximum zoom level to render (inclusive). Defualt: 4.
// - `interactivity` {Object} interactivity options to be passed through
//   to `Format.grid.render()` as `tile.format_options` (see `format.js`).
// - `batchsize` {Number} number of images/grids to render at a time
// - `metadata` {Object} hash of metadata to be written to the mbtiles database
var Batch = function(options) {
    if (!options) throw new Error('`options` is required.');
    if (!options.datasource) throw new Error('`options.datasource` is required.');
    if (!options.storage) throw new Error('`options.storage` is required.');
    if (!options.renderer) throw new Error('`options.renderer` is required.');

    _(options).defaults({
        bbox: [-180,-90,180,90],
        srs: 'WGS84',
        batchsize: 100,
        minzoom: 0,
        maxzoom: 4,
        metadata: {},
        serve: {}
    });
    _(options.serve).defaults({ format: 'png' });

    this.options = options;
    this.storage = options.storage;
    this.server = new Server(options.renderer);

    // validate formatter so that wax does not fail down the line
    try {
        eval('this.f = ' + this.options.metadata.formatter);
    } catch (e) {
        throw new Error('The metadata.formatter you specified is not valid javascript: \n' + 
            this.options.metadata.formatter);
    }

    SphericalMercator.call(this, this.options);

    // Vars needed for tile calculation/generation.
    this.grid = !!this.options.metadata.formatter;
    this.minzoom = this.options.minzoom;
    this.maxzoom = this.options.maxzoom;
    this.tilesCurrent = 0;
    this.tilesTotal = 0;

    // Precalculate the tile int bounds for each zoom level.
    this.zoomBounds = [];
    for (var z = this.minzoom; z <= this.maxzoom; z++) {
        this.zoomBounds[z] = this.xyz(this.options.bbox, z, true, this.options.srs);
        this.tilesTotal += (this.zoomBounds[z].maxX -
                             this.zoomBounds[z].minX + 1) *
                            (this.zoomBounds[z].maxY -
                             this.zoomBounds[z].minY + 1);
    }

    // Add bounds to metadata if not provided.
    if (!this.options.metadata.bounds) {
        this.options.metadata.bounds = this.options.srs === '900913'
            ? this.convert(this.options.bbox, 'WGS84')
            : this.options.bbox;
        this.options.metadata.bounds = this.options.metadata.bounds.join(',');
    }
};

sys.inherits(Batch, SphericalMercator, EventEmitter);

Batch.prototype.execute = function(callback) {
    var batch = this,
        storage = this.storage,
        resource;
    Step(
        function() {
            var next = this;
            storage.pool(batch.options.filepath).create(function(res) {
                resource = res;
                next();
            });
        },
        function(err) {
            if (err) throw err;
            storage.store('setup', resource, {}, this);
        },
        function(err) {
            if (err) throw err;
            batch.render(err, resource, this);
        },
        // this.features,
        // this.metadata,
        function(err) {
            if (err) throw err;
            storage.store('finish', resource, {}, this);
        },
        function(err) {
            if (err) throw err;
            storage.pool(batch.options.filepath).destroy(resource);
            this();
        },
        callback
    );
};

// Insert grid feature data for all features on the interactivity layer.
// Requires `this.options.interactivity` to be defined.
Batch.prototype.features = function(err, callback) {
    // This function is meaningless without interactivity settings
    if (!this.grid) {
        callback('Interactivity must be supported to add grid data');
        return;
    }

    // @TODO: batch.renderer.features() << get features from the server.
    var that = this;
    var map;
    Step(
        // Acquire a raw map object
        function() {
            Pool.acquire('map', that.options.datasource, that.options, this);
        },
        function(err, res) {
            if (err) throw err;

            map = res;
            
            var lyr = map.mapnik.get_layer(that.options.interactivity.layer);
            var featureset = lyr.datasource.featureset();
            var feat;
            var group = this.group();
            while (feat = featureset.next()) {
                that.mbtiles.insertGridData(feat,
                        that.options.interactivity.key_name,
                        group(err));
            }
        },
        function(err) {
            Pool.release('map', that.options.datasource, map);
            callback(err);
        }
    );
};

// Render an image/grid batch of size `this.options.batchsize` and insert into
// the MBTiles. `callback(err, tiles)` should call `renderChunk()` again to
// render the next batch of tiles. If `tiles` is false, there are no batches
// left to be rendered.
Batch.prototype.render = function(err, resource, callback) {
    var tiles = this.next(this.options.batchsize);
    var batch = this;

    if (err) return callback(err);
    if (!tiles) return callback(null);

    // @TODO emit events.
    process.nextTick(function() {
        Step(
            function() {
                var group = this.group();
                for (var i = 0; i < tiles.length; i++) {
                    var options = _.extend(batch.options.serve, {
                        datasource: batch.options.datasource,
                        xyz: [tiles[i][1], tiles[i][2], tiles[i][0]]
                    });
                    batch.server.serve(options, group());
                }
            },
            function(err, renders) {
                if (err) throw err;
                batch.storage.store(
                    'tiles',
                    resource,
                    _(renders).map(function(r, i) {
                        return { tile: tiles[i], data: r[0] };
                    }),
                    this
                );
            },
            function(err) {
                if (err) throw err;
                if (!batch.grid) return this();
                var group = this.group();
                for (var i = 0; i < tiles.length; i++) {
                    var options = _.extend(this.options.serve, {
                        datasource: batch.options.datasource,
                        xyz: [tiles[i][1], tiles[i][2], tiles[i][0]],
                        format: 'grid.json'
                    });
                    batch.server.serve(options, group());
                }
            },
            function(err, renders) {
                if (err) throw err;
                if (!batch.grid) return this();
                batch.storage.store(
                    'grids',
                    resource,
                    _(renders).map(function(r, i) {
                        return { tile: tiles[i], data: r[0] };
                    }),
                    this
                );
            },
            function(err) {
                batch.render(err, resource, callback);
            }
        );
    });
};

// Retrieve an array of tiles that should be rendered next. Returns `false` if
// there are no more tiles to be generated.
Batch.prototype.next = function(count) {
    var count = count || 1;
    var triplets = [];

    this.curZ = (typeof this.curZ === 'undefined') ? this.minzoom : this.curZ;
    for (var z = this.curZ; z <= this.maxzoom; z++) {
        this.curX = (typeof this.curX === 'undefined') ?
            this.zoomBounds[z].minX : this.curX;
        this.curY = (typeof this.curY === 'undefined') ?
            this.zoomBounds[z].minY : this.curY;

        for (var x = this.curX; x <= this.zoomBounds[z].maxX; x++) {
            for (var y = this.curY; y <= this.zoomBounds[z].maxY; y++) {
                this.curX = x;
                this.curY = y;
                this.curZ = z;
                if (triplets.length < count) {
                    triplets.push([z, x, y]);
                    this.tilesCurrent++;
                } else if (triplets.length === count) {
                    return triplets;
                }
            }
            // End of row, reset Y cursor.
            this.curY = this.zoomBounds[z].minY;
        }

        // End of the zoom layer, pass through and reset XY cursors.
        delete this.curX;
        delete this.curY;
    }
    // We're done, set our cursor outside usable bounds.
    this.curZ = this.maxzoom + 1;
    this.curX = this.zoomBounds[this.maxzoom].maxX + 1;
    this.curY = this.zoomBounds[this.maxzoom].maxY + 1;
    if (!triplets.length) {
        return false;
    }
    return triplets;
};

module.exports = Batch;
