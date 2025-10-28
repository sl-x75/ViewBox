// src/state.js

import postcss from 'postcss';
import { buildSelectorCache } from './logic/css-utils.js';

/**
 * A centralized store for all shared application state.
 * This helps to avoid prop-drilling and provides a single source of truth.
 */

const state = {
  // The map of drawing filenames to their types, now inside the main state object.
 drawingTargetViewMap: {},
  // The absolute path to the currently loaded .css file
  currentCssFile: null,
  // The string content of the currently loaded stylesheet
  currentCssContent: '',
  // A map from drawing filenames to their associated assets (CSS, patterns, etc.)
  drawingToAssetMap: {},
  // A map of pattern IDs to their SVG <pattern> element string
  patternDefs: {},
  // A map of marker IDs to their SVG <marker> element string
  markerDefs: {},
  // A map of symbol IDs to their SVG <g> element string
  symbolDefs: {},
  // The full text of the currently selected CSS rule (e.g., ".MyClass { fill: #F00; }")
  currentRuleBlock: '',
  // The current operational mode of the application ('editing' or 'manipulating')
  currentMode: 'editing',
  // The currently loaded SVG DOM element
  currentSvgElement: null,
  // The absolute path to the currently loaded patterns.svg file
  currentPatternsFile: null, 
  // The absolute path to the currently loaded markers.svg file
  currentMarkersFile: null,

  currentSymbolsFile: null,
  currentSymbol: null,

  // New properties for layout functionality
  isLayoutFile: false, // true if a layout file is loaded, false for a drawing
  originalLayoutContent: '', // Stores the original raw SVG content of the layout file
  layoutFilePath: '', // The absolute file path of the currently loaded layout
  manipulationEnabled: true, // The state of the manipulation toggle (enabled/disabled)
  layoutModified: false, // Tracks if any transformations have been applied to the layout
  inlinedDrawings: new Map(), // Maps inlined group IDs to their original <image> data
  guides: null, // Will hold the @scena/guides instance
  svgGuidePositions: { horizontal: [], vertical: [] }, // Stores guide positions in SVG coordinates
  scrollPos: { x: 0, y: 0 }, // Stores the current scroll position of the SVG canvas
  currentCssAST: null, // The PostCSS Abstract Syntax Tree of the current stylesheet
  currentRuleObject: null, // The actual PostCSS Rule object that is currently selected
  ifcMaterialCategories: {}, // A map of material names to their IFC-defined category
  newRuleSelector: null, // Holds the selector for a rule to be newly created
  selectorCache: new Map(), // Caches selector strings to their PostCSS rule objects for fast lookups
  lastPickedElement: null, // Holds the actual DOM element selected by the picker
 isUpdatingControls: false, // Flag to prevent UI event feedback loops
 isCssReadOnly: false,
 fontFamilyList: [],

};

// --- Getters ---

export const getCurrentCssFile = () => state.currentCssFile;
export const getCurrentCssContent = () => state.currentCssContent;
export const getDrawingToAssetMap = () => state.drawingToAssetMap;
export const getPatternDefs = () => state.patternDefs;
export const getMarkerDefs = () => state.markerDefs;
export const getSymbolDefs = () => state.symbolDefs;
export const getCurrentRuleBlock = () => state.currentRuleBlock;
export const getCurrentMode = () => state.currentMode;
export const isEditing = () => state.currentMode === 'editing';
export const isManipulating = () => state.currentMode === 'manipulating';
export const getCurrentSvgElement = () => state.currentSvgElement;
export const getCurrentPatternsFile = () => state.currentPatternsFile;
export const getCurrentMarkersFile = () => state.currentMarkersFile;
export const getCurrentSymbolsFile = () => state.currentSymbolsFile;
export const getCurrentSymbol = () => state.currentSymbol;

// New getters
export const getIsLayoutFile = () => state.isLayoutFile;
export const getOriginalLayoutContent = () => state.originalLayoutContent;
export const getLayoutFilePath = () => state.layoutFilePath;
export const getManipulationEnabled = () => state.manipulationEnabled;
export const getLayoutModified = () => state.layoutModified;
export const getInlinedDrawings = () => state.inlinedDrawings;
export const getGuides = () => state.guides;
export const getSvgGuidePositions = () => state.svgGuidePositions;
export const getScrollPos = () => state.scrollPos;
export const getViewer = () => state.viewer;
export const getCurrentCssAST = () => state.currentCssAST;
export const getCurrentRuleObject = () => state.currentRuleObject;
export const getIfcMaterialCategories = () => state.ifcMaterialCategories;
export const getNewRuleSelector = () => state.newRuleSelector;
export const getSelectorCache = () => state.selectorCache;
export const getLastPickedElement = () => state.lastPickedElement;
export const isUpdatingControls = () => state.isUpdatingControls;
export const getIsCssReadOnly = () => state.isCssReadOnly;
export const getFontFamilyList = () => state.fontFamilyList;


