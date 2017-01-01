#!/bin/bash

appDir="/home/pi/git/rpi/flickr_photoframe/app"
tty=`tty`
ontty1=0

if [ $tty == "/dev/tty1" ]
then
    ontty1=1
fi

if [ $ontty1 == 1 ]
then
    echo "> On tty1. Starting flickr photo frame app..."
    $appDir/appforever.sh
    $appDir/fim-nc.sh
fi
