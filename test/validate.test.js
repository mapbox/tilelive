var test = require('tape');
var verify = require('..').verify;
var validate = require('..').validate;

test('validate', function(t) {
    // scheme
    t.equal(
        validate({scheme:5}).toString(),
        'Error: scheme must be "tms" or "xyz"',
        'invalid scheme (number)');
    t.equal(
        validate({scheme:'Hello world'}).toString(),
        'Error: scheme must be "tms" or "xyz"',
        'invalid scheme (string)');
    t.equal(
        validate({scheme:'xyz'}),
        undefined,
        'valid scheme (xyz)');
    t.equal(
        validate({scheme:'tms'}),
        undefined,
        'valid scheme (tms)');

    // minzoom
    t.equal(
        validate({minzoom:'Hello world'}).toString(),
        'Error: minzoom must be an integer between 0 and 30',
        'invalid minzoom (string)');
    t.equal(
        validate({minzoom:-1}).toString(),
        'Error: minzoom must be an integer between 0 and 30',
        'invalid minzoom (negative)');
    t.equal(
        validate({minzoom:15.5}).toString(),
        'Error: minzoom must be an integer between 0 and 30',
        'invalid minzoom (float)');
    t.equal(
        validate({minzoom:31}).toString(),
        'Error: minzoom must be an integer between 0 and 30',
        'invalid minzoom (> 30)');
    t.equal(
        validate({minzoom:0}),
        undefined,
        'valid minzoom');

    // maxzoom
    t.equal(
        validate({maxzoom:'Hello world'}).toString(),
        'Error: maxzoom must be an integer between 0 and 30',
        'invalid maxzoom (string)');
    t.equal(
        validate({maxzoom:-1}).toString(),
        'Error: maxzoom must be an integer between 0 and 30',
        'invalid maxzoom (negative)');
    t.equal(
        validate({maxzoom:15.5}).toString(),
        'Error: maxzoom must be an integer between 0 and 30',
        'invalid maxzoom (float)');
    t.equal(
        validate({maxzoom:31}).toString(),
        'Error: maxzoom must be an integer between 0 and 30',
        'invalid maxzoom (> 30)');
    t.equal(
        validate({maxzoom:0}),
        undefined,
        'valid maxzoom');

    // name, version, format
    ['name','version','format'].forEach(function(key) {
        var data;
        data = {};
        data[key] = 5;
        t.equal(
            validate(data).toString(),
            'Error: ' + key + ' must be a string of 255 characters or less',
            'invalid ' + key + ' (number)');
        data[key] = Array(257).join('a');
        t.equal(
            validate(data).toString(),
            'Error: ' + key + ' must be a string of 255 characters or less',
            'invalid ' + key + ' (256 chars)');
        data[key] = 'Hello world';
        t.equal(
            validate(data),
            undefined,
            'valid ' + key);
    });

    // attribution, description, source
    ['attribution','description','source'].forEach(function(key) {
        var data = {};
        data[key] = 5;
        t.equal(
            validate(data).toString(),
            'Error: ' + key + ' must be a string of 2000 characters or less',
            'invalid ' + key + ' (number)');
        data[key] = Array(2002).join('a');
        t.equal(
            validate(data).toString(),
            'Error: ' + key + ' must be a string of 2000 characters or less',
            'invalid ' + key + ' (2001 chars)');
        data[key] = 'Hello world';
        t.equal(
            validate(data),
            undefined,
            'valid ' + key);
    });
    // legend, template
    ['legend','template'].forEach(function(key) {
        var data = {};
        data[key] = 5;
        t.equal(
            validate(data).toString(),
            'Error: ' + key + ' must be a string of 8000 characters or less',
            'invalid ' + key + ' (number)');
        data[key] = Array(8002).join('a');
        t.equal(
            validate(data).toString(),
            'Error: ' + key + ' must be a string of 8000 characters or less',
            'invalid ' + key + ' (8001 chars)');
        data[key] = 'Hello world';
        t.equal(
            validate(data),
            undefined,
            'valid ' + key);
    });

    // tiles, grids
    ['tiles','grids'].forEach(function(key) {
        var data = {};
        data[key] = 5;
        t.equal(
            validate(data).toString(),
            'Error: ' + key + ' must be an array of templated urls',
            'invalid ' + key + ' (string)');
        data[key] = [];
        t.equal(
            validate(data).toString(),
            'Error: ' + key + ' must be an array of templated urls',
            'invalid ' + key + ' (empty array)');
        data[key] = [5];
        t.equal(
            validate(data).toString(),
            'Error: ' + key + ' must be an array of templated urls',
            'invalid ' + key + ' (bad array value)');
        data[key] = ['http://example.com/{z}/{x}/{y}.png'];
        t.equal(
            validate(data),
            undefined,
            'valid ' + key);
    });

    // center
    t.equal(
        validate({center:'Hello world'}).toString(),
        'Error: center must be an array of the form [lon, lat, z]',
        'invalid center (string)');
    t.equal(
        validate({center:[]}).toString(),
        'Error: center must be an array of the form [lon, lat, z]',
        'invalid center (empty array)');
    t.equal(
        validate({center:['a',0,0]}).toString(),
        'Error: center must be an array of the form [lon, lat, z]',
        'invalid center (lon string)');
    t.equal(
        validate({center:[-190,0,0]}).toString(),
        'Error: center lon value must be between -180 and 180',
        'invalid center (lon < -180)');
    t.equal(
        validate({center:[0,'a',0]}).toString(),
        'Error: center must be an array of the form [lon, lat, z]',
        'invalid center (lat string)');
    t.equal(
        validate({center:[0,NaN,0]}).toString(),
        'Error: center must be an array of the form [lon, lat, z]',
        'invalid center (NaN)');
    t.equal(
        validate({center:[0,-100,0]}).toString(),
        'Error: center lat value must be between -90 and 90',
        'invalid center (lat < -90)');
    t.equal(
        validate({center:[0,0,'a']}).toString(),
        'Error: center must be an array of the form [lon, lat, z]',
        'invalid center (z string)');
    t.equal(
        validate({center:[0,0,-1]}).toString(),
        'Error: center z value must be an integer between 0 and 30',
        'invalid center (z negative)');
    t.equal(
        validate({center:[0,0,5.5]}).toString(),
        'Error: center z value must be an integer between 0 and 30',
        'invalid center (z float)');
    t.equal(
        validate({center:[0,0,5]}),
        undefined,
        'valid center');

    // bounds
    t.equal(
        validate({bounds:'Hello world'}).toString(),
        'Error: bounds must be an array of the form [west, south, east, north]',
        'invalid bounds (string)');
    t.equal(
        validate({bounds:[]}).toString(),
        'Error: bounds must be an array of the form [west, south, east, north]',
        'invalid bounds (empty array)');
    t.equal(
        validate({bounds:['a',0,0,0]}).toString(),
        'Error: bounds must be an array of the form [west, south, east, north]',
        'invalid bounds (west string)');
    t.equal(
        validate({bounds:[-190,0,0,0]}),
        undefined,
        'valid bounds (west > -360)');
    t.equal(
        validate({bounds:[0,'a',0,0]}).toString(),
        'Error: bounds must be an array of the form [west, south, east, north]',
        'invalid bounds (south string)');
    t.equal(
        validate({bounds:[0,-100,0,0]}).toString(),
        'Error: bounds south value must be between -95 and 95',
        'invalid bounds (south < -90)');
    t.equal(
        validate({bounds:[0,0,'a',0]}).toString(),
        'Error: bounds must be an array of the form [west, south, east, north]',
        'invalid bounds (east string)');
    t.equal(
        validate({bounds:[-190,0,0,0]}),
        undefined,
        'valid out-of-180 bounds');
    t.equal(
        validate({bounds:[0,0,400,0]}).toString(),
        'Error: bounds east value must be between -360 and 360',
        'valid out-of-180 bounds');
    t.equal(
        validate({bounds:[-400,0,0,0]}).toString(),
        'Error: bounds west value must be between -360 and 360',
        'valid out-of-180 bounds');
    t.equal(
        validate({bounds:[0,0,0,'a']}).toString(),
        'Error: bounds must be an array of the form [west, south, east, north]',
        'invalid bounds (north string)');
    t.equal(
        validate({bounds:[0,0,0,-100]}).toString(),
        'Error: bounds north value must be between -95 and 95',
        'invalid bounds (north < -90)');
    t.equal(
        validate({bounds:[10,0,-10,0]}).toString(),
        'Error: bounds west value must be less than or equal to east',
        'invalid bounds (east < west)');
    t.equal(
        validate({bounds:[0,10,0,-10]}).toString(),
        'Error: bounds south value must be less than or equal to north',
        'invalid bounds (north < south)');
    t.equal(
        validate({bounds:[-10,-10,10,10]}),
        undefined,
        'valid bounds');

    // vector_layers
    t.equal(
        validate({vector_layers:'Hello world'}).toString(),
        'Error: vector_layers must be an array of layer objects',
        'invalid vector_layers (string)');
    t.equal(
        validate({vector_layers:[]}).toString(),
        'Error: vector_layers must be an array of layer objects',
        'invalid vector_layers (empty array)');
    t.equal(
        validate({vector_layers:['layer']}).toString(),
        'Error: vector_layers[0] must be a layer object',
        'invalid vector_layers[0] (string)');
    t.equal(
        validate({vector_layers:[{id:5}]}).toString(),
        'Error: vector_layers[0] id must be a string of 255 characters or less',
        'invalid vector_layers[0] id (number)');
    t.equal(
        validate({vector_layers:[{id:(new Array(257)).join('a')}]}).toString(),
        'Error: vector_layers[0] id must be a string of 255 characters or less',
        'invalid vector_layers[0] id (256 chars)');
    t.equal(
        validate({vector_layers:[{id:'water'}]}),
        undefined,
        'valid vector_layers');

    // minzoom + maxzoom
    t.equal(
        validate({minzoom:5, maxzoom:4}).toString(),
        'Error: minzoom must be less than or equal to maxzoom',
        'invalid minzoom + maxzoom (minzoom > maxzoom)');
    t.equal(
        validate({minzoom:5, maxzoom:5}),
        undefined,
        'valid minzoom + maxzoom');

    // center + bounds
    t.equal(
        validate({center:null, bounds:[-5,-5,5,5]}),
        undefined,
        'ignores null center from check');
    t.equal(
        validate({center:[-10,0,0], bounds:[-5,-5,5,5]}).toString(),
        'Error: center lon value must be between bounds -5 and 5',
        'invalid center + bounds (lon outside bounds range)');
    t.equal(
        validate({center:[0,-10,0], bounds:[-5,-5,5,5]}).toString(),
        'Error: center lat value must be between bounds -5 and 5',
        'invalid center + bounds (lat outside bounds range)');
    t.equal(
        validate({center:[0,0,0], bounds:[-5,-5,5,5]}),
        undefined,
        'valid center + bounds');

    // center + minzoom + maxzoom
    t.equal(
        validate({center:null, minzoom:5}),
        undefined,
        'ignores null center from check');
    t.equal(
        validate({center:null, maxzoom:5}),
        undefined,
        'ignores null center from check');
    t.equal(
        validate({center:[0,0,0], minzoom:5}).toString(),
        'Error: center zoom value must be greater than or equal to minzoom 5',
        'invalid center + minzoom (zoom < minzoom)');
    t.equal(
        validate({center:[0,0,6], maxzoom:5}).toString(),
        'Error: center zoom value must be less than or equal to maxzoom 5',
        'invalid center + minzoom (zoom > maxzoom)');
    t.equal(
        validate({center:[0,0,5], minzoom:0, maxzoom:10}),
        undefined,
        'valid center + minzoom/maxzoom');

    // verify proxies validate
    t.equal(
        verify({center:[0,0,0], minzoom:5}).toString(),
        'Error: center zoom value must be greater than or equal to minzoom 5',
        'verify proxies validate');
    t.equal(
        verify({
            minzoom:0,
            maxzoom:0,
            bounds:[0,0,0,0]
        }).toString(),
        'Error: center is required',
        'verify requires center');
    t.equal(
        verify({
            center:[0,0,0],
            maxzoom:0,
            bounds:[0,0,0,0]
        }).toString(),
        'Error: minzoom is required',
        'verify requires minzoom');
    t.equal(
        verify({
            center:[0,0,0],
            minzoom:0,
            bounds:[0,0,0,0]
        }).toString(),
        'Error: maxzoom is required',
        'verify requires maxzoom');
    t.equal(
        verify({
            center:[0,0,0],
            minzoom:0,
            maxzoom:0
        }).toString(),
        'Error: bounds is required',
        'verify requires bounds');
    t.equal(
        verify({
            center:[0,0,0],
            minzoom:0,
            maxzoom:0,
            bounds:[0,0,0,0]
        }),
        undefined,
        'verify valid');
    t.equal(
        verify({
            center:[0,0,0],
            minzoom:0,
            maxzoom:0
        }, ['center','minzoom','maxzoom']),
        undefined,
        'verify custom list');

    t.end();
});
