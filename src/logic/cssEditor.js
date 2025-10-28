// src/logic/cssEditor.js

import postcss from 'postcss';
import {
  getCurrentCssAST, getPatternDefs, getMarkerDefs, getCurrentRuleObject, getIfcMaterialCategories, getSelectorCache,
  getNewRuleSelector as getNewRuleSelectorFromState, getFontFamilyList, getCurrentSvgElement,
  setCurrentCssContent, setCurrentRuleObject, setNewRuleSelector as setNewRuleSelectorInState, setUpdatingControls, setFontFamilyList,
} from '../state.js';
import { openPatternStyler } from './patternStyler.js';
import { initializeMarkerStyler } from './markerStyler.js';
import { isPatternUsedByOtherRules, displayPatternUsageWarning, extractPatternId } from './patternUtils.js';
import { updatePatternPreview } from './patternPreview.js';
import { getCategoryForSelector, insertRuleInCategory } from './css-utils.js';
import Coloris from '@melloware/coloris';
import { setEditorMode } from '../ui/init.js';
import { setSpaceVisualization } from './spaceColorizer.js';
import { getSetting } from './settings.js';

const goldenRatioConjugate = 0.618033988749895;

/**
+ * Scans the current SVG for IfcSpace elements and generates permanent, colored CSS rules
+ * for any that don't already have one in the stylesheet.
+ */
function generateAndInjectIfcSpaceRules() {
    const svg = getCurrentSvgElement();
    const ast = getCurrentCssAST();
    const cache = getSelectorCache();
    if (!svg || !ast) return;

    const spaceElements = svg.querySelectorAll('g.IfcSpace[ifc\\:guid]');
    if (spaceElements.length === 0) return;

    let rulesAdded = false;

    spaceElements.forEach((space, index) => {
        const guid = space.getAttribute('ifc:guid');
        if (!guid) return;

        const selector = `g[ifc\\:guid="${guid}"]`;
        if (cache.has(selector)) return; // Rule already exists

        const hue = (index * goldenRatioConjugate * 360) % 360;
        const fillColor = `hsl(${hue}, 95%, 75%)`;
        const strokeColor = `hsl(${hue}, 95%, 40%)`;

        const newRule = postcss.rule({ selector });
        newRule.append(postcss.decl({ prop: 'fill', value: fillColor }), postcss.decl({ prop: 'fill-opacity', value: '0.5' }), postcss.decl({ prop: 'stroke', value: strokeColor }), postcss.decl({ prop: 'stroke-width', value: '0.2' }), postcss.decl({ prop: 'pointer-events', value: 'none' }));

        insertRuleInCategory(ast, newRule);
        rulesAdded = true;
    });

    if (rulesAdded) {
        console.log('[CSS Editor] New IfcSpace rules generated. Updating view...');
        const newCssContent = ast.toString();
        setCurrentCssContent(newCssContent);
        const styleTag = svg.querySelector('style');
        if (styleTag) {
            styleTag.textContent = newCssContent;
        }
    }
}



document.addEventListener('DOMContentLoaded', () => {
  Coloris({ el: '.coloris' });
});

  Coloris.setInstance('.coloris-input', {
    theme: 'editor',
    themeMode: 'default', // Or 'light', this is required to enable themes
    swatches: [
      '#264653',
      '#2a9d8f',
      '#e9c46a',
      '#f4a261',
      '#e76f51',
      '#d56062',
    ]
  });


export function updateFillControlVisibility() {
  const fillType = document.getElementById('fill-type').value;
  const fillColor = document.getElementById('fill-color');
  const fillPatternCombobox = document.getElementById('fill-pattern-combobox');
  const patternPreviewContainer = document.getElementById('pattern-preview-container');

  if (fillType === 'color') {
    fillColor.style.display = 'block';
    if (fillPatternCombobox) fillPatternCombobox.style.display = 'none';
    patternPreviewContainer.style.display = 'none';
  } else { // pattern
    fillColor.style.display = 'none';
    if (fillPatternCombobox) fillPatternCombobox.style.display = 'block';
    patternPreviewContainer.style.display = 'block';
  }
}

