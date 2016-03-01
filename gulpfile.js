var gulp = require('gulp');
var args = require('yargs').argv;
var del = require('del');
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
 *
 * gulp clean-styles
 * */
gulp.task('clean-styles', function (done) {
    var files = config.temp + '**/*.css';
    clean(files, done);
});
gulp.task('clean-fonts', function (done) {
    clean(config.build + 'fonts/**/*.*', done);
});
gulp.task('clean-images', function (done) {
    clean(config.build + 'images/**/*.*', done);
});

gulp.task('clean-code', function (done) {
    var files = [].concat(
        config.temp + "**/*.js",
        config.build + "**/*.html",
        config.build + "js/**/*.js",
        config.build + "styles/**/*.css"
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

gulp.task('fonts', ['clean-fonts'], function () {
    log('Copying fonts')
    return gulp
        .src(config.fonts)
        .pipe(gulp.dest(config.build + 'fonts'));
});

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
        .pipe(gulp.dest(config.temp))
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

gulp.task('optimize', ['inject'], function () {
    log('Optimizing js, css and html');

    var templateCache = config.temp + config.templateCache.file;

    return gulp.src(config.index)
        .pipe($.plumber())
        .pipe($.inject(gulp.src(templateCache, {read: false}),{
            starttag: '<!-- inject:templates:js -->'
        }))
        .pipe($.useref({ searchPath: './' }))
        .pipe(gulp.dest(config.build));
});

/**
 * Nodemon.
 * Whenever you hit control + s in app.js for example. This tasks is executed. (example change port number in app.js)
 *
 * 1. Prepare code, restart node-server
 */
gulp.task('serve-dev', ['inject'], function () {
    var isDev = true;

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
            startBrowserSync();
        })
        .on('crash', function () {
            log('*** nodemon crashed: script crashed for some reason');
        })
        .on('exit', function () {
            log('*** nodemon exited cleanly');
        });
});


////////////////////////
function changeEvent(event) {
    var srcPattern = new RegExp('/.*(?=/' + config.source + ')/');
    log('File ' + event.path.replace(srcPattern, '') + ' ' + event.type);
}

/**
 * gulp serve-dev --nosync: disable browserSync
 **/
function startBrowserSync() {
    if (args.nosync || browserSync.active) {
        return;
    }

    log('Starting browser-sync on port ' + port);


    gulp.watch([config.less], ['styles'])
        .on('change', function (event) {
            changeEvent(event);
        });

    /**
     * localhost: 3000 in firefox, chrome ... -> browsers are linked
     * */
    var options = {
        proxy: 'localhost:' + port,
        port: 3000,
        files: [
            config.client + '**/*.*', // everything in client folder + subfolder
            '!' + config.less, // ignore the .less files
            config.temp + '**/*.css' // watch .tmp/**/*.css
        ],
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
