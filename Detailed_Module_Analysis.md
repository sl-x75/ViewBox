# Detailed Module Analysis

This document provides a detailed breakdown of each major module in the application, outlining its core responsibilities, specific functionalities, and its relationships with other parts of thecodebase.

---

## 1. `main.js` (Main Process)

-   **Responsibility:**
    -   To initialize and manage the application's lifecycle, the main browser window, and handle project management tasks like opening projects and tracking recent ones.

-   **Functionality:**
    -   **`createWindow()`**: Creates a new `BrowserWindow` with a custom (frameless) title bar.
    -   **Project Management**:
        -   **Recent Projects**: Manages a `recent-projects.json` file in the user's data directory to persist a list of recently opened projects.
        -   **`addProjectToRecent()`**: Adds a new project path to the top of the recent projects list.
    -   **IPC Handling:**
        -   **Window Controls**: Listens for `minimize-window`, `maximize-window`, and `close-window` events from the renderer to manage the main window.
        -   **Project Controls**:
            -   `get-recent-projects`: Handles requests from the renderer to fetch the list of recent projects.
            -   `open-project-dialog`: Shows a system dialog to allow the user to select a project directory.
            -   `set-current-project`: Receives the path of the currently opened project from the renderer to add it to the recent list.
    -   **Content Security Policy (CSP):** Configures and applies a strict CSP to enhance security.
    -   **Development vs. Production:** Handles loading from the Vite development server or the local `dist/index.html` file.

-   **Interactions & Relationships:**
    -   **`preload.js`**: Injects this script into the renderer process.
    -   **Renderer Process (`renderer.js`)**: Communicates with the renderer via IPC (`ipcMain`, `ipcRenderer`) for window and project management.
    -   **Electron APIs**: Directly interacts with Electron's `app`, `BrowserWindow`, `session`, `ipcMain`, and `dialog` modules.

---

## 2. `src/renderer.js` (Renderer Process Entry Point)

-   **Responsibility:**
    -   To manage the application's user interface flow, acting as a Single Page Application (SPA) controller that switches between a "Start Page" and the "Main Application" view.

-   **Functionality:**
    -   **View Management**:
        -   **`showMainApp(projectPath)`**: The core function for starting the main application. It hides the start page, shows the main app view, and triggers the main app's initialization sequence. It also informs the main process about the current project.
        -   **`populateRecentProjects()`**: Fetches the list of recent projects from the main process via IPC and dynamically renders them on the start page.
    -   **Initialization Flow**:
        -   **`DOMContentLoaded`**: On startup, it initializes core event listeners for the start page and fetches/displays recent projects.
        -   **`initializeCoreEventListeners()`**: Sets up click handlers for the recent projects list and the "Open Project" button on the start page.
        -   **`initializeMainApp(projectPath)`**: This function runs only *once* when the first project is opened. It performs the main data fetching and UI setup:
            1.  Fetches data from the IFC file (asset maps, materials, etc.) using the provided `projectPath`.
            2.  Populates the central state with this data.
            3.  Initializes all major UI components and logic modules (`Coloris`, `guides.js`, `textEditor.js`, `events.js`, etc.).
    -   **File List Population**: After initialization, it calls `populateFileList` to display the file hierarchy for the selected project.

-   **Interactions & Relationships:**
    -   **`main.js`**: Communicates via IPC to get recent projects and open new ones.
    -   **`ifc-parser.js`**: Provides the `projectPath` to the parser functions to get project-specific data.
    -   **`state.js`**: Populates the application's core data at startup.
    -   **`logic/files.js`**: Uses this module to populate the file lists in the UI.
    -   **All UI/Logic Modules**: Orchestrates the initialization of all other renderer-process modules.

---

## 3. `src/state.js` (State Management)

-   **Responsibility:**
    -   To act as a centralized, in-memory store for all shared application state. It ensures a single source of truth and decouples modules.

