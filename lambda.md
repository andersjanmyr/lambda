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


## A Larger Example

## Sequence Diagram

```javascript ./assetify.js snippet-download-file
```

```javascript ./assetify.js snippet-extract-tarball
```

```javascript ./assetify.js snippet-checksum-files
```

```javascript ./assetify.js snippet-upload-files
```

```javascript ./assetify.js snippet-upload-index
```

```javascript ./assetify.js snippet-assetify
```

```sh ./upload-lambda.sh
```





