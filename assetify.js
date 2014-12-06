'use strict';
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01'});
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var util = require('util');

var async = require('async');
var checksum = require('checksum');
var glob = require('glob');
var tmp = require('tmp');


function extractTarBall(tarfile, callback) {
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
                        originalFile: file.replace(dir, '')
                    };
                });
                return callback(null, fs);
            });
        });
    });
}

function checksumFiles(files, callback) {
    async.map(files, checksumFile, callback);
}

function checksumFile(file, callback) {
    checksum.file(file.path, { algorithm: 'md5'}, function(err, sum) {
        if (err) return callback(err);
        var filename = file.originalFile;
        var ext = path.extname(filename);
        var base = filename.replace(ext, '');
        var checksumFile = base + '-' + sum + ext;

        callback(null, {
            path: file.path,
            originalFile: file.originalFile,
            checksumFile: checksumFile
        });
    });
}

function uploadFiles(prefix, files, callback) {
    async.map(files, uploadFile.bind(null, prefix), callback);
}

function uploadFile(prefix, file, callback) {
    var s3Url = 'https://s3-eu-west-1.amazonaws.com/';
    var bucket = 'anders-dest/';
    fs.readFile(file.path, 'binary', function(err, data) {
        if (err) return callback(err);
        var s3options = {
            Bucket: bucket,
            Key: prefix + file.checksumFile,
            Body: data
        };
        s3.putObject(s3options, function(err, data) {
            if (err) return callback(err);
            console.log('Object added', s3options.Key);
            callback(null, {
                originalFile: file.originalFile,
                url: s3Url + bucket + file.checksumFile
            });
        });
    });
}

function downloadFile(bucket, key, callback) {
    tmp.file({postfix: '.tgz'}, function tmpCreated(err, tmpfile) {
        if (err) return callback(err);
        var awsRequest = s3.getObject({Bucket:bucket, Key:key});
        awsRequest.on('success', function() {
            return callback(null, tmpfile);
        });
        awsRequest.on('error', function(response) {
            return callback(response.error);
        });
        var stream = fs.createWriteStream(tmpfile);
        awsRequest.createReadStream().pipe(stream);
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
    downloadFile(bucket, key, function(err, tarfile) {
        if (err) return context.done(err);

        extractTarBall(tarfile, function(err, files) {
            if (err) return context.done(err);

            checksumFiles(files, function(err, files) {
                if (err) return context.done(err);

                uploadFiles(dirname, files, function(err, files) {
                    if (err) return context.done(err);
                    context.done(null, util.inspect(files));
                });

            });
        });
    });
};

