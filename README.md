# Articulate Rise custom interactions

This script library is an addition to the published Rise 360 package which extends the functionality of different block types to provide extra styling and interaction capabilities.

Supported changes:

 - INTERACTION::TEXT-ENTRY - creates a textarea (which remembers what you typed)
 - INTERACTION::BUTTONS - creates a horizontal list of buttons
 - INTERACTION::DETAILS - creates an expandable section (like a one-item accordion)
 - INTERACTION::DIALOG - creates a popup overlay box
 - INTERACTION::REFERENCES - like tabs, but using buttons

 - JOURNAL::ENTRY
 - JOURNAL::BUTTONS
 - SECTION::INTRO

 - FLAG::FLOAT - applies to 'Image & Text' - Float the image to the left or right
 - FLAG::FLOATRAW - applies to 'Image & Text' - Float the image to the left or right and don't scale it
 - FLAG::MULTILINE - applies to 'Accordion' - Allow multiline headers
 - FLAG::CONTINUE - Makes a single 'Button' interaction look like a `Continue` button (so you can use internal linking)
 - FLAG::BGCOLOR - Tells the next block to use the same background colour as this block (e.g. style the Process block!)
 - FLAG::EDGECOLOR - Modifies the next blocks edge colour (if set) AND support FLAG::EDGECOLOR::#ffcc33:: modifiers in each cell (advanced)



## Thanks

Concept based on https://github.com/mikeamelang/learning-journal. 

## Why

Because clients often ask for more flexibility, and Articulate are sluggish at implementing any new features.

## How

Put the interaction.js and interaction.css into the same folder as `index.html` (different depending on what you published). Add the script file to the end of `index.html` (just before the `</body>` tag).

```html
   <script type="text/javascript" src="interactions.js"></script>
  </body>
</html>
```

For `scorm` content the index is at `scormcontent/index.html`

For `web` content the index is at `content/index.html`

TODO: support injecting this code through https://www.frumbert.org/risefix/index.php

## Notes

The formatting can be customized by using the `interactions.css` file.

If an `interactions.png` file exists in the folder, it will be used at the top of printable views.
