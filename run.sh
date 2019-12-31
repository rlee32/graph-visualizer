#!/bin/sh

VERSION=v5

ORIGINAL_NAME=d3.$VERSION.min.js
wget https://d3js.org/$ORIGINAL_NAME
mv $ORIGINAL_NAME d3.min.js

echo "Open index.html in a web browser."
python3 -m http.server


