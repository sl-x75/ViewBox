# ViewBox

ViewBox is a drawing manager and CSS editor designed specifically for the BonsaiBim workflow. It uses the web-ifc library to read your project's IFC file, allowing you to view and style your 2D drawings with  CSS.


## User Guide

The application use the web-ifc to read the ifc file and extract all the necessary informations about the active drawing assets. A file watcher runs in the background, detect drawing updates or new drawings in the Ifc and update the Dom and the navigation panel. 
Important: When you generate a new drawing, you must also save the  .ifc file. The application needs the updated IFC data to identify the drawing's TargetView (e.g., "Plan View," "Section View") and Fill Mode which are essentials but also EPSet&PSet etc . If the IFC file is not saved, the new drawing will temporarily appear in an "Uncategorized" folder in the Navigation Panel and will not have the correct styling. As soon as the watcher detects the saved IFC file, it will update the interface, and the drawing will move to its correct folder and also will update the Dom(Viewer).
The same applies to underlays images

### IMPORTANT!!!  To ensure the application works correctly you need to download  specifically structured  default.css and symbols.svg 
As for the patterns  i have include a `"<rect width="100%" height="100%"/>"` to the patterns  which allow the background. 

### Saving
* Auto-Save: By default, all CSS changes and Layout manipulations are saved automatically whenever you switch to a different drawing or layout file.
* Manual Save: You can disable auto-saving in the Settings panel. If disabled, you must save your changes manually using the Save CSS button located in the bottom right corner of the window.
* Reverting Changes (Undo): If you click the "Home" icon to return to the Start Page, any unsaved changes to your CSS will be discarded. This acts as a quick "undo," reverting the drawing to its last saved state.

### How Styling Works
All styling is done with pure CSS. Your styles are saved in two places simultaneously:
1. The dedicated .css file for the drawing.
2. An internal `<style>` block inside the drawing's .svg file.
This ensures your drawing is portable and will display correctly even outside of ViewBox. To function correctly, the application requires that your patterns.svg and symbols.svg files do not contain any internal styling (e.g., fill or stroke attributes). However, because markers are not rendered directly, styling can be left within your markers.svg file. Note that the stroke-width property in markers.svg acts as a scaling factor.

## Navigating the Application
### Start Page
The number of recent project cards displayed is controllable from the Settings panel (the default is 10). The links on each project card are clickable, allowing you to open the project folder in your system's file manager or open your system's email client.
### Main Application
* Navigation Panel: The Project name used is the name used in the Spatial Decomposition. The "Drawings" accordion is automatically organized into folders based on each drawing's TargetView (e.g., Plan View, Section View). If drawings with new TargetView types are added in the future, new folders will be generated automatically. In the "Layouts" section, a toggle switch appears, allowing you to enable manipulation mode to position drawings on the layout.
* Drawing Info Panel: When a drawing is active, this panel displays its associated asset files (like stylesheets and patterns). The file paths are clickable, opening the selected file in the integrated code editor.
* Settings Panel: Here, you can customize application behavior, such as theme, auto-saving, and more.

### The Viewer area 
* Zoom: Ctrl + Mouse Wheel
* Pan: Left-Click + Drag
* Scroll: Mouse Wheel for vertical, Shift + Mouse Wheel for horizontal.
* Select Element: A single Left-Click in editing mode.


### Css Editor (Bottom panel)
Active Rule: At the far-left is displayed the active css stylesheet. 
Info Bar: This central, context-aware bar provides critical information:
1. It displays the rule name if the selected element already has one.
2. It offers to create a new rule if the element has no specific style.
3. It warns you if a pattern is already used by another rule and provides a button to Create a Copy. This opens a dialog to save the pattern with a new, unique ID, allowing you to style it independently.
4. It advises you to save the internal CSS to disk if the corresponding .css file is missing from the project's assets folder, enabling editing.
When you select an element in the viewer, this panel will populate with controls specific to that element's type (e.g., text controls for text, fill/stroke controls for shapes).
For the .PredefinedType-TEXT  and .PredefinedType-LINEWORK you can create dedicated rule to each element by adding a class in the EPSet_Annotation which the picker will detect. 

### Pattern Editor
To the right of the pattern dropdown list, you'll find a small Pattern Preview. Clicking this preview opens the Pattern Editor, where you can apply transformations (scale, rotate) and styles (fill, stroke) to the individual geometric elements inside the selected pattern.
The "Rotate" button includes an option to automatically detect angles from the selected shape in the main viewer to help align your pattern. Not very precise for now.
Something important for the .surface rules: When creating a new rule with a pattern, the element temporarily appear black. This is normal. As soon as you apply a transform or style using the Pattern Editor's controls, it will render correctly. All patterns also include a background <rect> element, allowing you to apply a background fill.
 
### Bottom bar under the CSS editor 
Below the main CSS Editor panel, there are the fallback? rules buttons and the .IfcGeographicElement and .IfcSpace . Those rules are not detectable from the picker.
#### ifcSpace Styling
When you click the .IfcSpace button, the application automatically generates a unique, persistent color for each IfcSpace in the drawing and saves these rules to your stylesheet. You can also use the radio buttons that appear to temporarily hide all IfcSpace elements.

