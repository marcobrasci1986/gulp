var gulp = require('gulp');
var args = require('yargs').argv;
var del = require('del');
var _ = require('lodash');
var path = require('path');
var browserSync = require('browser-sync');
var config = require('./gulp.config')(); // () means execute immediately like IIFE

var $ = require('gulp-load-plugins')({lazy: true});

var port = process.env.PORT || config.defaultPort;
// start node-server: node src/server/app.js

gulp.task('default', ['help'], function () {

});

/**
 * Prints tasks in gulpfile
 */
gulp.task('help', $.taskListing);

/**
 * Run jshint and jscs on the provided src files.
 * gulp vet --verbose
 */
gulp.task('vet', function () {
    log('Analyzing code');
    return gulp
        .src(config.alljs)
        .pipe($.if(args.verbose, $.print()))
        .pipe($.jscs())
        .pipe($.jshint())
        .pipe($.jshint.reporter('jshint-stylish', {verbose: true}))
        .pipe($.jshint.reporter('fail'));
});

/**
 * Cleans css files in .tmp folder
 */
gulp.task('clean-styles', function (done) {
    var files = config.temp + '**/*.css';
    clean(files, done);
});
/**
 * Cleans font in build folder
 * */
gulp.task('clean-fonts', function (done) {
    clean(config.build + 'fonts/**/*.*', done);
});
/**
 * Cleans images in build folder
 * */
gulp.task('clean-images', function (done) {
    clean(config.build + 'images/**/*.*', done);
});

/**
 * Cleans out temp and build folder
 * */
gulp.task('clean-code', function (done) {
    var files = [].concat(
        config.temp + '**/*.js',
        config.build + '**/*.html',
        config.build + 'js/**/*.js',
        config.build + 'styles/**/*.css'
    );
    clean(files, done);
});


gulp.task('clean', function (done) {
    var deleteConfig = [].concat(config.build, config.temp);
    log('Cleaning: ' + $.util.colors.blue(deleteConfig));
    del(deleteConfig, done);

});

/**
 * Compile LESS to CSS (after cleaning old files).
 *
 * 1. Find all files (provided in src)
 * 2. register gulp-plumber: Prevent pipe breaking caused by errors from gulp plugins
 * 3. Compile less to css
 * 4. Automatically add prefixers
 * 5. Copy generates files to dest folder (.tmp folder)
 *
 * It has a dependency on the task 'clean-styles'
 */
gulp.task('styles', ['clean-styles'], function () {
    log('Compiling less --> CSS');

    return gulp
        .src(config.less)
        .pipe($.plumber())
        .pipe($.less())
        .pipe($.autoprefixer({browsers: ['last 2 version', '> 5%']}))
        .pipe(gulp.dest(config.temp));
});

/**
 * Copy fonts into build folder
 */
gulp.task('fonts', ['clean-fonts'], function () {
    log('Copying fonts');
    return gulp
        .src(config.fonts)
        .pipe(gulp.dest(config.build + 'fonts'));
});

/**
 * Copy + compressimages +  into build folder
 */
gulp.task('images', ['clean-images'], function () {
    log('Copying and compressing images');

    return gulp
        .src(config.images)
        .pipe($.imagemin({optimizationLevel: 4}))
        .pipe(gulp.dest(config.build + 'images'));
});

/**
 * Watch less files for changes.
 *
 * Every time you hit [control + s] the watcher is executed
 */
gulp.task('less-watcher', function () {
    gulp.watch([config.less], ['styles']);
});

/**
 * 1. get index.html file
 * 2. Find bower files in right order
 * 3. Find and inject custom js (first module files, then normal js, exclude spec files). See comments in index.html
 */
gulp.task('wiredep', function () {
    log('Wire up the bower css js and our app js into the html');
    var options = config.getWireDepDefaultOptions();
    var wiredep = require('wiredep').stream;

    return gulp
        .src(config.index)
        .pipe(wiredep(options))
        .pipe($.inject(gulp.src(config.js)))
        .pipe(gulp.dest(config.client));
});

/**
 * Create template.js file in ./tmp
 */
gulp.task('templatecache', ['clean-code'], function () {
    log('Creating AngularJS $templateCache');

    return gulp
        .src(config.htmlTemplates)
        .pipe($.minifyHtml({empty: true}))
        .pipe($.angularTemplatecache(
            config.templateCache.file,
            config.templateCache.options
        ))
        .pipe(gulp.dest(config.temp));
});

/**
 * Inject custom css into html
 *
 * 1. Use wiredep to inject bower css and js
 * 2. Compile less to css
 * 3. Inject compiles css in html
 */
gulp.task('inject', ['wiredep', 'styles', 'templatecache'], function () {
    log('Wire up the app css into html, and after calling wiredep');

    return gulp
        .src(config.index)
        .pipe($.inject(gulp.src(config.css)))
        .pipe(gulp.dest(config.client));
});

gulp.task('build', ['optimize', 'images', 'fonts'], function () {
    log('Building everything');

    var msg = {
        title: 'gulp build',
        subtitle: 'Deployed to the build folder',
        message: 'Running gulp serve-build'
    };
    del(config.temp);
    log(msg);
    notify(msg);
});

