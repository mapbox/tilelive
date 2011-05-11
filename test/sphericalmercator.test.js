var sm = new (require('tilelive').SphericalMercator)(),
    assert = require('assert');

exports['bbox'] = function() {
    assert.deepEqual(
        sm.bbox(0,0,0,true,'WGS84'),
        [-180,-85.05112877980659,180,85.0511287798066],
        '[0,0,0] converted to proper bbox.'
    );
    assert.deepEqual(
        sm.bbox(0,0,1,true,'WGS84'),
        [-180,-85.05112877980659,0,0],
        '[0,0,1] converted to proper bbox.'
    );
};

exports['xyz'] = function() {
    assert.deepEqual(
        sm.xyz([-180,-85.05112877980659,180,85.0511287798066],0,true,'WGS84'),
        {minX:0,minY:0,maxX:0, maxY:0},
        'World extents converted to proper tile ranges.'
    );
    assert.deepEqual(
        sm.xyz([-180,-85.05112877980659,0,0],1,true,'WGS84'),
        {minX:0,minY:0,maxX:0, maxY:0},
        'SW converted to proper tile ranges.'
    );
};

exports['convert'] = function() {
    assert.deepEqual(
        sm.convert([-180,-85.05112877980659,180,85.0511287798066],'900913'),
        [-20037508.34,-20037508.34,20037508.34,20037508.34],
        'WGS84 converted to 900913.'
    );
    assert.deepEqual(
        sm.convert([-20037508.34,-20037508.34,20037508.34,20037508.34],'WGS84'),
        [-179.99999997494382,-85.05112877764509,179.99999997494382,85.05112877764508],
        '900913 converted to WGS84.'
    );
};

exports['extents'] = function() {
    assert.deepEqual(
        sm.convert([-240,-90,240,90],'900913'),
        [-20037508.34,-20037508.34,20037508.34,20037508.34],
        'Maximum extents enforced on conversion to 900913.'
    );
    assert.deepEqual(
        sm.xyz([-240,-90,240,90],4,true,'WGS84'),
        {minX:0,minY:0,maxX:15, maxY:15},
        'Maximum extents enforced on conversion to tile ranges.'
    );
};