-   **Functionality:**
    -   **`state` Object:** A private object holding all state variables (e.g., `currentCssFile`, `currentCssAST`, `drawingToAssetMap`, `currentMode`, `drawingTypeMap`, `currentPatternsFile`, `isUpdatingControls`).
    -   **Getters & Setters:** Exports functions for controlled read/write access to the state.
    -   **Modes**: The `currentMode` can now be `editing`, `manipulating`, or `viewing`.
    -   **Automatic Caching:** The `setCurrentCssContent` setter automatically parses the CSS string into a PostCSS AST, stores it, and calls `buildSelectorCache()` to create a `Map` for fast selector lookups, ensuring the cache is always synchronized.

-   **Interactions & Relationships:**
    -   **Nearly All Modules:** Almost every module interacts with `state.js`.
    -   **`postcss`**: Used within the `setCurrentCssContent` setter.
    -   **`logic/css-utils.js`**: Relies on this module to build the selector cache.

---

## 4. `src/logic/ifc-parser.js`

-   **Responsibility:**
    -   To handle parsing the project's `.ifc` file to extract metadata about drawings, materials, units, and their relationships.

-   **Functionality:**
    -   **Dynamic Path Handling**: All exported functions now accept a `projectPath` argument, removing the previous hardcoded path.
    -   **`initializeAndLoadIfc(projectPath)`**: Initializes the `web-ifc` API and loads the IFC model from the dynamically provided project path.
    -   **`getDrawingToAssetMap()`**: Builds a map of drawing filenames to their associated assets (stylesheet, patterns, etc.).
    -   **`getMaterialsFromIFC()`**: Creates a map of material names to their categories.
    -   **`getDrawingTypeMap()`**: Creates a map of drawing filenames to their types (e.g., "plan", "section").
    -   **`getProjectUnits()` (New)**: Parses the IFC file to find the project's primary length unit (e.g., "metre") by traversing the `IFCPROJECT` -> `IFCUNITASSIGNMENT` -> `IFCSIUNIT` hierarchy.

-   **Interactions & Relationships:**
    -   **`web-ifc`**: The core dependency for all IFC operations.
    -   **`renderer.js`**: The primary consumer of the data produced by the parser.

---

## 5. `src/logic/svgLoader.js`

-   **Responsibility:**
    -   To manage loading an SVG file into the viewer, setting up the correct context, and ensuring it is displayed and functions correctly.

-   **Functionality:**
    -   **State Updates:** Critically updates the central state with `isLayoutFile`, `layoutFilePath`, `currentSvgElement`, etc., which is essential for the correct functioning of saving and manipulation toggles.
    -   **Asset Loading & Style Injection**: For drawings, it uses the `drawingToAssetMap` to load the corresponding CSS and other assets, injecting the styles into the SVG.
    -   **ViewBox Management**:
        -   **`adjustViewBox`**: Implements a robust, refactored logic to automatically center and scale the SVG. It applies a generous, viewer-relative padding for "layout" files to facilitate easier off-canvas manipulation, and a tighter padding for "drawing" files.
    -   **Active Drawing Info**: When a drawing is loaded, it populates a dedicated UI panel with the drawing's metadata (Target View, Scale, etc.) and makes asset file paths (like the stylesheet) clickable to open them in the code editor.
    -   **Event Dispatching**: Dispatches a custom `svg-loaded` event on the `window` object after a file is successfully loaded, allowing other modules (like `textEditor.js`) to react.

-   **Interactions & Relationships:**
    -   **`state.js`**: Heavily interacts with the state to get the asset map and to set the current SVG element, file paths, and mode.
    -   **`files.js`, `assets.js`**: Delegates loading of CSS and other assets.
    -   **`interactions.js`, `manipulation.js`**: Sets up user interaction handlers.
    -   **`layoutProcessor.js`**: Calls this module if a layout file is loaded.

---

## 6. `src/logic/cssEditor.js`

-   **Responsibility:**
    -   To bridge the UI controls with the in-memory PostCSS AST. It contains the core logic for reading/writing CSS properties and managing the advanced pattern editor.

