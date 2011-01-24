var mapnik = require('mapnik');
var sys = require('sys');

var mercator = new mapnik.Projection('+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0.0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +no_defs +over');

/**
 * SphericalMercator constructor: precaches calculations
 * for fast tile lookups
 */
function SphericalMercator(options) {
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
}

/**
 * Get the max of the first two numbers and the min of that and the third
 *
 * @param {Number} a the first number.
 * @param {Number} b the second number.
 * @param {Number} c the third number.
 * @return {Number}
 */
SphericalMercator.prototype.minmax = function(a, b, c) {
    return Math.min(Math.max(a, b), c);
};

/**
 * Convert lat lon to screen pixel value
 *
 * @param {Array} px [lat lon] array of geographic coordinates.
 * @param {Number} zoom number of the zoom level.
 */
SphericalMercator.prototype.ll_to_px = function(ll, zoom) {
    var d = this.zc[zoom];
    var f = this.minmax(Math.sin(this.DEG_TO_RAD * ll[1]), -0.9999, 0.9999);
    var x = Math.round(d + ll[0] * this.Bc[zoom]);
    var y = Math.round(d + 0.5 * Math.log((1 + f) / (1 - f)) * (-this.Cc[zoom]));
    return [x, y];
};

/**
 * Convert screen pixel value to lat lon
 *
 * @param {Array} px [x y] array of geographic coordinates.
 * @param {Number} zoom number of the zoom level.
 */
SphericalMercator.prototype.px_to_ll = function(px, zoom) {
    var zoom_denom = this.zc[zoom];
    var g = (px[1] - zoom_denom) / (-this.Cc[zoom]);
    var lat = (px[0] - zoom_denom) / this.Bc[zoom];
    var lon = this.RAD_TO_DEG * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
    return [lat, lon];
};

/**
 * Convert tile xyz value to Mapnik envelope
 *
 * @param {Number} x latitude number.
 * @param {Number} y longitude number.
 * @param {Number} zoom zoom.
 * @param {Boolean} tms_style whether to compute a tms tile.
 * @return Object Mapnik envelope.
 */
SphericalMercator.prototype.xyz_to_envelope = function(x, y, zoom, tms_style) {
    if (tms_style) {
        y = (Math.pow(2, zoom) - 1) - y;
    }
    var ll = [x * this.size, (y + 1) * this.size];
    var ur = [(x + 1) * this.size, y * this.size];
    var bbox = this.px_to_ll(ll, zoom).concat(this.px_to_ll(ur, zoom));
    var env = mercator.forward(bbox);
    return env;
};

// assumes an envelope is in projected coords, in this case spherical mercator
SphericalMercator.prototype.envelope_to_xyz_array = function(envelope, minzoom, maxzoom) {
    var bbox = mercator.inverse(envelope);
    this.bbox_to_xyz_array(bbox,minzoom,maxzoom);
}

// assumes at bbox is in long/lat aka wgs 84
SphericalMercator.prototype.bbox_to_xyz_array = function(bbox, minzoom, maxzoom) {
    var ll0 = [bbox[0],bbox[3]];
    var ll1 = [bbox[2],bbox[1]];
    var that = this;
    for (var z = minzoom; z <= maxzoom; z++) {
        px0 = that.ll_to_px(ll0,z);
        px1 = that.ll_to_px(ll1,z);

        for(var x = parseInt(px0[0]/256.0); x < parseInt(px1[0]/256.0+1); x++) {
            for (var y = parseInt(px0[1]/256.0); y < parseInt(px1[1]/256.0+1); y++) {
                console.log(z + ' ' + x + ' ' + y);
            }
        }
    }
}

SphericalMercator.prototype.BBoxXYZ = BBoxXYZ;

function BBoxXYZ(options, envelope, minzoom, maxzoom) {
    this.minzoom = minzoom;
    this.maxzoom = maxzoom;
    SphericalMercator.call(this, options);
    this.bbox = mercator.inverse(envelope);
}

sys.inherits(BBoxXYZ, SphericalMercator);

BBoxXYZ.prototype.next = function(count) {
    var count = count || 1;
    var triplets = [];

    var ll0 = [this.bbox[0],this.bbox[3]];
    var ll1 = [this.bbox[2],this.bbox[1]];

    var that = this;
    this.curZ = (typeof this.curZ === 'undefined') ? this.minzoom : this.curZ;
    for (var z = this.curZ; z <= this.maxzoom; z++) {
        px0 = that.ll_to_px(ll0,z);
        px1 = that.ll_to_px(ll1,z);

        var maxX = parseInt(px1[0]/256.0+1);
        var minX = parseInt(px0[0]/256.0);
        var maxY = parseInt(px1[1]/256.0+1);
        var minY = parseInt(px0[1]/256.0);

        this.curX = (typeof this.curX === 'undefined') ? minX : this.curX;
        this.curY = (typeof this.curY === 'undefined') ? minY : this.curY;

        for (var x = this.curX; x < maxX; x++) {
            for (var y = this.curY; y < maxY; y++) {
                this.curX = x;
                this.curY = y;
                this.curZ = z;
                if (triplets.length < count) {
                    triplets.push([z,x,y]);
                }
                else if (triplets.length === count) {
                    return triplets;
                }
            }
            // Reset Y cursor
            this.curY = minY;
        }

        // End of the zoom layer, pass through and reset XY cursors.
        delete this.curX;
        delete this.curY;
    }
    // We're done.
    this.curZ = this.maxzoom;
    this.curX = maxX;
    this.curY = maxY;
    if (!triplets.length) {
        return false;
    }
    return triplets;
}

module.exports = SphericalMercator;
