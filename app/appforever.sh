#!/bin/bash

# requires node forever module to be installed globally
appDir=/home/pi/git/rpi/flickr_photoframe/app/
appLog=$appDir/app.log
errLog=$appDir/err.log
minUptime=1000
spinSleepTime=3000

echo "> Flickr photoframe app directory is $appDir"
echo "> Flickr photoframe app log file is $appLog"
echo "> Flickr photoframe app error log file is $errLog"

cd $appDir
forever stopall
forever start --killSignal=SIGINT -a --sourceDir $appDir -l forever.log -o $appLog -e $errLog.log --minUptime $minUptime --spinSleepTime $spinSleepTime bin/www
