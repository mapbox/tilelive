var Buffer = require('buffer').Buffer;

// Utility functions

module.exports.encode = function(s) {
    return (new Buffer(s, 'utf-8')).toString('base64').replace('/', '_').replace('+', '-');
};

module.exports.decode = function(s) {
    return (new Buffer(s, 'base64')).toString('utf-8').replace('+', '-').replace('/', '_');
};
