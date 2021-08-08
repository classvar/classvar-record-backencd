#!/bin/bash

ffmpeg -f concat -i video_list.txt -c copy concated.mp4