-   **Functionality:**
    -   **Pattern Editor (Live Preview Refactor)**:
        -   **`openPatternStyler()`**: Opens the editor and starts a "live preview session" by cloning the main CSS AST into a sandboxed `livePreviewAst`.
        -   **`updatePatternPreviewOnly()`**: Provides real-time feedback by modifying the *sandboxed AST* and injecting the resulting temporary CSS into a dedicated `<style>` tag (`#bonsai-live-preview-styles`) in the SVG. This is fast and does not modify the main stylesheet.
        -   **`commitPatternStyles()`**: Makes changes permanent. It reads the final values from the UI, finds or creates the necessary rules in the *main CSS AST*, and populates them. It then cleans up the live preview state.
        -   **`closePatternStyler()`**: Hides the panel and performs a full cleanup of the live preview session.
    -   **Pattern Copying**:
        -   **`checkPatternUsage()`**: Checks if a pattern is already used as a `fill` value in the stylesheet.
        -   **`displayPatternUsageWarning()`**: Shows a UI warning if a pattern is in use and reveals a "Create a Copy" button.
        -   **`promptForPatternCopy()`**: Opens a modal to ask the user for a new, unique ID for the copied pattern.
        -   **`handleConfirmPatternCopy()`**: Handles the logic of duplicating the pattern's HTML, updating its ID, saving it to the filesystem, and updating the state and UI.
    -   **Angle-Snapping for Patterns**:
        -   **`populateAngleSelector()`**: When the user clicks the angle-picker button, this function gets the last-picked shape from the state (`getLastPickedElement`), passes its geometry to `calculateParallelogramAngles`, and populates a dropdown with the resulting angles.
    -   **`populateControls()`**: Now uses an `isUpdatingControls` flag from the state to prevent infinite event feedback loops when programmatically setting control values that also fire `input` events (e.g., for the Coloris picker).
    -   **`updateCssRule()`**: The logic for creating new rules is now more intelligent, inserting them near related rules based on IFC material categories or before a `--- PATTERN STYLES ---` comment block in the CSS file.

-   **Interactions & Relationships:**
    -   **`state.js`**: The most critical interaction. Gets the AST, rule objects, and `lastPickedElement`, and updates `currentCssContent`.
    -   **`postcss`**: Used to create and modify AST nodes.
    -   **`logic/files.js`**: Calls `savePatternToBothLocations` for the pattern copy feature.
    -   **`logic/calculateParallelogramAngles.js`**: Consumes the angle calculation logic.
    -   `ui/events.js`: Its functions are the primary entry points, called by UI event listeners.

---

## 7. `src/interactions.js`

-   **Responsibility:**
    -   To manage direct user interactions with the SVG canvas, primarily the element picking functionality.

-   **Functionality:**
    -   **Picker Logic (`pickerHandler`)**:
        1.  **State Update**: Immediately stores the exact clicked element (`e.target`) in the global state using `setLastPickedElement()`. This allows other modules, like the pattern angle selector, to reference the user's intended shape.
        2.  **Intelligent Traversal**: Traverses up the DOM tree to find an element with meaningful classes.
        3.  **Exclusion Logic**: Ignores clicks on `.projection` elements and on generic `.cut` elements that lack a specific material class, preventing unintended selections.
        4.  **Selector Prioritization**: Constructs a prioritized list of possible CSS selectors based on a clear hierarchy (e.g., `.layer-material-Concrete` > `.surface.material-Concrete` > `.surface`).
        5.  **Efficient Lookup**: Uses `findRuleInCache()` for a fast lookup in the selector cache.
        6.  **Fallback and Rule Creation**: If a less-specific fallback rule is used, it offers the user the option to create a new, more specific rule. If no rule is found, it prepares the UI to create a new one from scratch.

-   **Interactions & Relationships:**
    -   **`state.js`**: Reads the selector cache and updates `currentRuleObject`, `newRuleSelector`, and `lastPickedElement`.
    -   **`logic/cssEditor.js`**: Calls `populateControls()` to update the UI.
    -   **DOM (SVG Element)**: Attaches event listeners to the SVG element.

---

## 8. `src/logic/files.js`

-   **Responsibility:**
    -   To abstract all direct filesystem operations for the renderer process.

