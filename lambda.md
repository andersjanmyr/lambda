# Lambda, Javascript Micro-Services on AWS

Amazon just released a bunch of new services. My favorite is Lambda.
Lambda allows me to deploy simple micro-services without having to setup any
servers at all. Everything is hosted in the AWS cloud. Another cool thing
about Lambda services is that the default runtime is Node.js!

Let's get started. A lambda service is a Node module which exports an object
with one function, the handler. In the AWS examples this is usually called
handler so I'm going to follow their example.

```
// hello-tapir.js
module.exports = function(event, context) {
  console.log('Hello Tapir!');
  context.done(null, 'Success');
}
```


