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

gulp.task('clean-styles', function (done) {
    var files = config.temp + '**/*.css';
    clean(files, done);

});

gulp.task('styles',['clean-styles'],  function () {
    log('Compiling less --> CSS');

    return gulp
        .src(config.less)
        .pipe($.plumber())
        .pipe($.less())
        .pipe($.autoprefixer({browsers: ['last 2 version', '> 5%']}))
        .pipe(gulp.dest(config.temp));
});


gulp.task('less-watcher', function () {
    gulp.watch([config.less], ['styles']);
});

/**
 * 1. get index.html file
 * 2. Find bower files in right order
 * 3. Find and inject custom js (first module files, then normal js, exclude spec files)
 */
gulp.task('wiredep', function () {
    var options = config.getWireDepDefaultOptions();
    var wiredep = require('wiredep').stream;

    return gulp
        .src(config.index)
        .pipe(wiredep(options))
        .pipe($.inject(gulp.src(config.js)))
        .pipe(gulp.dest(config.client));
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
