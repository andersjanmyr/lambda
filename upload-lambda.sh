#!/bin/bash

program=`basename $0`

set -o errexit

function usage() {
  echo "Usage: $program <function.js>"
}

if [ $# -lt 1 ]
then
  echo 'Missing required parameters'
  usage
  exit 1
fi

main=${1%.js}
file="./${main}.js"
zip="./${main}.zip"
role='arn:aws:iam::638281126589:role/lambda_exec_role'

zip_package() {
  zip -r $zip $file lib node_modules
}



upload_package() {
  aws lambda upload-function \
     --region eu-west-1 \
     --function-name $main  \
     --function-zip $zip \
     --role $role\
     --mode event \
     --handler $main.handler \
     --runtime nodejs \
     --debug \
     --timeout 10 \
     --memory-size 128
}


# main
zip_package
upload_package

