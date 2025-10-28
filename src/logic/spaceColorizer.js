// src/logic/spaceColorizer.js

import { getCurrentSvgElement } from '../state.js';

const STYLE_ID = 'ifc-space-visualization-styles';

/**
 * Removes any existing visualization style block to ensure a clean slate.
 */
function clearVisualization() {
  const svg = getCurrentSvgElement();
  if (!svg) return;
  const styleEl = svg.querySelector(`#${STYLE_ID}`);
  if (styleEl) {
    styleEl.remove();
  }
}

/**
 * Injects a style block to hide all IfcSpace elements.
 */
function hideSpaces() {
  const svg = getCurrentSvgElement();
  if (!svg) return;

  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.id = STYLE_ID;
  styleEl.textContent = `
    .IfcSpace {
      visibility: hidden !important;
    }
  `;
  svg.prepend(styleEl);
}

/**
 * Main controller for space visualization. Cleans up previous state
 * and applies the new one.
 * @param {'colorized' | 'hidden'} mode
 */
export function setSpaceVisualization(mode) {
  // Always clear the previous temporary style block first
  clearVisualization();

  switch (mode) {
    case 'colorized':
       // "On" state - Do nothing. Clearing the temp style block is enough to restore the permanent styles.
      break;
    case 'hidden':
        // "Off" state
      hideSpaces();
      break;
  }
  console.log(`[SpaceViz] Set to mode: ${mode}`);
}