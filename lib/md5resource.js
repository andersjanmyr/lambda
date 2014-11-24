'use strict';
var fs = require('fs');
var path = require('path');
var async = require('async');
var checksum = require('checksum');
var glob = require('glob');
var exec = require('child_process').exec;
var tmp = require('tmp');
var mkdirp = require('mkdirp');

var BASE_URL = process.env.DNS_NAME ?
    'https://' + process.env.DNS_NAME :
    'http://localhost:3000';

var CDN_URL = 'https://media.fx-webapps.com';
var dir;
function routes(app, mediaDir) {
    dir = mediaDir;

    function getFiles(options, callback) {
        // Defaults
        options = options || {};
        options.filter = options.filter || '';
        options.count = options.count || 100;

        var pattern = mediaDir + '/**/*.*';
        glob(pattern, function(err, files) {
            if (err) {
                callback(err);
                return;
            }

            // Filter
            if (options.filter) {
                var regex = new RegExp(options.filter, 'i');
                files = files.filter(function(file) {
                    return file.replace(mediaDir, '').match(regex);
                });
            }
            // Count
            if (files.length > options.count) {
                files.length = options.count;
            }

            var paths = files.map(filenameToUrl);
            callback(null, paths);
        });
    }

    function optionsFromRequest(req) {
        return  {
            filter: req.param('filter'),
            count: req.param('count')
        };
    }

    app.get('/', function (req, resp) {
        var options = optionsFromRequest(req);

        getFiles(options, function (err, files) {
            if (err) {
                resp.send(500, err);
            } else {
                var newFiles = req.session.newFiles;
                delete req.session.newFiles;
                resp.render('index', {
                    files: files,
                    newFiles: newFiles,
                    count: options.count,
                    filter: options.filter
                });
            }
        });
    });

    app.get('/files.json', function (req, resp) {
        var options = optionsFromRequest(req);

        getFiles(options, function (err, files) {
            if (err) {
                resp.send(500, err);
            } else {
                resp.type('application/json');
                resp.json(files);
            }
        });
    });

    app.get('/upload', function (req, resp) {
        resp.redirect('/');
    });

    app.post('/upload', function (req, resp) {
        function saveFilesAndRespond(files) {
            console.log(files);
            async.map(files, saveFile, function(err, urls) {
                if (err) resp.send(500, err);
                console.log(urls);
                req.session.newFiles = urls;
                return resp.redirect('/');
            });
        }

        if (!req.files.upload) return resp.redirect('/');
        var files = Array.isArray(req.files.upload) ?
            req.files.upload :
            [req.files.upload];
        if (files[0].path.match('.tgz$')) {
            return extractTarBall(files[0].path, function(err, files) {
                if (err) resp.send(500, err);
                return saveFilesAndRespond(files);
            });
        }

        return saveFilesAndRespond(files);
    });

    app.post('/delete', function(req, resp) {
        var id = req.param('id');
        var path = dir + id;
        console.log('deleting file', path);
        fs.unlink(path, function(err) {
            if (err) return resp.send(500, err);
            resp.send(200, id + ' deleted');
        });
    });

}

function extractTarBall(path, callback) {
    tmp.dir(function(err, dir) {
        if (err) return callback(err);
        var cmd = 'tar -xzf ' + path + ' -C ' + dir;
        console.log(cmd);
        exec(cmd, function (err) {
            if (err) return callback(err);
            glob(dir + '/**/*.*', function(err, files) {
                if (err) return callback(err);
                var fs = files.map(function(file) {
                    return {
                        path: file,
                        originalFilename: file.replace(dir, '')
                    };
                });
                return callback(null, fs);
            });
        });
    });
}

function filenameToUrl(file) {
    var fileWithoutPrefix = file.replace(dir, '');
    if (fileWithoutPrefix.charAt(0) !== '/')
        fileWithoutPrefix = '/' + fileWithoutPrefix;
    return {
        id: fileWithoutPrefix,
        url: BASE_URL + '/media' + fileWithoutPrefix,
        cdnUrl: CDN_URL + '/media' + fileWithoutPrefix
    };
}


function saveFile(file, callback) {
    checksum.file(file.path, { algorithm: 'md5'}, function(err, sum) {
        if (err) return callback(err);
        var filename = file.originalFilename;
        var ext = path.extname(filename);
        var base = filename.replace(ext, '');
        var newFile = base + '-' + sum + ext;
        var newPath = dir + '/' + newFile;
        console.log('File uploaded', newPath);
        mkdirp(path.dirname(newPath), function(err) {
            if (err) return callback(err);
            fs.rename(file.path, newPath, function(err) {
                if (err) return callback(err);
                console.log(filenameToUrl(newFile));
                return callback(null, filenameToUrl(newFile));
            });
        });
    });
}

module.exports = routes;



