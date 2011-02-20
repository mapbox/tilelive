var sys = require('sys');

// SphericalMercator constructor: precaches calculations
// for fast tile lookups.
var SphericalMercator = function(options) {
    var size = options.size || 256;
    this.Bc = [];
    this.Cc = [];
    this.zc = [];
    this.Ac = [];
    this.DEG_TO_RAD = Math.PI / 180;
    this.RAD_TO_DEG = 180 / Math.PI;
    this.size = options.size || 256;
    this.levels = options.levels || 18;
    for (var d = 0; d < this.levels; d++) {
        this.Bc.push(size / 360);
        this.Cc.push(size / (2 * Math.PI));
        this.zc.push(size / 2);
        this.Ac.push(size);
        size *= 2;
    }
};

// Get the max of the first two numbers and the min of that and the third
//
// - `a` {Number} the first number.
// - `b` {Number} the second number.
// - `c` {Number} the third number.
// - `return` {Number}
SphericalMercator.prototype.minmax = function(a, b, c) {
    return Math.min(Math.max(a, b), c);
};

// Convert lon lat to screen pixel value
//
// - `ll` {Array} `[lon, lat]` array of geographic coordinates.
// - `zoom` {Number} zoom level.
SphericalMercator.prototype.ll_to_px = function(ll, zoom) {
    var d = this.zc[zoom];
    var f = this.minmax(Math.sin(this.DEG_TO_RAD * ll[1]), -0.9999, 0.9999);
    var x = Math.round(d + ll[0] * this.Bc[zoom]);
    var y = Math.round(d + 0.5 * Math.log((1 + f) / (1 - f)) * (-this.Cc[zoom]));
    return [x, y];
};

// Convert screen pixel value to lon lat
//
// - `px` {Array} `[x, y]` array of geographic coordinates.
// - `zoom` {Number} zoom level.
SphericalMercator.prototype.px_to_ll = function(px, zoom) {
    var zoom_denom = this.zc[zoom];
    var g = (px[1] - zoom_denom) / (-this.Cc[zoom]);
    var lon = (px[0] - zoom_denom) / this.Bc[zoom];
    var lat = this.RAD_TO_DEG * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
    return [lon, lat];
};

// Convert tile xyz value to lon/lat aka wgs 84
//
// - `x` {Number} x (longitude) number.
// - `y` {Number} y (latitude) number.
// - `zoom` {Number} zoom.
// - `tms_style` {Boolean} whether to compute using tms-style.
// - `return` {Array} bbox array of values in form `[w, s, e, n]`.
SphericalMercator.prototype.xyz_to_bbox = function(x, y, zoom, tms_style) {
    if (tms_style) {
        y = (Math.pow(2, zoom) - 1) - y;
    }
    var ll = [x * this.size, (y + 1) * this.size]; // lower left
    var ur = [(x + 1) * this.size, y * this.size]; // upper right
    var bbox = this.px_to_ll(ll, zoom).concat(this.px_to_ll(ur, zoom));
    return bbox;
};

// Convert tile xyz value to Mapnik envelope
//
// - `x` {Number} x (longitude) number.
// - `y` {Number} y (latitude) number.
// - `zoom` {Number} zoom.
// - `tms_style` {Boolean} whether to compute using tms-style.
// - `return` {Object} Mapnik envelope.
SphericalMercator.prototype.xyz_to_envelope = function(x, y, zoom, tms_style) {
    var bbox = this.xyz_to_bbox(x, y, zoom, tms_style);
    if (!this.mercator) {
        var mapnik = require('mapnik');
        this.mercator = new mapnik.Projection('+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs +over');
    }
    var env = this.mercator.forward(bbox);
    return env;
};

// Convert mercator bbox to xyx bounds
//
// - `bbox` {Number} mercator bbox in the form `[w, s, e, n]`.
// - `zoom` {Number} zoom.
// - `tms_style` {Boolean} whether to compute using tms-style.
// - `@return` {Object} XYZ bounds containing minX, maxX, minY, maxY properties.
SphericalMercator.prototype.bbox_to_xyz = function(bbox, zoom, tms_style) {
    if (!this.mercator) {
        var mapnik = require('mapnik');
        this.mercator = new mapnik.Projection('+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs +over');
    }
    var envelope = this.mercator.inverse(bbox);
    var ll = [envelope[0], envelope[1]]; // lower left
    var ur = [envelope[2], envelope[3]]; // upper right
    var px_ll = this.ll_to_px(ll, zoom);
    var px_ur = this.ll_to_px(ur, zoom);
    // Y = 0 for XYZ is the top hence minY uses px_ur[1].
    var bounds = {
        minX: Math.floor(px_ll[0] / this.size),
        minY: Math.floor(px_ur[1] / this.size),
        maxX: Math.floor((px_ur[0] - 1) / this.size),
        maxY: Math.floor((px_ll[1] - 1) / this.size)
    };
    if (tms_style) {
        var tms = {
            minY: (Math.pow(2, zoom) - 1) - bounds.maxY,
            maxY: (Math.pow(2, zoom) - 1) - bounds.minY
        };
        bounds.minY = tms.minY;
        bounds.maxY = tms.maxY;
    }
    return bounds;
};

module.exports = SphericalMercator;
