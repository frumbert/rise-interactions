# Articulate Rise custom interactions

This script library is an addition to the published Rise 360 package which extends the functionality of different block types to provide extra styling and interaction capabilities.

## Thanks

Concept based on https://github.com/mikeamelang/learning-journal. 

## Why

Because clients often ask for more flexibility, and Articulate are sluggish at implementing any new features.

## How

Publish your package, then copy the script/style files to the `scormcontent` folder inside the zip, and modify the `index.html` in the same location to include the following lines into the `head` tag (alongside other scripts).

TODO: support injecting this code through https://www.frumbert.org/risefix/index.php


```
<link type="text/css" rel="stylesheet" href="interactions.css">
<script src="interactions.js"></script>
```

## Notes

The formatting can be customized by using the Learningjournal.css file.
