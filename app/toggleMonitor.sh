#!/bin/bash

monitorState=$1

if [ "$monitorState" = "on" ]
then
    tvservice -p; fbset -depth 8; fbset -depth 16
else
    tvservice -o
fi
