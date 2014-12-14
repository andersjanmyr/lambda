'use strict';
var aws = require('aws-sdk');
var s3 = new aws.S3({apiVersion: '2006-03-01', region: 'eu-west-1'});
var exec = require('child_process').exec;
var fs = require('fs');
var path = require('path');
var util = require('util');

var async = require('async');
var checksum = require('checksum');
var glob = require('glob');
var tmp = require('tmp');


var config = {
    bucket: 'anders-dest',
    url: 'https://s3-eu-west-1.amazonaws.com/'
};


// snippet-download-file
function assetify(sourceBucket, key, callback) {
    var tgzRegex = new RegExp('\\.tgz');
    if (!key.match(tgzRegex)) return callback('no match');
    var prefix = path.basename(key, '.tgz');

    async.waterfall([
        downloadFile.bind(null, sourceBucket, key),
        extractTarBall,
        checksumFiles,
        uploadFiles.bind(null, prefix),
        uploadIndex.bind(null, prefix)
    ], function(err, result) {
        if (err) return callback(err);
        callback(null, result);
    });
}

module.exports = assetify;
// snippet-download-file


// snippet-download-file
function downloadFile(sourceBucket, key, callback) {
    console.log('downloadFile', sourceBucket, key)
    tmp.file({postfix: '.tgz'}, function tmpCreated(err, tmpfile) {
        if (err) return callback(err);
        var awsRequest = s3.getObject({Bucket: sourceBucket, Key:key});
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
// snippet-download-file

// snippet-extract-tarball
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
// snippet-extract-tarball

// snippet-checksum-files
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
// snippet-checksum-files

// snippet-upload-files
function uploadFiles(prefix, files, callback) {
    console.log('uploadFiles', prefix, files)
    async.map(files, uploadFile.bind(null, prefix), callback);
}

function uploadFile(prefix, file, callback) {
    fs.readFile(file.path, 'binary', function(err, data) {
        if (err) return callback(err);
        var s3options = {
            Bucket: config.bucket,
            Key: prefix + file.checksumFile,
            Body: data
        };
        s3.putObject(s3options, function(err, data) {
            if (err) return callback(err);
            console.log('Object added', s3options.Key);
            callback(null, {
                originalFile: file.originalFile,
                url: config.url + prefix + file.checksumFile
            });
        });
    });
}
// snippet-upload-files


// snippet-upload-index
function uploadIndex(prefix, files, callback) {
    var s3options = {
        Bucket: config.bucket,
        Key: prefix + '/index.json',
        Body: JSON.stringify(files)
    };

    s3.putObject(s3options, function(err, data) {
        if (err) return callback(err);
        console.log('Object added', s3options.Key);
        callback(null, {
            files: files,
            url: config.url + prefix + '/index.json'
        });
    });

}
// snippet-upload-index

module.exports = assetify;

// snippet-handler
exports.handler = function(event, context) {
    console.log('Received event:');
    console.log(JSON.stringify(event, null, '  '));

    var bucket = event.Records[0].s3.bucket.name;
    var key = event.Records[0].s3.object.key;
    assetify(bucket, key, function(err, result) {
        context.done(err, util.inspect(result));
    });
};
// snippet-handler

