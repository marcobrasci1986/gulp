var gulp = require('gulp');
var args = require('yargs').argv;
var del = require('del');
var config = require('./gulp.config')(); // () means execute immediately

var $ = require('gulp-load-plugins')({lazy: true});

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
 * Clean old css files before compiling LESS files
 * */
gulp.task('clean-styles', function (done) {
    var files = config.temp + '**/*.css';
    clean(files, done);

});

/**
 * Compile LESS to CSS (after cleaning old files)
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
 * Watch less files for changes
 */
gulp.task('less-watcher', function () {
    gulp.watch([config.less], ['styles']);
});

/**
 * 1. get index.html file
 * 2. Find bower files in right order
 * 3. Find and inject custom js (first module files, then normal js, exclude spec files)
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
 * Inject custom css into html
 */
gulp.task('inject', ['wiredep', 'styles'], function () {
    log('Wire up the app css into html, and after calling wiredep');

    return gulp
        .src(config.index)
        .pipe($.inject(gulp.src(config.css)))
        .pipe(gulp.dest(config.client));
});


gulp.task('serve-dev', ['inject'], function () {
    var isDev = true;
    var port = 7203;

    var nodeOptions = {
        script: config.nodeServer,
        delayTime: 1,
        env: {
            'PORT': port,
            'NODE_ENV': isDev ? 'dev' : 'build'
        },
        watch: [config.server]
    };
    return $.nodemon(nodeOptions)
        .on('restart',function (ev) {
            log('*** nodemon restarted');
            log('files changed on restart: \n' + ev);
        })
        .on('start', function () {
            log('*** nodemon started');
        })
        .on('crash', function () {
            log('*** nodemon crashed: script crashed for some reason');
        })
        .on('exit', function () {
            log('*** nodemon exited cleanly');
        });
});


////////////////////////
function clean(path, done) {
    log('Cleaning: ' + $.util.colors.blue(path));
    del(path);
    done();
}
function log(msg) {
    $.util.log($.util.colors.blue(msg));
}
