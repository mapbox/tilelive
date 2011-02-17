var Buffer = require('buffer').Buffer;

// TODO: this is clearly wrong.
module.exports.decode = function(s) {
    return (new Buffer(s, 'utf-8')).toString('base64').replace('/', '_').replace('+', '-');
};

module.exports.encode = function(s) {
    return (new Buffer(s, 'utf-8')).toString('base64').replace('/', '_').replace('+', '-');
};
