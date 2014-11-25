'use strict';
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var tmp = require('tmp');
var fs = require('fs');
var path = require('path');
var glob = require('glob');
var exec = require('child_process').exec;
var util = require('util');
var checksum = require('checksum');
var async = require('async');


function extractTarBall(dirname, tarfile, callback) {
    tmp.dir(function(err, dir) {
        if (err) return callback(err);
        var cmd = 'tar -xzf ' + tarfile + ' -C ' + dir;
        exec(cmd, function (err) {
            if (err) return callback(err);
            glob(dir + '**/*.*', function(err, files) {
                if (err) return callback(err);
                var fs = files.map(function(file) {
                    return {
                        path: file,
                        originalFilename: file.replace(dir, dirname)
                    };
                });
                return callback(null, fs);
            });
        });
    });
}

function saveFiles(files, callback) {
    async.map(files, md5file, function(err, urls) {
        if (err) callback(err);
        return callback(null, urls);
    });
}

function md5file(file, callback) {
    checksum.file(file.path, { algorithm: 'md5'}, function(err, sum) {
        if (err) return callback(err);
        var filename = file.originalFilename;
        var ext = path.extname(filename);
        var base = filename.replace(ext, '');
        var newFile = base + '-' + sum + ext;
        upload(file.path, newFile, callback);
    });
}

function upload(path, filename, callback) {
    fs.readFile(path, 'binary', function(err, data) {
        if (err) return callback(err);
        var options = {Bucket: 'jn-test', Key: filename, Body: data};
        s3.putObject(options, function(err, data) {
            if (err) return callback(err);
            console.log('Object added', options.Key);
            var url = 'https://s3-eu-west-1.amazonaws.com/jn-test/' + filename;
            callback(null, url);
        });
    });
}


exports.handler = function(event, context) {
    console.log('Received event:');
    console.log(JSON.stringify(event, null, '  '));

    var bucket = event.Records[0].s3.bucket.name;
    var key = event.Records[0].s3.object.key;
    var tgzRegex = new RegExp('\\.tgz');
    if (!key.match(tgzRegex)) return context.done('no match');
    var dirname = path.basename(key, '.tgz');
    tmp.file({postfix: '.tgz'}, function tmpFileCreated(err, tmpfile) {
        if (err) return context.done(err);
        var awsRequest = s3.getObject({Bucket:bucket, Key:key});
        awsRequest.on('success', function(response) {
            extractTarBall(dirname, tmpfile, function(err, files) {
                if (err) return context.done(err);
                saveFiles(files, function(err, urls) {
                    if (err) return context.done(err);
                    context.done(null, util.inspect(urls));
                });
            });
        });
        awsRequest.on('error', function(response) {
            context.done(response.error);
        });
        var stream = fs.createWriteStream(tmpfile);
        awsRequest.createReadStream().pipe(stream);
    });
};

