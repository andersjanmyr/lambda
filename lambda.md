# Lambda, Javascript Micro-Services on AWS

Amazon just released a bunch of new services. My favorite is Lambda.
Lambda allows me to deploy simple micro-services without having to setup any
servers at all. Everything is hosted in the AWS cloud. Another cool thing
about Lambda services is that the default runtime is Node.js!

To get access to AWS Lambda, you have to sign in to the [AWS Console] and
select the `Lambda` service. You have to fill out a form to request access,
which may take a while to come through. Once you have access you can edit the
functions in a web form.


A lambda service is a Node module which exports an object with one function,
the handler. In the AWS examples this is usually called *handler* and I'm going
to follow their example.

Here is a simple function that can be edited invoked in the online *Lambda
Edit/Test* tool.

```javascript
// hello-event.js
exports.handler = function(event, context) {
  console.log('Hello', event);
  context.done(null, 'Success');
}
```

The event is any JSON object and since a String is a valid object it can be
invoked with `"Tapir"`, which results in the following output in Lambda tool.

```sh
Logs
----
START RequestId: 3e21d80e-7e31-11e4-912c-2f870de05098
2014-12-07T16:51:47.163Z	3e21d80e-7e31-11e4-912c-2f870de05098	Hello Tapir
END RequestId: 3e21d80e-7e31-11e4-912c-2f870de05098
REPORT RequestId: 3e21d80e-7e31-11e4-912c-2f870de05098	Duration: 3.89 ms	Billed Duration: 100 ms 	Memory Size: 128 MB	Max Memory Used: 9 MB
Message
-------
Success
```

Working in the Lambda online tool is sufficient for simple examples examples
but quickly gets annoying and once you need to add extra modules, you have to
upload zip-archives and this is both error prone and tedious. Here is a simple
script to zip relevant files and upload them to Lambda. Make sure to update the
region and the role to your own specific properties.

```sh ./upload-lambda.sh
```

## A Larger Example

Now that I know the Lambda works it is time to try out something more
elaborate. I have read that it is not only possible to get access to npm
modules but I also have access to the operating system when writing my
service.

My bigger example consists of something I often have use for, a way to serve
media files so that I don't have to check them into git. The way I want to do
this is to upload a tarball to S3 and then have Lambda unpack the archive,
checksum the files and upload them into another bucket.

Something like this:

* React to the `ObjectCreated:Put` event
* Download the tarball from S3
* Extract tarball into temp directory
* Checksum the files and rename them with the checksum
* Upload the checksummed file to another S3 bucket
* Upload an index of the files with mapping from old to new filename.

## React to `ObjectCreated:Put` event

An AWS S3 `ObjectCreated:Put` event looks something like this in a trimmed
down format


```javascript
{
  "Records": [ {
      "eventVersion": "2.0",
      "eventSource": "aws:s3",
      "eventName": "ObjectCreated:Put",
      "s3": {
        "bucket": {
          "name": "anders-source",
        },
        "object": {
          "key": "lambda.tgz",
          "size": 1024,
          "eTag": "d41d8cd98f00b204e9800998ecf8427e"
        }
      }
    }
  ]
}
```

To handle this event we need a handler function. All the handler needs to do is
to extract the relevant properties from the file and then call `assetify` which
will do the rest of the work. Breaking up the code like this allows me to use
`assetify` locally and not only as a Lambda handler.

```sh ./assetify.js snippet-handler
```

## `assetify`

In order to use `assetify` as a normal module on a local machine I export the
function with `module.exports`. This code needs to come before the
`assetify.handler` declaration above. When exported this way, it is possible to
require the function without involving Lambda.

```javascript ./assetify.js snippet-assetify
```

I'm using `async.waterfall` in combination with `bind` to get a nice flat
structure of the code which clearly resembles the described flow above.

## Download file

The `downloadFile` function uses a nice feature of `s3.getObject`, streaming.
After creating a temporary file with `tmp.file`, I create a request and then I
stream the contents from S3 directly into a write stream. Very nice! I also
need to hook up some event handler to allow me to notify the callback once the
streaming is complete.

```javascript ./assetify.js snippet-download-file
```

## Extract tarball

In order to extract the tarball I'm using the ordinary `tar` command instead of
relying on a Node module. This works fine as Lambda seems to include a full
standard AWS distribution. Very nice to have access to all the common Unix
utilities. The `glob` function makes it easy to traverse the full tree
structure of the archive and I use this to return (or pass on via callback) a
map of filenames to the temporary files.

```javascript ./assetify.js snippet-extract-tarball
```

## Checksum

`checksumFiles` uses `async.map` to call the singular version `checksumFile`.
This creates a checksum of the file and does some string manipulation in order
to create a name with a checksum in it.

```javascript ./assetify.js snippet-checksum-files
```

## Upload files to S3

When the new filenames have been created the files can now be uploaded to S3
via `s3.putObject`. Unfortunately, `putObject` does not support `pipe`, but I
can use a ReadStream as the value of the body object and this is good enough.
It uses the `mime` module to calculate the content-type from the filename.
After the file is uploaded an object with a mapping between the original name
and the URL is returned.

```javascript ./assetify.js snippet-upload-files
```

## Upload the index

The last thing to is to upload the index with the filename-to-URL map as a
JSON-file. This is done in a similar way as the upload of the images.

```javascript ./assetify.js snippet-upload-index
```
The final return value of assetify is:

```javascript
{ files:
   [ { originalFile: '/cdn-resources.js',
       url: 'https://s3-eu-west-1.amazonaws.com/anders-dest/lambda/cdn-resources-27b11be8fa67896cd7d43ade56281e1e.js' } ],
  url: 'https://s3-eu-west-1.amazonaws.com/anders-dest/lambda/index.json' }
```

## Summary

Lambda is very simple to work with and it allows me to create small services
that react to events without the need to setup any servers at all.

Apart from the integration with S3, it also integrates with Kinesis and with
DynamoDB allowing for very cook application to built.