-   **Functionality:**
    -   **`populateFileList()`**: Reads directory contents and injects them into the UI. It now uses the `drawingTypeMap` from the state to categorize drawings under collapsible sections (Plans, Sections, etc.) and display appropriate icons.
    -   **`saveChanges()`**: Now saves the current CSS content to *both* the external `.css` file and the internal `<style>` block of the active `.svg` file, ensuring consistency.
    -   **`saveLayout()`**: Reconstructs the layout SVG by reverting inlined drawings back to their original `<image>` link format, applying any new transformations from the manipulation mode.
    -   **Pattern Saving (New)**:
        -   **`savePatternToBothLocations()`**: Orchestrates saving a new or updated pattern.
        -   **`savePatternToReferenceFile()`**: Saves/updates a pattern in the main `patterns.svg` file.
        -   **`savePatternToCurrentDrawing()`**: Saves/updates a pattern in the current drawing's `<defs>` section (both in the live DOM and the file on disk).

-   **Interactions & Relationships:**
    -   **Node `fs/promises` & `path`**: Core dependencies for filesystem access.
    -   **`state.js`**: Gets CSS content, file paths, and `drawingTypeMap`.
    -   **`renderer.js`**: Called at startup to populate file lists.

---

## 9. `src/logic/layoutProcessor.js`

-   **Responsibility:**
    -   To handle the specialized logic for "layout" files, converting linked drawings into editable, inline content.

-   **Functionality:**
    -   **`processLayoutFile()`**:
        1.  Finds all `<image>` elements referencing `.svg` files.
        2.  For each `<image>`, it reads the referenced SVG file.
        3.  **External Stylesheet Processing**: It now checks the `drawingToAssetMap` for an associated external stylesheet. If found, it reads the CSS, scopes the rules with a unique class for the drawing instance (e.g., `.drawing-inst-1`), and appends it to a combined stylesheet for the layout.
        4.  It replaces the `<image>` with a `<g>` element, preserving its transformation.
        5.  It stores the original `<image>` attributes (x, y, transform, etc.) in a `data-original-image-attrs` attribute on the new `<g>` element, which is essential for saving the layout back to its original format.

-   **Interactions & Relationships:**
    -   **`svgLoader.js`**: Called by `svgLoader.js` when a layout file is loaded.
    -   **`state.js`**: Gets the `drawingToAssetMap` to find associated stylesheets.
    -   **Node `fs/promises`**: Reads the content of nested SVG and CSS files.

---

## 10. `src/manipulation.js`

-   **Responsibility:**
    -   To enable and manage the direct manipulation (translation, rotation, scaling) of inlined drawings within a layout.

-   **Functionality:**
    -   **`initializeManipulation()`**:
        -   Identifies target `<g>` elements for manipulation.
        -   Initializes a manipulation library on these elements.
        -   **Viewer Integration**: Calls `recreateViewer({ useMouseDrag: false })` to rebuild the `InfiniteViewer` with its own panning disabled, preventing conflicts between element dragging and canvas panning.
    -   **`destroyManipulation()`**:
        -   Properly removes manipulation handles and cleans up event listeners.
        -   **Viewer Integration**: Calls `recreateViewer({ useMouseDrag: true })` to rebuild the `InfiniteViewer` with its panning re-enabled.
    -   **`toggleManipulation()`**: Enables or disables manipulation via the UI toggle.

-   **Interactions & Relationships:**
    -   **`@scena/moveable` (or similar library)**: The core dependency providing manipulation handles.
    -   **`logic/guides.js`**: Interacts with the `recreateViewer` function to manage mouse drag behavior.
    -   **DOM (SVG Element)**: Directly modifies the `transform` attributes of `<g>` elements.

---

## 11. `src/ui/init.js` & `src/ui/events.js`

-   **Responsibility:**
    -   To set up the initial UI state and attach all event listeners to make the application interactive.

-   **Functionality (`init.js`):**
    -   **`initializeUI()`**: Sets the default state of the UI on startup (e.g., hiding the editor, showing a welcome message).
    -   **`setupUIForSvg()`**: Prepares the UI after a file is loaded.

