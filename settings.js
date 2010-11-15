/**
 * Settings file: this is the only export
 */
module.exports.settings = {
    'mapfile_dir': 'mapfiles',
    'data_dir': 'data',
    'port': 8889,
    // TODO: request-specific overrides
    'header_defaults': {
        'Expires': new Date(Date.now() +
            1000 // second
            * 60 // minute
            * 60 // hour
            * 24 // day
            * 365 // year
            )
    }
};
