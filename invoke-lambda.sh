#!/bin/bash

aws lambda invoke-async \
 --function-name assetify \
 --region eu-west-1 \
 --invoke-args ./s3-event.json \
 --debug 
