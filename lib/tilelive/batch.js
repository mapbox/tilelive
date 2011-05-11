var _ = require('underscore'),
    sys = require('sys'),
    path = require('path'),
    Step = require('step'),
    EventEmitter = require('events').EventEmitter,
    Server = require('./server'),
    sm = new (require('./sphericalmercator'));

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
// - `batchsize` {Number} number of images/grids to render at a time
// - `bbox` {Array} bounding box coordinates in the order `[w, s, e, n]`.
//    Defaults to [-180,-90,180,90].
// - `minzoom` {Number} minimum zoom level to render (inclusive). Default: 0.
// - `maxzoom` {Number} maximum zoom level to render (inclusive). Defualt: 4.
// - `metadata` {Object} hash of metadata to be written to the mbtiles database
// - `serve` {Object} hash of options passed to the renderer `serve` method.
//
// Events:
// - `start` Emitted when batch rendering starts.
// - `write` Emitted after each chunk of `batchsize` has been rendered.
// - `end` Emitted when batch rendering is finished.
// - `error` Emitted if an error occurs.
var Batch = function(options) {
    if (!options) throw new Error('`options` is required.');
    if (!options.filepath) throw new Error('`options.filepath` is required.');
    if (!options.datasource) throw new Error('`options.datasource` is required.');
    if (!options.storage) throw new Error('`options.storage` is required.');
    if (!options.renderer) throw new Error('`options.renderer` is required.');

    _(options).defaults({
        batchsize: 100,
        bbox: [-180,-90,180,90],
        minzoom: 0,
        maxzoom: 4,
        metadata: {},
        serve: {}
    });
    _(options.serve).defaults({
        format: 'png',
        datasource: options.datasource
    });
    _(options.metadata).defaults({
        name: path.basename(options.filepath),
        type: 'baselayer',
        version: '1.0.0',
        description: '',
        format: options.serve.format,
        bounds: options.bbox.join(',')
    });

    this.options = options;
    this.storage = options.storage;
    this.server = new Server(options.renderer);

    // Vars needed for tile calculation/generation.
    this.grid = !!this.options.metadata.formatter;
    this.minzoom = this.options.minzoom;
    this.maxzoom = this.options.maxzoom;
    this.tilesCurrent = 0;
    this.tilesTotal = 0;

    // Precalculate the tile int bounds for each zoom level.
    this.zoomBounds = [];
    for (var z = this.minzoom; z <= this.maxzoom; z++) {
        this.zoomBounds[z] = sm.xyz(this.options.bbox, z, true);
        this.tilesTotal +=
            (this.zoomBounds[z].maxX - this.zoomBounds[z].minX + 1) *
            (this.zoomBounds[z].maxY - this.zoomBounds[z].minY + 1);
    }

    // Validate formatter so that wax does not fail down the line.
    if (this.grid) {
        try {
            eval('this.f = ' + this.options.metadata.formatter);
        } catch (e) {
            throw new Error('`metadata.formatter` is not valid javascript: \n' +
                this.options.metadata.formatter);
        }
    }
};

sys.inherits(Batch, EventEmitter);

// Execute the batch. Calls `callback(err)` upon completion or error.
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
            batch.timeStart = + new Date();
            batch.emit('start', batch);
        },
        function(err) {
            if (err) throw err;
            storage.store('metadata', resource, batch.options.metadata, this);
        },
        function(err) {
            if (err) throw err;
            batch.render(resource, this);
        },
        function(err) {
            if (err) throw err;
            storage.store('finish', resource, {}, this);
        },
        function(err) {
            // The storage resource is released regardless of whether an error
            // was thrown or not.
            storage.pool(batch.options.filepath).destroy(resource);
            batch.timeEnd = + new Date();
            batch.emit(err ? 'error' : 'end', batch, err);
            callback && callback(err);
        }
    );
};

// Render images and grids and store them for the current batch.
Batch.prototype.render = function(resource, callback) {
    var batch = this;

    var loop = function(err) {
        var tiles = batch.next(batch.options.batchsize);
        if (err || !tiles) return callback(err);
        process.nextTick(function() {
        Step(
            function() {
                var group = this.group();
                for (var i = 0; i < tiles.length; i++) {
                    var options = _({}).extend(
                        batch.options.serve,
                        tiles[i]
                    );
                    batch.server.serve(options, group());
                }
            },
            function(err, renders) {
                if (err) throw err;
                batch.storage.store(
                    'tiles',
                    resource,
                    _(renders).map(function(r, i) {
                        return _({}).extend(tiles[i], {data: r[0]});
                    }),
                    this
                );
            },
            function(err) {
                if (err) throw err;
                if (!batch.grid) return this();
                var group = this.group();
                for (var i = 0; i < tiles.length; i++) {
                    var options = _({}).extend(
                        batch.options.serve,
                        tiles[i],
                        {format: 'grid.json'}
                    );
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
                        return _({}).extend(tiles[i], r[0]);
                    }),
                    this
                );
            },
            function(err) {
                if (err) throw err;
                batch.emit('write', batch);
                this();
            },
            loop
        );
        });
    };
    loop();
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
                    triplets.push({x: x, y: y, z: z});
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
    return triplets.length ? triplets : false;
};

module.exports = Batch;
