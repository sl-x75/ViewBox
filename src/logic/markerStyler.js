// src/logic/markerStyler.js

import postcss from 'postcss';
import {
  getCurrentCssAST,
  getMarkerDefs,
  setCurrentCssContent,
  getSelectorCache,
  setUpdatingControls,
  getCurrentRuleObject,
  getCurrentSvgElement
} from '../state.js';
import { insertRuleInCategory } from './css-utils.js';
import { colorNameToHex } from './patternUtils.js';

let currentMarkerIds = [];

/**
 * Initializes the marker styler for a given rule.
 * @param {postcss.Rule} rule The PostCSS rule object for the element with markers.
 */
export function initializeMarkerStyler(rule) {
  console.log('[markerStyler] Initializing for rule:', rule.selector);
  const panel = document.getElementById('marker-styler-panel');
  if (!panel) {
    console.error('[markerStyler] Panel not found!');
    return;
  }

  currentMarkerIds = [];
  rule.walkDecls(/marker-start|marker-end/, decl => {
    const id = decl.value.match(/url\(#(.*?)\)/)?.[1];
    if (id && !currentMarkerIds.includes(id)) {
      currentMarkerIds.push(id);
    }
  });
  console.log('[markerStyler] Found marker IDs:', currentMarkerIds);

  if (currentMarkerIds.length > 0) {
    console.log('[markerStyler] Markers found, showing panel and populating.');
    panel.classList.remove('hidden');
    panel.style.display = 'flex'; // Use flex as it's an items-center container
    populateMarkerSubElementSelector();
  } else {
    console.log('[markerStyler] No marker URLs found in rule, hiding panel.');
    panel.classList.add('hidden');
    panel.style.display = 'none';
  }
}

/**
 * Populates the sub-element dropdown for the currently active markers.
 */
function populateMarkerSubElementSelector() {
  console.log('[markerStyler] Populating sub-element selector.');
  const selectorDropdown = document.getElementById('marker-sub-element-options');
  const selectedText = document.getElementById('marker-sub-element-selected-text');
  selectorDropdown.innerHTML = '';

  if (currentMarkerIds.length === 0) {
    selectedText.textContent = 'No Marker';
    return;
  }

  const markerDefs = getMarkerDefs();
  const currentSvg = getCurrentSvgElement();
  const subElements = new Set();

  currentMarkerIds.forEach(id => {
    let markerHTML = markerDefs[id];
    console.log(`[markerStyler] Searching for #${id}. Found in global defs: ${!!markerHTML}`);

    if (!markerHTML && currentSvg) {
      const inlineMarker = currentSvg.querySelector(`defs > marker#${id}`);
      if (inlineMarker) {
        markerHTML = inlineMarker.outerHTML;
        console.log(`[markerStyler] Found #${id} in inline SVG <defs>.`);
      }
    }

    if (markerHTML) {
      console.log(`[markerStyler] Parsing HTML for #${id}:`, markerHTML);
      const parser = new DOMParser();
      const doc = parser.parseFromString(markerHTML, 'image/svg+xml');
      const markerElement = doc.querySelector('marker');
      if (markerElement) {
        const allShapes = markerElement.querySelectorAll('path, line, rect, circle, polygon, polyline');
        console.log(`[markerStyler] Found ${allShapes.length} shapes with querySelectorAll.`);
        allShapes.forEach(shape => {
          subElements.add(shape.tagName.toLowerCase());
        });
      } else {
        console.warn(`[markerStyler] Could not parse <marker> element from HTML for #${id}`);
      }
    } else {
      console.warn(`[markerStyler] Could not find a definition for marker #${id} anywhere.`);
    }
  });

  console.log('[markerStyler] Found sub-elements:', subElements);
  const sortedElements = Array.from(subElements).sort();

  if (sortedElements.length > 0) {
    sortedElements.forEach(selector => {
      const li = document.createElement('li');
      li.className = 'combobox-int';
      li.dataset.value = selector;
      li.textContent = selector;
      selectorDropdown.appendChild(li);
    });

    // Select the first element by default
    const firstElementSelector = sortedElements[0];
    document.getElementById('marker-sub-element-selector-value').value = firstElementSelector;
    selectedText.textContent = firstElementSelector;
    document.getElementById('marker-styler-panel').dataset.currentSubElement = firstElementSelector;
    populateMarkerSubElementControls(firstElementSelector);
  } else {
    console.log('[markerStyler] No geometric shapes found in any of the markers.');
    selectedText.textContent = 'No Shapes';
    populateMarkerSubElementControls(null);
  }
}

/**
 * Populates the style controls for a specific sub-element within the active markers.
 * @param {string} subElementSelector - The selector for the sub-element (e.g., 'path:nth-of-type(1)').
 */
export function populateMarkerSubElementControls(subElementSelector) {
  setUpdatingControls(true);
  try {
    if (!subElementSelector || currentMarkerIds.length === 0) {
      // Reset controls if no element is selected
      document.getElementById('marker-element-fill').value = '#000000';
      document.getElementById('marker-element-stroke').value = '#000000';
      return;
    };

    const selectorCache = getSelectorCache();
    let fill = '#000000', stroke = '#000000'; // Defaults

    // Find the style by checking rules for all active markers
    for (const id of currentMarkerIds) {
      const fullSelector = `#${id} ${subElementSelector}`;
      const rule = selectorCache.get(fullSelector);
      if (rule) {
        rule.walkDecls('fill', decl => fill = decl.value);
        rule.walkDecls('stroke', decl => stroke = decl.value);
        break; // Use the first one found
      }
    }

    const fillInput = document.getElementById('marker-element-fill');
    const strokeInput = document.getElementById('marker-element-stroke');

    fillInput.value = colorNameToHex(fill);
    strokeInput.value = colorNameToHex(stroke);

    // Trigger Coloris update
    fillInput.dispatchEvent(new Event('input', { bubbles: true }));
    strokeInput.dispatchEvent(new Event('input', { bubbles: true }));

  } finally {
    setUpdatingControls(false);
  }
}

/**
 * Applies the styles from the UI to the selected sub-element for all active markers.
 */
export function applyMarkerSubElementStyle() {
  const panel = document.getElementById('marker-styler-panel');
  const subElementSelector = panel.dataset.currentSubElement;

  if (!subElementSelector || currentMarkerIds.length === 0) return;

  const ast = getCurrentCssAST();
  const fill = document.getElementById('marker-element-fill').value;
  const stroke = document.getElementById('marker-element-stroke').value;

  currentMarkerIds.forEach(id => {
    const fullSelector = `#${id} ${subElementSelector}`;
    let rule = ast.nodes.find(node => node.type === 'rule' && node.selector === fullSelector);

    if (!rule) {
      rule = postcss.rule({ selector: fullSelector });
      insertRuleInCategory(ast, rule);
    }

    rule.removeAll(); // Clear existing declarations
    if (fill) rule.append(postcss.decl({ prop: 'fill', value: fill }));
    if (stroke) rule.append(postcss.decl({ prop: 'stroke', value: stroke }));
  });

  const newCssContent = ast.toString();
  setCurrentCssContent(newCssContent);

  // Update the live SVG style tag
  const svgElement = document.querySelector('#svg-viewer-content svg');
  if (svgElement) {
    let styleTag = svgElement.querySelector('style');
    if (styleTag) {
      styleTag.textContent = newCssContent;
    }
  }
}