// --- START: MODIFIED SECTION ---
// Getter now reads from the main state object
export const getDrawingTargetViewMap = () => state.drawingTargetViewMap;
// --- END: MODIFIED SECTION ---


// --- Setters ---

export const setCurrentCssFile = (path) => {
  state.currentCssFile = path;
};
export const setCurrentCssContent = (content) => {
  state.currentCssContent = content;
  try {
    const ast = postcss.parse(content, { from: getCurrentCssFile() || undefined });
    setCurrentCssAST(ast);
  } catch (error) {
    console.error('❌ Failed to parse CSS and rebuild cache:', error);
    setCurrentCssAST(postcss.root()); // Ensure AST is a valid empty root on error
  }
};
export const setDrawingToAssetMap = (map) => {
  state.drawingToAssetMap = map;
};
export const setPatternDefs = (defs) => {
  state.patternDefs = defs;
};
export const setMarkerDefs = (defs) => {
  state.markerDefs = defs;
};
export const setSymbolDefs = (defs) => {
  state.symbolDefs = defs;
};
export const setCurrentRuleBlock = (rule) => {
  state.currentRuleBlock = rule;
};
// --- Find and REPLACE the setCurrentMode function ---
export const setCurrentMode = (mode) => {
  // Add 'viewing' as a valid mode
  if (mode !== 'editing' && mode !== 'manipulating' && mode !== 'viewing') {
    console.error(`Invalid mode set: ${mode}`);
    return;
  }
  state.currentMode = mode;
  console.log(`[State] Mode changed to: ${state.currentMode}`);
};
export const setCurrentSvgElement = (element) => {
  state.currentSvgElement = element;
};

// New setters
export const setIsLayoutFile = (isLayout) => {
  state.isLayoutFile = isLayout;
};
export const setOriginalLayoutContent = (content) => {
  state.originalLayoutContent = content;
};
export const setLayoutFilePath = (path) => {
  state.layoutFilePath = path;
};
export const setManipulationEnabled = (isEnabled) => {
  state.manipulationEnabled = isEnabled;
};
export const setLayoutModified = (isModified) => {
  state.layoutModified = isModified;
};
export const setGuides = (guidesInstance) => {
  state.guides = guidesInstance;
};
export const setSvgGuidePositions = (positions) => {
  state.svgGuidePositions = positions;
};
export const setScrollPos = (pos) => {
  state.scrollPos = pos;
};
export const setViewer = (viewerInstance) => {
  state.viewer = viewerInstance;
};
export const setCurrentCssAST = (ast) => {
  state.currentCssAST = ast;
  // Automatically rebuild the selector cache whenever the AST changes.
  if (ast) {
    const cache = buildSelectorCache(ast);
    setSelectorCache(cache);
    console.log('✅ Selector cache rebuilt from new AST.');
  }
};
export const setCurrentRuleObject = (rule) => {
  state.currentRuleObject = rule;
};
export const setIfcMaterialCategories = (categories) => {
  state.ifcMaterialCategories = categories;
};
export const setNewRuleSelector = (selector) => {
  state.newRuleSelector = selector;
  console.log(`state.js: newRuleSelector set to: "${selector}"`); // <--- ADD THIS LOG

};
export const setSelectorCache = (cache) => {
  state.selectorCache = cache;
};

export const setCurrentPatternsFile = (path) => {
  state.currentPatternsFile = path;
};

export const setCurrentMarkersFile = (path) => {
    state.currentMarkersFile = path;
};
export const setCurrentSymbolsFile = (path) => {
  state.currentSymbolsFile = path;
};
export const setCurrentSymbol = (symbol) => {
  state.currentSymbol = symbol;
};

export const setDrawingTargetViewMap = (map) => {
  state.drawingTargetViewMap = map;
};

export const setLastPickedElement = (element) => {
  state.lastPickedElement = element;
};

export const setUpdatingControls = (status) => {
  state.isUpdatingControls = status;
};

// --- START: NEW ---
export const setIsCssReadOnly = (isReadOnly) => {
  state.isCssReadOnly = isReadOnly;
  console.log(`[State] CSS Read-Only mode set to: ${isReadOnly}`);
};
// --- END: NEW ---

// --- START: NEW ---
export const setFontFamilyList = (fonts) => {
  state.fontFamilyList = fonts;
};
// --- END: NEW ---