var test = require('tape');
var validate = require('..').validate;

test('validate', function(t) {
    // name
    t.equal(
        validate({name:5}).toString(),
        'Error: name must be a string of 255 characters or less',
        'invalid name (number)');
    t.equal(
        validate({name:null}).toString(),
        'Error: name must be a string of 255 characters or less',
        'invalid name (null)');
    t.equal(
        validate({name:Array(257).join('a')}).toString(),
        'Error: name must be a string of 255 characters or less',
        'invalid name (256 chars)');
    t.equal(
        validate({name:'Hello world'}),
        undefined,
        'valid name');

    // version
    t.equal(
        validate({version:5}).toString(),
        'Error: version must be a string of 255 characters or less',
        'invalid version (number)');
    t.equal(
        validate({version:'1.0'}),
        undefined,
        'valid version');

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
        'Error: minzoom must be an integer between 0 and 22',
        'invalid minzoom (string)');
    t.equal(
        validate({minzoom:-1}).toString(),
        'Error: minzoom must be an integer between 0 and 22',
        'invalid minzoom (negative)');
    t.equal(
        validate({minzoom:15.5}).toString(),
        'Error: minzoom must be an integer between 0 and 22',
        'invalid minzoom (float)');
    t.equal(
        validate({minzoom:23}).toString(),
        'Error: minzoom must be an integer between 0 and 22',
        'invalid minzoom (> 22)');
    t.equal(
        validate({minzoom:0}),
        undefined,
        'valid minzoom');

    // maxzoom
    t.equal(
        validate({maxzoom:'Hello world'}).toString(),
        'Error: maxzoom must be an integer between 0 and 22',
        'invalid maxzoom (string)');
    t.equal(
        validate({maxzoom:-1}).toString(),
        'Error: maxzoom must be an integer between 0 and 22',
        'invalid maxzoom (negative)');
    t.equal(
        validate({maxzoom:15.5}).toString(),
        'Error: maxzoom must be an integer between 0 and 22',
        'invalid maxzoom (float)');
    t.equal(
        validate({maxzoom:23}).toString(),
        'Error: maxzoom must be an integer between 0 and 22',
        'invalid maxzoom (> 22)');
    t.equal(
        validate({maxzoom:0}),
        undefined,
        'valid maxzoom');

    t.end();
});
