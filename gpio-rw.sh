#!/bin/bash

gpio mode 21 in
gpio mode 22 out

prevVal="-1"
while true
do
    val=`gpio read 21`
    if [ $prevVal != $val ]
    then
	prevVal=$val
	d=`date +"%T"`
	echo $val $d
	gpio write 22 $val
    fi
    sleep 1s
done