-   **Functionality (`events.js`):**
    -   **`initializeEventListeners()`**: A master function that attaches all listeners.
        -   **File List Click Handler**: The logic is updated to explicitly set the save button's text (`Save CSS` vs. `Save Layout`) and visibility based on the type of file clicked (drawing, layout, or sheet).
        -   **Pattern Copying**: Includes listeners for the "Create a Copy" button and the pattern copy modal's confirm button.
        -   **Code Editor**: Includes listeners for opening files, saving, closing, and interacting with the new custom search-and-replace UI.
        -   **Pattern Angle Selector**: Attaches a listener to the angle selector button to populate it, and another to the dropdown options to apply the selected angle.

-   **Interactions & Relationships:**
    -   **DOM**: Directly manipulates and listens to events from HTML elements.
    -   **`renderer.js`**: The initialization functions are called from here.
    -   **`logic/*`**: The event listeners delegate all work to functions within the logic modules, acting as the connective tissue between the user and the application's core logic.

---

## 12. `src/logic/textEditor.js`

-   **Responsibility:**
    -   To manage a floating, rich-text editor for adding and editing textual annotations within a layout file.

-   **Functionality:**
    -   **SVG Integration**: Injects rich-text content into the SVG as a `<foreignObject>`. The `saveEditorContent` and `insertForeignObject` functions have been improved to correctly calculate the required height of the object after its content changes by forcing a browser reflow, preventing text from being cut off.
    -   **Interaction Management**:
        -   When the editor is active, it now disables the main canvas's pan/zoom functionality (via `disableAutoFit` and direct `InfiniteViewer` options) to provide a focused writing environment.
        -   The `addBehaviorsToForeignObject` function now uses a more robust click handler that stops event propagation, preventing accidental deselection when clicking inside an already-selected text block.

-   **Interactions & Relationships:**
    -   **`@editorjs/editorjs`**: The core dependency for rich-text editing.
    -   **`interact.js`**: Used for dragging and resizing text blocks.
    -   **`state.js`**: Interacts with the state to get the viewer instance and set modification flags.
    -   **`logic/svgLoader.js`**: Calls `disableAutoFit` and `enableAutoFit` to manage the SVG's viewBox.
    -   **`manipulation.js`**: Calls `destroyManipulation` and `initializeManipulation` to prevent conflicts.

---

## 13. `src/logic/defaultRules.js`

-   **Responsibility:**
    -   To provide a simple and direct way for users to access and edit a predefined set of common, high-level CSS rules (e.g., `.cut`, `.surface`, `.annotation`).

-   **Functionality:**
    -   **`initializeDefaultRules()`**: Checks the selector cache for predefined selectors and dynamically creates a button for each one it finds in the "Default Rules" UI section.
    -   **`initializeDefaultRulesEventListeners()`**: Attaches a delegated event listener to the button container. When a button is clicked, it retrieves the corresponding rule object from the cache and populates the main CSS editor with its data.

-   **Interactions & Relationships:**
    -   **`state.js`**: Reads the `selectorCache` and calls `setCurrentRuleObject`.
    -   **`cssEditor.js`**: Calls `populateControls()` to update the main editor UI.
    -   **`svgLoader.js`**: `initializeDefaultRules()` is called from the loader after the CSS has been processed.

---

## 14. `src/logic/assets.js`

-   **Responsibility:**
    -   To load and process external SVG assets, specifically `<pattern>` and `<marker>` definitions, making them available for styling.

-   **Functionality:**
    -   **`loadPatterns()`**: Reads a patterns file, creates a map of `pattern ID -> pattern.outerHTML`, saves it to the state, and populates the "Fill Pattern" dropdown.
    -   **`loadMarkers()`**: Does the same for SVG markers, populating the "Marker Start" and "Marker End" dropdowns.
    -   **`refreshPatterns()`**: Reloads pattern definitions and the dropdown from the reference `patterns.svg` file, ensuring consistency after changes.
    -   **`addPatternToDropdown()`**: Efficiently adds a single new pattern to the dropdown and state without a full reload.

-   **Interactions & Relationships:**
    -   **`state.js`**: Writes to the state by calling `setPatternDefs` and `setMarkerDefs`.
    -   **`svgLoader.js`**: Called by the loader based on the asset map.
    -   **DOM**: Interacts with `<select>` elements in the editor panel.

---

## 15. `src/logic/calculateParallelogramAngles.js`

