#!/bin/bash

appDir=/home/pi/git/rpi/flickr_photoframe/app/
echo "> Fim server: Flickr photoframe app directory is $appDir"
cd $appDir
fim -a -T 1 -q -c 'while(1){popen "nc -l -p 4000";}'
