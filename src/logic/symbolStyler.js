import postcss from 'postcss';
import { getCurrentCssAST, setCurrentCssContent, getCurrentSymbol, getSelectorCache } from '../state.js'; // <-- ADD getSelectorCache HERE
import { setEditorMode } from '../ui/init.js';
import { findAndPopulateSubElement, populateSimpleSymbolControls } from './cssEditor.js';
import { insertRuleInCategory } from './css-utils.js';

/**
 * Populates the hybrid symbol editor: generic controls + sub-element inspector list.
 * @param {string} symbolId The ID of the symbol to load styles for.
 */
export function populateSymbolControls(symbolId) {
  const ast = getCurrentCssAST();
  const selectorCache = getSelectorCache();
  if (!ast) return;

  const ruleTitleText = document.getElementById('rule-title-text');
  const selectedText = document.getElementById('symbol-inspector-selected-text');
  const inspectorList = document.getElementById('symbol-inspector-list');

  ruleTitleText.textContent = `Editing Symbol: #${symbolId}`;
  selectedText.textContent = `Editing: Generic Style`;
  
  // --- START: NEW LOGIC TO POPULATE FROM THE FIRST ELEMENT ---
  // Find the first geometric child in the actual SVG symbol definition
  const symbolElement = document.querySelector(`#svg-viewer-content svg defs g#${symbolId}`);
  let baseRule = postcss.rule(); // Start with an empty rule

  if (symbolElement) {
    const firstChild = symbolElement.querySelector('path, circle, rect, line, polygon, polyline, text');
    if (firstChild) {
      // Construct the correct selector for the first child
      const firstChildSelector = `#${symbolId} > ${firstChild.tagName.toLowerCase()}:nth-of-type(1)`;
      // Find this rule in our stylesheet
      const ruleFromAST = selectorCache.get(firstChildSelector);
      if (ruleFromAST) {
        baseRule = ruleFromAST;
      }
    }
  }
  // Use the "gentle" populator with the rule we found (or the empty one)
  populateSimpleSymbolControls(baseRule);
  // --- END: NEW LOGIC ---

  inspectorList.innerHTML = '';
  const genericLi = document.createElement('li');
  genericLi.className = 'cursor-pointer hover:text-blue-600 p-1 rounded-sm option-highlight';
  genericLi.textContent = 'Generic Style';
  genericLi.dataset.action = 'show-generic';
  genericLi.dataset.symbolId = symbolId;
  inspectorList.appendChild(genericLi);

  if (symbolElement) {
    Array.from(symbolElement.children).forEach((child, index) => {
      const tagName = child.tagName.toLowerCase();
      if (['path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'text'].includes(tagName)) {
        const li = document.createElement('li');
        li.className = 'cursor-pointer hover:text-blue-600 p-1 rounded-sm';
        li.textContent = `<${tagName}> index ${index}`;
        li.dataset.symbolId = symbolId;
        li.dataset.elementIndex = index;
        li.dataset.elementTag = tagName;
        inspectorList.appendChild(li);
      }
    });
  }

  setEditorMode('symbol');
}

// --- ADD THIS NEW FUNCTION IN ITS PLACE ---
/**
 * Applies the styles from the UI to EVERY sub-element of a symbol
 * by creating or updating individual nth-of-type rules for each one.
 * This is the new logic for the "Generic Style" mode.
 * @param {string} symbolId The ID of the symbol to style.
 */
export function applyGenericStyleToAllSubElements(symbolId) {
  const ast = getCurrentCssAST();
  const symbolElement = document.querySelector(`#svg-viewer-content svg defs g#${symbolId}`);
  if (!ast || !symbolElement) return;

  const fillColor = document.getElementById('symbol-fill-color').value;
  const strokeColor = document.getElementById('symbol-stroke-color').value;
  const strokeWidth = document.getElementById('symbol-stroke-width').value;

  ast.walkRules(rule => {
    if (rule.selector.startsWith(`#${symbolId} >`)) {
      rule.remove();
    }
  });

  // --- START: CORRECT NTH-OF-TYPE CALCULATION ---
  const tagCounts = {};
  Array.from(symbolElement.children).forEach(child => {
    const tagName = child.tagName.toLowerCase();
    if (['path', 'circle', 'rect', 'line', 'polygon', 'polyline', 'text'].includes(tagName)) {
      // Increment the count for this specific tag
      tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
      const nthOfTypeIndex = tagCounts[tagName];

      const selector = `#${symbolId} > ${tagName}:nth-of-type(${nthOfTypeIndex})`;
      
      const newRule = postcss.rule({ selector });
      if (fillColor) newRule.append(postcss.decl({ prop: 'fill', value: fillColor }));
      if (strokeColor) newRule.append(postcss.decl({ prop: 'stroke', value: strokeColor }));
      if (strokeWidth) newRule.append(postcss.decl({ prop: 'stroke-width', value: strokeWidth }));
      
      insertRuleInCategory(ast, newRule);

    }
  });
  // --- END: CORRECT CALCULATION ---

  const newCssContent = ast.toString();
  setCurrentCssContent(newCssContent);

  const svgElement = document.querySelector('#svg-viewer-content svg');
  if (svgElement) {
    let styleTag = svgElement.querySelector('style');
    if (styleTag) styleTag.textContent = newCssContent;
  }
}