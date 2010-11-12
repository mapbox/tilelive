/**
 * @fileoverview Contains the setup / bootstrapping that isn't application
 * specific.
 */
var express = require('express')
    settings = require('settings').settings;
var app = module.exports = new express.Server();

app.configure(function() {
    app.set('settings', function(id) { return settings[id]; });
});