-   **Responsibility:**
    -   To parse an SVG path data string (`d` attribute) and calculate the angles of its segments, with a special focus on identifying parallelograms.

-   **Functionality:**
    -   **`calculateParallelogramAngles()`**:
        1.  Takes an SVG path data string as input.
        2.  Parses various path commands (M, L, H, V, C, S, Q, T, A, Z).
        3.  Calculates the angle of each segment.
        4.  If the path is a closed quadrilateral, it returns the angles of the first two segments, assuming they represent the adjacent sides of a parallelogram.
        5.  Otherwise, it returns all calculated segment angles.

-   **Interactions & Relationships:**
    -   **`logic/cssEditor.js`**: This is the primary consumer, calling it to populate the angle selector UI for the pattern editor.

---

## 16. `src/logic/css-utils.js`

-   **Responsibility:**
    -   To provide pure utility functions for CSS-related operations.

-   **Functionality:**
    -   **`buildSelectorCache()`**: Takes a PostCSS AST and creates a `Map` of `selector string -> rule object`. This provides a highly efficient O(1) lookup for finding a rule, which is critical for the element picker's performance.
    -   **`scopeCssRules()`**: A utility function to prepend a class to CSS selectors. It is now intelligent enough to ignore ID selectors (like `#my-pattern`) and at-rules, preventing them from being incorrectly scoped.

-   **Interactions & Relationships:**
    -   **`state.js`**: `buildSelectorCache` is called from the `setCurrentCssContent` setter.
    -   **`interactions.js`**: The picker consumes the cache created by this utility.
    -   **`layoutProcessor.js`**: Uses `scopeCssRules` to isolate styles of inlined drawings.

---

## 17. `src/logic/codeEditor.js`

-   **Responsibility:**
    -   To manage a full-featured CodeMirror editor for viewing and editing files directly within the application.

-   **Functionality:**
    -   **Language Support**: Dynamically applies the correct language mode (JS, CSS, HTML, etc.) based on file extension.
    -   **Search and Replace**:
        -   Integrates CodeMirror's search functionality with a **custom-built UI panel** (`#code-editor-search-controls`) instead of the default one.
        -   **`toggleSearchPanel()`**: Shows or hides the custom search UI.
        -   **`initializeCodeEditor()`**: The setup is refactored to override CodeMirror's default `createPanel` behavior, allowing the `openSearchPanel` command (e.g., from `Cmd+F`) to trigger our custom UI instead.
        -   Provides wrapper functions (`runFindNext`, `runReplaceAll`, etc.) to trigger CodeMirror commands from the custom UI buttons.
    -   **File Operations**:
        -   **`openFileInEditor()`**: Reads and loads a file into the editor.
        -   **`saveCodeEditorContent()`**: Saves content back to the file and intelligently reloads the main SVG view if the saved file was an active asset (like the current CSS).

-   **Interactions & Relationships:**
    -   **`codemirror`**: The core dependency for text editing.
    -   **`utils/fileOperations.js`**: Used to read/write to the filesystem.
    -   **`state.js`**: Gets current asset paths to determine if a reload is needed.
    -   `ui/events.js`: Its functions are triggered by UI event listeners.

---

## 18. `src/utils/fileOperations.js`

-   **Responsibility:**
    -   To provide a centralized and promisified interface for basic file system operations, abstracting away Node's `fs/promises` module.

-   **Functionality:**
    -   **`readFileContent()`**: Asynchronously reads the content of a file.
    -   **`writeFileContent()`**: Asynchronously writes content to a file.

-   **Interactions & Relationships:**
    -   **Node `fs/promises`**: The core dependency.
    -   **`logic/codeEditor.js`**: The primary consumer, using these functions to open and save files.

---

## 19. `src/utils/errorHandler.js`

-   **Responsibility:**
    -   This module is intended to be a centralized place for handling and reporting errors throughout the application. (Currently empty, but set up for future implementation).

-   **Functionality:**
    -   (Future) Will likely export functions for logging errors to the console, displaying user-friendly error messages, and potentially reporting errors to an external service.

-   **Interactions & Relationships:**
    -   (Future) Will be imported and used by any module that performs operations that might fail, such as file I/O, network requests, or complex parsing.