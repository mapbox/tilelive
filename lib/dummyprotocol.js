exports = module.exports = DummyProtocol;

require('util').inherits(DummyProtocol, process.EventEmitter);
function DummyProtocol(uri, callback) {
    this.uri = uri;
    callback(null, this);
    return undefined;
}

DummyProtocol.prototype.toJSON = function() {
    return this.uri;
};

DummyProtocol.prototype.close = function(callback) {
    callback(null);
};

DummyProtocol.registerProtocols = function(tilelive) {
    tilelive.protocols['dummy:'] = DummyProtocol;
};

DummyProtocol.prototype.getTile = function(z, x, y, callback) {
    var rand = Math.random();
    if (rand < 0.001) {
        callback(new Error('Random error: ' + rand));
    } else {
        callback(null, new Buffer([ 0xDE, 0xAD, 0xBE, 0xEF ]));
    }
};