gulp.task('optimize', ['inject', 'test'], function () {
    log('Optimizing js, css and html');

    var templateCache = config.temp + config.templateCache.file;


    return gulp.src(config.index)
        .pipe($.plumber())
        .pipe($.inject(gulp.src(templateCache, {read: false}), {
            starttag: '<!-- inject:templates:js -->'
        }))
        .pipe($.useref({searchPath: './'}))
        .pipe($.if('**/app.js', $.ngAnnotate()))// Annotate before uglify, only app js
        .pipe($.if('**/*.js', $.uglify()))
        .pipe($.if('**/*.css', $.csso()))
        .pipe($.if(['**/*.js', '**/*.css'], $.rev()))// app.js -> app-48494894.js --> only target js and css files
        .pipe($.revReplace())
        .pipe(gulp.dest(config.build))
        .pipe($.rev.manifest())
        .pipe(gulp.dest(config.build));
});

/**
 * Bump the version
 * --type=pre will bump the prerelease version *.*.*-x
 * --type=patch or no flag will bump the patch version *.*.x
 * --type=minor will bump the minor version *.x.*
 * --type=major will bump the major version x.*.*
 * --version=1.2.3 will bump to a specific version and ignore other flags
 *
 * gulp bump --version=2.3.4
 * gulp bump --type=minor
 */
gulp.task('bump', function () {
    var msg = 'Bumping version';
    var type = args.type;
    var version = args.version;

    var options = {};
    if (version) {
        options.version = version;
        msg += ' to ' + version;
    } else {
        options.type = type;
        msg += ' for a ' + type;
    }
    log(msg);

    return gulp
        .src(config.packages)
        .pipe($.print())
        .pipe($.bump(options))
        .pipe(gulp.dest(config.root));
});


gulp.task('serve-build', ['build'], function () {
    serve(false);
});
/**
 * Nodemon.
 * Whenever you hit control + s in app.js for example. This tasks is executed. (example change port number in app.js)
 *
 * 1. Prepare code, restart node-server
 */
gulp.task('serve-dev', ['inject'], function () {
    serve(true);
});


function serve(isDev) {
    var nodeOptions = {
        script: config.nodeServer,
        delayTime: 1,
        env: {
            'PORT': port,
            'NODE_ENV': isDev ? 'dev' : 'build'
        },
        watch: [config.server]
    };

    /**
     * You can add dependency tasks on any of these nodemon events
     */
    return $.nodemon(nodeOptions)
        .on('restart', function (ev) {
            log('*** nodemon restarted');
            log('files changed on restart: \n' + ev);
            setTimeout(function () {
                browserSync.notify('reloading now ...');
                browserSync.reload({stream: false});
            }, config.browserReloadDelay);
        })
        .on('start', function () {
            log('*** nodemon started');
            startBrowserSync(isDev);
        })
        .on('crash', function () {
            log('*** nodemon crashed: script crashed for some reason');
        })
        .on('exit', function () {
            log('*** nodemon exited cleanly');
        });
}


gulp.task('test', ['vet', 'templatecache'], function (done) {
    startTests(true, done);
});

/**
 * Run tests on file modification
 */
gulp.task('autotest', ['vet', 'templatecache'], function (done) {
    startTests(false, done);
});


////////////////////////

function startTests(singleRun, done) {
    var karma = require('karma').server;
    var excludeFiles = [];
    var serverSpecs = config.serverIntegrationSpecs;
    excludeFiles = serverSpecs;

    karma.start({
        configFile: __dirname + '/karma.conf.js',
        exclude: excludeFiles,
        singleRun: !!singleRun
    }, karmaCompleted);

    function karmaCompleted(karmaResult) {
        log('Karma completed');
        if (karmaResult === 1) {
            done('karma: tests failed with code ' + karmaResult);
        } else {
            done();
        }
    }
}
function changeEvent(event) {
    var srcPattern = new RegExp('/.*(?=/' + config.source + ')/');
    log('File ' + event.path.replace(srcPattern, '') + ' ' + event.type);
}

/**
 * gulp serve-dev --nosync: disable browserSync
 **/
function startBrowserSync(isDev) {
    if (args.nosync || browserSync.active) {
        return;
    }

    log('Starting browser-sync on port ' + port);


    if (isDev) {
        gulp.watch([config.less], ['styles'])
            .on('change', function (event) {
                changeEvent(event);
            });
    } else {
        gulp.watch([config.less, config.js, config.html], ['optimize', browserSync.reload])
            .on('change', function (event) {
                changeEvent(event);
            });
    }


    /**
     * localhost: 3000 in firefox, chrome ... -> browsers are linked
     * */
    var options = {
        proxy: 'localhost:' + port,
        port: 3000,
        files: isDev ? [
            config.client + '**/*.*', // everything in client folder + subfolder
            '!' + config.less, // ignore the .less files
            config.temp + '**/*.css' // watch .tmp/**/*.css
        ] : [],
        ghostMode: {
            clicks: true,
            location: false,
            forms: true,
            scroll: true
        },
        injectChanges: true,
        logFileChanges: true,
        logLevel: 'debug',
        logPrefix: 'gulp-patterns',
        notify: true,
        reloadDelay: 0 //1000
    };
    browserSync(options);
}


function clean(path, done) {
    log('Cleaning: ' + $.util.colors.blue(path));
    del(path);
    done();
}
function log(msg) {
    $.util.log($.util.colors.blue(msg));
}

function notify(options) {
    var notifier = require('node-notifier');
    var notifyOptions = {
        sound: 'Bottle',
        contentImage: path.join(__dirname, 'gulp.png'),
        icon: path.join(__dirname, 'gulp.png')
    };
    _.assign(notifyOptions, options);
    notifier.notify(notifyOptions);
}
