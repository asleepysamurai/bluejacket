'use strict';

/**
 * Use --production flag to get production builds.
 * Use --vendor flag to re-bundle vendor libraries on non-production builds.
 */

var gulp = require('gulp');
var log = require('fancy-log');
var chalk = require('chalk');
var prettyTime = require('pretty-hrtime');
var buffer = require('vinyl-buffer');
var babel = require('gulp-babel');
var argv = require('yargs').argv;
var gulpif = require('gulp-if');
var uglify = require('gulp-uglify-es').default;
var sourcemaps = require('gulp-sourcemaps');
var del = require('del');
var gulpWatch = require('gulp-watch');

var paths = {
    src: {
        js: './src/**/*.js'
    },
    cleanDir: './dist/**/*',
    dest: {
        js: './dist/'
    }
};

function logStart(e) {
    log('Starting', '\'' + chalk.cyan(e.task) + '\'...');
};

function logDone(e) {
    var time = prettyTime(e.duration);
    log(
        'Finished', '\'' + chalk.cyan(e.task) + '\'',
        'after', chalk.magenta(time)
    );
};

function onError(watch, next, err) {
    console.error(err.codeFrame ? err.message + '\n' + err.codeFrame : err);

    if (!watch && next && next.call)
        next(err);
};

function compileJS(next) {
    var watch = shouldWatch();

    function rebundle() {
        console.log('-> compiling JS...');
        var startTime = process.hrtime();
        var e = {
            task: 'writing js',
        };

        logStart(e);

        gulp.src(paths.src.js)
            .pipe(sourcemaps.init())
            .pipe(babel({
                presets: [
                    ['@babel/preset-env', {
                        exclude: ['transform-async-to-generator', 'transform-regenerator']
                    }]
                ],
                plugins: ['transform-async-to-promises']
            }).on('error', onError.bind(null, watch, next)))
            .pipe(buffer())
            .pipe(gulpif(argv.production, uglify()
                .on('error', onError.bind(null, watch, next))))
            .pipe(gulpif(!argv.production, sourcemaps.write()))
            .pipe(gulp.dest(paths.dest.js).on('end', function() {
                logDone({
                    task: 'writing js',
                    duration: process.hrtime(startTime)
                });

                if (!watch && next && next.call)
                    next();
            }));
    }

    if (watch)
        gulpWatch(paths.src.js, rebundle);

    rebundle();
};

function compile(next) {
    var startTime = process.hrtime();
    var e = {
        task: 'compile',
    };

    logStart(e);

    var watch = shouldWatch();

    var parallelTasks = [];
    parallelTasks.push(compileJS.bind(null));

    (gulp.series([gulp.parallel(parallelTasks),
        function postCompile(next) {
            logDone({
                task: 'compile',
                duration: process.hrtime(startTime)
            });

            if (!watch) {
                if (next && next.call)
                    next();

                setTimeout(function() {
                    process.exit(0);
                }, 300);
            }
        }
    ]))(next);
};

function clean(next) {
    del([paths.cleanDir]).then(function() {
        next.bind(null, null)();
    }).catch(function() { console.log(arguments) });
};

function shouldWatch() {
    return !argv.production;
};

gulp.task(compileJS);

gulp.task('clean', clean);
gulp.task('default', gulp.series(clean, compile));
