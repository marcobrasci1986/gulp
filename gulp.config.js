module.exports = function () {
    var client = './src/client/';
    var clientApp = client + 'app/';
    var server = './src/server/';
    var temp = './.tmp/';

    var config = {
        /**
         * File paths
         **/

        // all js to vet
        alljs: [
            './src/**/*.js',
            './*.js'
        ],
        build: './build/',
        client: client,
        css: temp + 'styles.css',
        fonts: './bower_components/font-awesome/fonts/**/*.*',
        images: client + 'images/**/*.*',
        html: clientApp + '**/*.html',
        htmlTemplates: clientApp + '**/*.html',
        index: client + 'index.html',
        js: [
            clientApp + '**/*.module.js',
            clientApp + '**/*.js',
            '!' + clientApp + '**/*.spec.js',
        ],
        temp: temp,
        less: client + 'styles/styles.less',
        server: server,

        /**
         * template cache
         */

        templateCache: {
            file: 'templates.js',
            options: {
                module: 'app.core',
                root: 'app/',
                standAlone: false
            }
        },

        /**
         * Browser sync
         */
        browserReloadDelay: 1000,

        /**
         * Bower and npm locations
         */
        bower: {
            json: require('./bower.json'),
            directory: './bower_components/',
            ignorePath: '../..'
        },

        /**
         * Node settings
         */

        defaultPort: 7203,
        nodeServer: './src/server/app.js'
    };

    config.getWireDepDefaultOptions = function () {
        var options = {
            bowerJson: config.bower.json,
            directory: config.bower.directory,
            ignorePath: config.bower.ignorePath
        };

        return options;
    };

    return config;
};
