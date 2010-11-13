var app = require('server'),
    fs = require('fs');

/**
 * Bootstrap the application - ensure that directories 
 * exist, etc
 */
function bootstrap() {
    try {
        fs.statSync(app.set('settings')('mapfile_dir'));
    } catch (Exception) {
        console.log('Creating mapfile dir %s', app.set('settings')('mapfile_dir'));
        fs.mkdirSync(app.set('settings')('mapfile_dir'), 777);
    }

    try {
        fs.statSync(app.set('settings')('data_dir'));
    } catch (Exception) {
        console.log('Creating mapfile dir %s', app.set('settings')('data_dir'));
        fs.mkdirSync(app.set('settings')('data_dir'), 777);
    }
}

module.exports = bootstrap;