function parseAndStoreFontFamilies(ast) {
  let masterFontFamilyString = '';
  ast.walkRules(rule => {
    if (rule.selectors.includes('text') && rule.selectors.includes('tspan')) {
      rule.walkDecls('font-family', decl => {
        masterFontFamilyString = decl.value;
      });
    }
  });

  if (masterFontFamilyString) {
    const fonts = masterFontFamilyString.split(',')
      .map(font => font.trim().replace(/^['"]|['"]$/g, ''))
      .filter(font => font);
    setFontFamilyList(fonts);
    console.log('[CSS Editor] Parsed master font list:', fonts);
  } else {
    setFontFamilyList([]);
  }
}

function populateFontFamilyCombobox() {
  const fonts = getFontFamilyList();
  const optionsContainer = document.getElementById('font-family-options');
  if (!optionsContainer) return;

  optionsContainer.innerHTML = '';

  fonts.forEach(fontName => {
    const li = document.createElement('li');
    li.className = 'combobox-int';
    li.dataset.value = fontName;
    li.textContent = fontName;
    li.setAttribute('tabindex', '-1');
    optionsContainer.appendChild(li);
  });
}

/**
 * Populates the CSS editor controls. It uses a control flag to prevent
 * event feedback loops, allowing it to safely dispatch the 'input' event
 * to update the Coloris swatches as required by the library.
 */
export function populateControls(rule) {
  setUpdatingControls(true);
  try {
    const allControls = {
      fillControlGroup: document.getElementById('fill-control-group'),
      fillSwitcher: document.getElementById('fill-switcher'),
      strokeColorControlGroup: document.getElementById('stroke-color-control-group'),
      strokeWidthControlGroup: document.getElementById('stroke-width-control-group'),
      strokeDasharrayControlGroup: document.getElementById('stroke-dasharray-control-group'),
      markerStartControlGroup: document.getElementById('marker-start-control-group'),
      markerEndControlGroup: document.getElementById('marker-end-control-group'),
      markerContentStrokeControlGroup: document.getElementById('marker-content-stroke-control-group'), // New
      markerStylerPanel: document.getElementById('marker-styler-panel'), // New
      patternPreviewContainer: document.getElementById('pattern-preview-container'),
      textControlsContainer: document.getElementById('text-controls-container'),
      fillType: document.getElementById('fill-type'),
      fillColor: document.getElementById('fill-color'),
      fillPatternInput: document.getElementById('fill-pattern-input'),
      strokeColor: document.getElementById('stroke-color'),
      strokeWidth: document.getElementById('stroke-width'),
      strokeWidthValue: document.getElementById('stroke-width-value'),
      strokeDasharray: document.getElementById('stroke-dasharray'),
      markerStart: document.getElementById('marker-start'),
      markerEnd: document.getElementById('marker-end'),
      fontFamilySelect: document.getElementById('font-family-input'),
      fontFillColor: document.getElementById('font-fill-color'),
      fontSizeInput: document.getElementById('font-size-input'),
      spaceColorizerControl: document.getElementById('space-colorizer-control'),
    };

    // THIS IS THE FIX FOR THE UI BUG: Explicitly hide all optional panels first.
    document.getElementById('fill-control-group').style.display = 'none';
    document.getElementById('fill-switcher').style.display = 'none';
    document.getElementById('stroke-color-control-group').style.display = 'none';
    document.getElementById('stroke-width-control-group').style.display = 'none';
    document.getElementById('stroke-dasharray-control-group').style.display = 'none';
    document.getElementById('marker-start-control-group').style.display = 'none';
    document.getElementById('marker-end-control-group').style.display = 'none';
    document.getElementById('marker-content-stroke-control-group').style.display = 'none';
    document.getElementById('marker-styler-panel').style.display = 'none'; // This was the missing line.
    document.getElementById('text-controls-container').style.display = 'none';

    // Reset space visualization based on user setting
    const defaultSpaceDisplay = getSetting('ifcSpace.defaultDisplay') || 'colorized';
    setSpaceVisualization(defaultSpaceDisplay);
    const spaceColorizerControl = document.getElementById('space-colorizer-control');
    if (spaceColorizerControl) {
        spaceColorizerControl.classList.add('hidden');
    }
    const colorizedRadio = document.getElementById('space-viz-colorized');
    const hiddenRadio = document.getElementById('space-viz-hidden');
    if (colorizedRadio && hiddenRadio) {
      if (defaultSpaceDisplay === 'hidden') {
        hiddenRadio.checked = true;
      } else {
        colorizedRadio.checked = true;
      }
    }
    
    const warningArea = document.getElementById('rule-title-warning-area');
    if(warningArea) warningArea.innerHTML = '';

    if (rule.selector === '.IfcSpace') {
        if (spaceColorizerControl) {
            spaceColorizerControl.classList.remove('hidden');
        }
        generateAndInjectIfcSpaceRules();
     }

    const firstSelector = rule.selector.split(',')[0].trim();
    let isTextRule;
    if (firstSelector.startsWith('path.') || firstSelector.startsWith('rect.') || firstSelector.startsWith('circle.') || firstSelector.startsWith('line.') || firstSelector.startsWith('polygon.')) {
      isTextRule = false;
    } else if (firstSelector.startsWith('text.') || firstSelector.startsWith('tspan.')) {
      isTextRule = true;
    } else {
      isTextRule = /\.PredefinedType-TEXT\b/.test(rule.selector);
    }

    if (isTextRule) {
      allControls.textControlsContainer.style.display = 'flex';        

      // Set defaults for color and font family
      allControls.fontFillColor.value = '#000000';
      allControls.fontFillColor.dispatchEvent(new Event('input', { bubbles: true }));
      allControls.fontFamilySelect.value = "'OpenGost Type B TT'";
      
      rule.walkDecls(decl => {
        const value = decl.value.trim();
        switch (decl.prop) {
          case 'fill':
            allControls.fontFillColor.value = value;
            allControls.fontFillColor.dispatchEvent(new Event('input', { bubbles: true }));
            break;
case 'font-size':
    const newSize = parseFloat(value) || 0;
    const inputElement = allControls.fontSizeInput;
    const wrapperElement = document.getElementById('font-size-control-wrapper');
    inputElement.value = newSize;
    new window.HSInputNumber(wrapperElement).init();
    break;
         case 'font-family':
           const primaryFont = decl.value.split(',')[0].trim().replace(/^['"]|['"]$/g, '');
           allControls.fontFamilySelect.value = primaryFont;
           break;
        }
      });
    } else {
      allControls.fillType.value = 'color';
      document.getElementById('fill-type-selected-text').textContent = 'Color';
      allControls.fillColor.value = '#ffffff00';
      allControls.fillColor.dispatchEvent(new Event('input', { bubbles: true }));
      allControls.strokeColor.value = '#000000';
      allControls.strokeColor.dispatchEvent(new Event('input', { bubbles: true }));
      if (allControls.fillPatternInput) allControls.fillPatternInput.value = '';

      rule.walkDecls(decl => {
        const value = decl.value.trim();
        switch (decl.prop) {
          case 'fill':
            allControls.fillControlGroup.style.display = 'flex';
            allControls.fillSwitcher.style.display = 'flex';
            if (value.startsWith('url')) {
              allControls.fillType.value = 'pattern';
              document.getElementById('fill-type-selected-text').textContent = 'Pattern';
              if (allControls.fillPatternInput) allControls.fillPatternInput.value = extractPatternId(value);
            } else {
              allControls.fillType.value = 'color';
              document.getElementById('fill-type-selected-text').textContent = 'Solid Color';
              allControls.fillColor.value = value;
              allControls.fillColor.dispatchEvent(new Event('input', { bubbles: true }));
            }
            break;
          case 'stroke':
            if (value.toLowerCase() !== 'none') {
              allControls.strokeColorControlGroup.style.display = 'block';
              allControls.strokeColor.value = value;
              allControls.strokeColor.dispatchEvent(new Event('input', { bubbles: true }));
            }
            break;
          case 'stroke-width':
            if (value.toLowerCase() !== 'none') {
              allControls.strokeWidthControlGroup.style.display = 'block';
              const sWidth = parseFloat(value);
              allControls.strokeWidth.value = sWidth;
              allControls.strokeWidthValue.textContent = sWidth;
            }
            break;
          case 'stroke-dasharray':
            allControls.strokeDasharrayControlGroup.style.display = 'block';
            allControls.strokeDasharray.value = value;
            break;
          case 'marker-start':
            allControls.markerStartControlGroup.style.display = 'block';
            document.getElementById('marker-start-value').value = value; // <-- Set hidden input
            document.getElementById('marker-start-selected-text').textContent = extractPatternId(value) || 'None'; // <-- Update visible text
            break;
          case 'marker-end':
            allControls.markerEndControlGroup.style.display = 'block';
            document.getElementById('marker-end-value').value = value; // <-- Set hidden input
            document.getElementById('marker-end-selected-text').textContent = extractPatternId(value) || 'None'; // <-- Update visible text
            break;
        }
      });

      if (rule.nodes.length === 0) {
        allControls.fillControlGroup.style.display = 'flex';
        allControls.fillSwitcher.style.display = 'flex';
        allControls.strokeColorControlGroup.style.display = 'block';
        allControls.strokeWidthControlGroup.style.display = 'block';
      }

      const finalFillType = allControls.fillType.value;
      updateFillControlVisibility();
      
      if (finalFillType === 'pattern') {
        const finalPatternUrl = allControls.fillPatternInput ? `url(#${allControls.fillPatternInput.value})` : '';
        const patternId = extractPatternId(finalPatternUrl);
       // THIS IS THE FIX: Use the 'rule' argument passed into this function,
       // not the potentially stale value from the global state.
       const isUsedElsewhere = isPatternUsedByOtherRules(finalPatternUrl, rule);
        displayPatternUsageWarning(isUsedElsewhere, patternId);
        updatePatternPreview(finalPatternUrl);
      } else {
        updatePatternPreview(null);
        displayPatternUsageWarning(false, null);
      }

      const markerStylerPanel = document.getElementById('marker-styler-panel');

      if (firstSelector.includes('PredefinedType-')) {
        const excludedMarkerTypes = [
          'PredefinedType-BREAKLINE',
          'PredefinedType-SECTION',
          'PredefinedType-BOUNDARY',
          'PredefinedType-SEALANT',
          'PredefinedType-FILLAREA',
          'PredefinedType-IMAGE',
          'PredefinedType-LINEWORK'
        ];
        const isExcluded = excludedMarkerTypes.some(type => firstSelector.includes(type));

        if (!isExcluded) {
          allControls.markerStartControlGroup.style.display = 'block';
          allControls.markerEndControlGroup.style.display = 'block';
          
          const markerStart = rule.some(i => i.prop === 'marker-start');
          const markerEnd = rule.some(i => i.prop === 'marker-end');
          console.log(`[populateControls] markerStart found: ${markerStart}, markerEnd found: ${markerEnd}`);

          if (markerStart || markerEnd) {;
               initializeMarkerStyler(rule);
           } else if (markerStylerPanel) {
              markerStylerPanel.classList.add('hidden');
          }
        } else if (markerStylerPanel) {
          markerStylerPanel.classList.add('hidden');
        }
      } else if (markerStylerPanel) {
        markerStylerPanel.classList.add('hidden');
      }
    }

    refreshPatternEditor();

  } finally {
    setUpdatingControls(false);
  }
}


/**
 * Synchronizes the live SVG's <defs> with all url() references in the CSS AST.
 * This ensures patterns and markers are always available for rendering.
 * @param {SVGElement} svgElement The live SVG element in the DOM.
 * @param {postcss.Root} ast The PostCSS AST of the current stylesheet.
 */
export function syncDefs(svgElement, ast) {
  if (!svgElement || !ast) return;

  let defs = svgElement.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svgElement.insertBefore(defs, svgElement.firstChild);
  }

  const patternDefs = getPatternDefs();
  const markerDefs = getMarkerDefs();
  const requiredIds = new Set();

  // 1. Walk the entire AST to find all url(#...) references.
  ast.walkDecls(decl => {
    const urlMatch = decl.value.match(/url\(#(.+?)\)/);
    if (urlMatch) {
      requiredIds.add(urlMatch[1]);
    }
  });

  // 2. For each required ID, check if its definition exists in the DOM. If not, inject it.
  requiredIds.forEach(id => {
    if (!defs.querySelector(`#${id}`)) {
      const defHTML = patternDefs[id] || markerDefs[id];
      if (defHTML) {
        defs.insertAdjacentHTML('beforeend', defHTML);
      }
    }
  });
}

function getUIControlValues() {
  return {
    // Main CSS Controls
    fillControlGroup: document.getElementById('fill-control-group'),
    strokeColorControlGroup: document.getElementById('stroke-color-control-group'),
    strokeWidthControlGroup: document.getElementById('stroke-width-control-group'),
    strokeDasharrayControlGroup: document.getElementById('stroke-dasharray-control-group'),
    markerStartControlGroup: document.getElementById('marker-start-control-group'),
    markerEndControlGroup: document.getElementById('marker-end-control-group'),
    fillType: document.getElementById('fill-type'),
    fillColor: document.getElementById('fill-color'),
    fillPatternInput: document.getElementById('fill-pattern-input'),
    strokeColor: document.getElementById('stroke-color'),
    strokeWidth: document.getElementById('stroke-width'),
    strokeDasharray: document.getElementById('stroke-dasharray'),
    markerStart: document.getElementById('marker-start-value'),
    markerEnd: document.getElementById('marker-end-value'),
    // Text Controls
    textControlsContainer: document.getElementById('text-controls-container'),
    fontFamilySelect: document.getElementById('font-family-input'),
    fontFillColor: document.getElementById('font-fill-color'),
    fontSizeInput: document.getElementById('font-size-input'),
    // Symbol Controls
    symbolControls: document.getElementById('symbol-editor-controls'),
    symbolFillColor: document.getElementById('symbol-fill-color'),
    symbolStrokeColor: document.getElementById('symbol-stroke-color'),
    symbolStrokeWidth: document.getElementById('symbol-stroke-width'),
  };
}

function appendDeclsToRule(rule, controls) {
  // Determine the current editing context by checking which panel is visible
  const isSymbolMode = controls.symbolControls.style.display === 'flex';
  const isTextMode = controls.textControlsContainer.style.display === 'flex';

  if (isSymbolMode) {
    // --- CONTEXT: Editing a Symbol's Sub-Element ---
    // Read values directly from the simple symbol controls.
    const fillValue = controls.symbolFillColor.value;
    const strokeValue = controls.symbolStrokeColor.value;
    const strokeWidthValue = controls.symbolStrokeWidth.value;

    if (fillValue) rule.append({ prop: 'fill', value: fillValue });
    if (strokeValue) rule.append({ prop: 'stroke', value: strokeValue });
    if (strokeWidthValue) rule.append({ prop: 'stroke-width', value: strokeWidthValue });

  } else if (isTextMode) {
    // --- CONTEXT: Editing a Text Element ---
    const fontColor = controls.fontFillColor.value;
    const fontSize = controls.fontSizeInput.value;
    const fontFamily = controls.fontFamilySelect.value;

    if (fontColor) rule.append({ prop: 'fill', value: fontColor });
    if (fontSize) rule.append({ prop: 'font-size', value: `${fontSize}px` });
    if (fontFamily) rule.append({ prop: 'font-family', value: `'${fontFamily}'` });
    rule.append({ prop: 'stroke', value: 'none' });

  } else {
    // --- CONTEXT: Editing a standard CSS Material/Shape ---
    // This is the original logic that reads from the complex controls.
    if (controls.fillControlGroup.style.display !== 'none') {
      let fillValue;
      if (controls.fillType.value === 'color') {
        fillValue = controls.fillColor.value;
      } else {
        const patternId = controls.fillPatternInput.value;
        if (patternId) {
          fillValue = `url(#${patternId})`;
        }
      }
      if (fillValue) rule.append({ prop: 'fill', value: fillValue });
    }
    if (controls.strokeColorControlGroup.style.display !== 'none') {
      rule.append({ prop: 'stroke', value: controls.strokeColor.value });
    }
    if (controls.strokeWidthControlGroup.style.display !== 'none') {
      rule.append({ prop: 'stroke-width', value: controls.strokeWidth.value });
    }
    if (controls.strokeDasharrayControlGroup.style.display !== 'none' && controls.strokeDasharray.value) {
      rule.append({ prop: 'stroke-dasharray', value: controls.strokeDasharray.value });
    }
    if (controls.markerStartControlGroup.style.display !== 'none' && controls.markerStart.value) {
      rule.append({ prop: 'marker-start', value: controls.markerStart.value });
    }
    if (controls.markerEndControlGroup.style.display !== 'none' && controls.markerEnd.value) {
      rule.append({ prop: 'marker-end', value: controls.markerEnd.value });
    }
  }
}

export { parseAndStoreFontFamilies, populateFontFamilyCombobox };

export function updateCssRule() {
  const ast = getCurrentCssAST();
  if (!ast) {
    console.error("Cannot update rule: CSS AST not found in state.");
    return;
  }

  let targetRule = getCurrentRuleObject();
  const newRuleSelector = getNewRuleSelectorFromState();
  const ruleTitleContainer = document.getElementById('rule-title-container');
  const ruleTitleText = document.getElementById('rule-title-text');

  if (!targetRule) {
    if (!newRuleSelector) {
      console.error("updateCssRule was called but there is no current rule to update or new rule to create. Aborting.");
      return;
    }
    
    // --- START: THIS IS THE CORRECTED LOGIC BLOCK ---
    let finalSelector;
    let baseName;

    if (newRuleSelector.includes('text.') || newRuleSelector.includes('tspan.')) {
      // Case 1: Handles text rules like 'text.DIMENSION'
      finalSelector = newRuleSelector;
      const match = newRuleSelector.match(/text\.([^,]+)/);
      baseName = match ? match[1] : 'unknown';
    } else if (newRuleSelector.startsWith('#')) {
      // Case 2: Handles specific symbol sub-element rules like '#symbol-id > path:nth-of-type(1)'
      finalSelector = newRuleSelector;
      const symbolIdMatch = newRuleSelector.match(/^#([^\s>]+)/);
      baseName = symbolIdMatch ? symbolIdMatch[1] : 'symbol-override';
    } else if (newRuleSelector.startsWith('.')) {
      // Case 3: Handles all pre-formed class-based rules.
      const isSimpleMaterial = newRuleSelector.startsWith('.material-') && !newRuleSelector.includes('.surface');
      const isLayerMaterial = newRuleSelector.startsWith('.layer-material-');

      if (isSimpleMaterial || isLayerMaterial) {
        if (isSimpleMaterial) {
            baseName = newRuleSelector.substring('.material-'.length);
        } else {
            baseName = newRuleSelector.substring('.layer-material-'.length);
        }
        finalSelector = `.material-${baseName}, .layer-material-${baseName}`;
        console.log(`%cCSS Editor: Detected material class. Creating/updating grouped selector: '${finalSelector}'`, 'color: green');
      } else {
        finalSelector = newRuleSelector;
        baseName = newRuleSelector.substring(newRuleSelector.lastIndexOf('.') + 1);
      }
    } else {
      // Case 4: This case is now reserved for legacy or direct calls with a base name.
      baseName = newRuleSelector;
      finalSelector = `.material-${baseName}, .layer-material-${baseName}`;
      console.log(`%cCSS Editor: Creating grouped selector from base name: '${finalSelector}'`, 'color: green');
    }
    // --- END: CORRECTED LOGIC BLOCK ---

    const newRule = postcss.rule({ selector: finalSelector });
    const controls = getUIControlValues();
    appendDeclsToRule(newRule, controls);

// --- START: NEW CATEGORIZED INSERTION LOGIC ---
const category = getCategoryForSelector(finalSelector);
let targetNode = null;
let lastRuleInNode = null;

// Find the category comment (use first match only)
// In your insertion logic in cssEditor.js
ast.walkComments(comment => {
    console.log('Comment found:', JSON.stringify(comment.text.trim()));
    console.log('Looking for category:', category);
  if (!targetNode) {
    const commentText = comment.text.trim();
    // Extract text between --- markers
    const match = commentText.match(/^---\s*(.+?)\s*---$/);
    if (match && match[1] === category) {
      targetNode = comment;
    }
  }
});

if (targetNode) {
    // Find the last rule within this category block
    let nextNode = targetNode.next();
    while(nextNode && nextNode.type !== 'comment') {
        if (nextNode.type === 'rule') {
            lastRuleInNode = nextNode;
        }
        nextNode = nextNode.next();
    }

    // Insert after the last rule in the category, or after the comment if no rules exist
    if (lastRuleInNode) {
        lastRuleInNode.after(newRule);
    } else {
        targetNode.after(newRule);
    }
    newRule.raws.before = '\n';
} else {
    // Fallback: If no category comment is found, append to the end
    console.warn(`No category block found for: ${category}`);
    ast.append(newRule);
    newRule.raws.before = '\n';
}
// --- END: NEW CATEGORIZED INSERTION LOGIC ---

targetRule = newRule;

  } else {
    targetRule.removeAll();
    const controls = getUIControlValues();
    appendDeclsToRule(targetRule, controls);
  }

  const newCssContent = ast.toString();
  setCurrentCssContent(newCssContent);

  const newCache = getSelectorCache();
  const firstSelector = targetRule.selector.split(',')[0].trim();
  const updatedRuleReference = newCache.get(firstSelector);

  if (updatedRuleReference) {
    setCurrentRuleObject(updatedRuleReference);
    
    if (newRuleSelector) {
      setNewRuleSelectorInState(null);
      ruleTitleContainer.classList.remove('input-create-mode');
      ruleTitleText.textContent = updatedRuleReference.selector;
      console.log(`New rule created and UI updated: ${updatedRuleReference.selector}`);
    }
    
  } else {
    console.error('Failed to find updated rule reference in new AST for selector:', targetRule.selector);
  }

  const svgElement = document.querySelector('#svg-viewer-content svg');
  if (svgElement) { // The '&& updatedRuleReference' check is removed for robustness
    // --- THIS IS THE FIX ---
    // Call the new, robust sync function.
    syncDefs(svgElement, ast);
    let styleTag = svgElement.querySelector('style');
    if (styleTag) {
      styleTag.textContent = newCssContent;
    }
  }
}

function refreshPatternEditor() {
  const panel = document.getElementById('pattern-editor-panel');
  if (panel && !panel.classList.contains('hidden')) {
    console.log('[Sync] Refreshing open pattern editor...');
    openPatternStyler();
  }
}



/**
 * Populates the DEDICATED SYMBOL CONTROLS using the properties from a CSS rule.
 * This is used when editing a symbol's sub-element.
 * @param {postcss.Rule} rule The CSS rule to read values from.
 */
function populateSymbolControlsFromRule(rule) {
  setUpdatingControls(true);
  try {
    // --- 1. Get Control References ---
    const symbolControls = document.getElementById('symbol-editor-controls');
    const fillColorInput = document.getElementById('symbol-fill-color');
    const strokeColorInput = document.getElementById('symbol-stroke-color');
    const strokeWidthInput = document.getElementById('symbol-stroke-width');
    const strokeWidthValue = document.getElementById('symbol-stroke-width-value');

    // --- 2. Ensure Correct UI is Visible ---
    // Hide all other control panels and show only the symbol controls.
    setEditorMode('css'); // Start with a clean CSS slate.
    document.querySelectorAll('#css-editor-container > .control-group, #css-editor-container > #fill-switcher, #text-controls-container').forEach(el => {
        el.style.display = 'none';
    });
    symbolControls.style.display = 'flex'; // Explicitly show the correct panel.

    // --- 3. Populate Values ---
    // Set defaults
    fillColorInput.value = '#ffffff00';
    strokeColorInput.value = '#000000';
    strokeWidthInput.value = 0.2;
    strokeWidthValue.textContent = '0.2';

    // Read from the passed-in rule
    rule.walkDecls(decl => {
      switch (decl.prop) {
        case 'fill':
          fillColorInput.value = decl.value;
          break;
        case 'stroke':
          strokeColorInput.value = decl.value;
          break;
        case 'stroke-width':
          const width = parseFloat(decl.value) || 0.2;
          strokeWidthInput.value = width;
          strokeWidthValue.textContent = width;
          break;
      }
    });

    // --- 4. Update Coloris Swatches ---
    fillColorInput.dispatchEvent(new Event('input', { bubbles: true }));
    strokeColorInput.dispatchEvent(new Event('input', { bubbles: true }));

  } finally {
    setUpdatingControls(false);
  }
}

// --- ADD THIS ENTIRE NEW FUNCTION ---
/**
 * Populates ONLY the simple symbol controls (fill, stroke, width) from a rule.
 * This is a "gentle" update that does not change the overall UI mode.
 * @param {postcss.Rule} rule The CSS rule to read values from.
 */
export function populateSimpleSymbolControls(rule) {
  setUpdatingControls(true);
  try {
    const fillColorInput = document.getElementById('symbol-fill-color');
    const strokeColorInput = document.getElementById('symbol-stroke-color');
    const strokeWidthInput = document.getElementById('symbol-stroke-width');
    const strokeWidthValue = document.getElementById('symbol-stroke-width-value');

    // Set defaults
    fillColorInput.value = '#ffffff00';
    strokeColorInput.value = '#000000';
    strokeWidthInput.value = 0.2;
    strokeWidthValue.textContent = '0.2';

    // Read from the passed-in rule
    rule.walkDecls(decl => {
      switch (decl.prop) {
        case 'fill': fillColorInput.value = decl.value; break;
        case 'stroke': strokeColorInput.value = decl.value; break;
        case 'stroke-width':
          const width = parseFloat(decl.value) || 0.2;
          strokeWidthInput.value = width;
          strokeWidthValue.textContent = width;
          break;
      }
    });

    // Update Coloris swatches
    fillColorInput.dispatchEvent(new Event('input', { bubbles: true }));
    strokeColorInput.dispatchEvent(new Event('input', { bubbles: true }));
  } finally {
    setUpdatingControls(false);
  }
}


/**
 * Finds or creates a rule for a specific sub-element and populates the
 * simple symbol editor controls to style it.
 * @param {string} symbolId The ID of the parent symbol.
 * @param {string} tag The tag name of the sub-element.
 * @param {number} index The zero-based index of the element.
 */
export function findAndPopulateSubElement(symbolId, tag, index) {
  const ast = getCurrentCssAST();
  const selectorCache = getSelectorCache();
  const symbolElement = document.querySelector(`#svg-viewer-content svg defs g#${symbolId}`);
  if (!symbolElement) return;

  // --- START: CORRECT NTH-OF-TYPE CALCULATION ---
  // Find out how many elements of the same tag appear before this one.
  let typeIndex = 0;
  for (let i = 0; i < index; i++) {
    if (symbolElement.children[i].tagName.toLowerCase() === tag) {
      typeIndex++;
    }
  }
  const nthOfTypeIndex = typeIndex + 1;
  // --- END: CORRECT CALCULATION ---

  const specificSelector = `#${symbolId} > ${tag}:nth-of-type(${nthOfTypeIndex})`;

  document.getElementById('rule-title-text').textContent = specificSelector;

  const existingRule = selectorCache.get(specificSelector);

  if (existingRule) {
    setCurrentRuleObject(existingRule);
    setNewRuleSelectorInState(null);
    populateSimpleSymbolControls(existingRule);
  } else {
    // Inherit from generic style (which is now based on the first element)
    const monolithicSelectorRegex = new RegExp(`^#${symbolId}\\s`);
    let genericRule = null;
    ast.walkRules(monolithicSelectorRegex, rule => { genericRule = rule; });
    
    const tempRule = postcss.rule({ selector: specificSelector });
    if (genericRule) { // Fallback for old monolithic rules if they exist
      genericRule.each(decl => { tempRule.append(decl.clone()); });
    } else { // New logic: try to inherit from the first element's style
      const firstChild = symbolElement.querySelector('path, circle, rect, line, polygon, polyline, text');
      if (firstChild) {
        const firstChildSelector = `#${symbolId} > ${firstChild.tagName.toLowerCase()}:nth-of-type(1)`;
        const firstChildRule = selectorCache.get(firstChildSelector);
        if (firstChildRule) {
          firstChildRule.each(decl => { tempRule.append(decl.clone()); });
        }
      }
    }

    setNewRuleSelectorInState(specificSelector);
    setCurrentRuleObject(null); 
    populateSimpleSymbolControls(tempRule);
  }
}