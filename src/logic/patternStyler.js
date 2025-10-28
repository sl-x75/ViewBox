// src/logic/patternStyler.js

import postcss from 'postcss';
import { getCurrentCssAST, getPatternDefs, getLastPickedElement, setCurrentCssContent, getSelectorCache, setUpdatingControls } from '../state.js';
import { calculateParallelogramAngles } from './calculateParallelogramAngles.js';
import { colorNameToHex } from './patternUtils.js';
import { updatePatternPreview } from './patternPreview.js';
import { syncDefs } from './cssEditor.js';
import { insertRuleInCategory } from './css-utils.js';
import Coloris from '@melloware/coloris'; // <-- ADD THIS LINE


let currentPatternId = null;

    // --- START: ADD THIS BLOCK ---
    // Initialize the color pickers specific to the pattern editor panel
    Coloris.setInstance('#pattern-editor-panel .coloris-input-pattern-editor', {
        theme: 'pattern',
        themeMode: 'light',
        parent: '#main-app-view', // Constrain the picker to the app view
        swatches: [
          '#264653',
          '#2a9d8f',
          '#e9c46a',
          '#f4a261',
          '#e76f51',
          '#264653',
        ]
    });
    // --- END: ADD THIS BLOCK ---




/**
 * Parses a pattern's SVG string to build a list of its geometric sub-elements.
 * @param {string} patternHTML The SVG string of the <pattern> element.
 * @returns {Array<{selector: string, text: string}>} A list of sub-elements.
 */
function getPatternSubElements(patternHTML) {
    if (!patternHTML) return [];
    
    const parser = new DOMParser();
    const doc = parser.parseFromString(patternHTML, 'image/svg+xml');
    const patternElement = doc.querySelector('pattern');
    if (!patternElement) return [];
    
    const subElements = [];
    const tagCounts = {};

    Array.from(patternElement.children).forEach(child => {
        const tagName = child.tagName.toLowerCase();
        if (['path', 'line', 'rect', 'circle', 'polygon', 'polyline'].includes(tagName)) {
            tagCounts[tagName] = (tagCounts[tagName] || 0) + 1;
            const selector = `${tagName}:nth-of-type(${tagCounts[tagName]})`;
            const text = `${tagName} #${tagCounts[tagName]}`;
            subElements.push({ selector, text });
        }
    });
    return subElements;
}

/**
 * Populates the style controls for a single, specific sub-element.
 * @param {string} subElementSelector - The specific selector (e.g., 'path:nth-of-type(1)').
 */
export function populatePatternSubElementControls(subElementSelector) {
    setUpdatingControls(true);
    try {
        if (!currentPatternId || !subElementSelector) return;

        const selectorCache = getSelectorCache();
        const fullSelector = `#${currentPatternId} > ${subElementSelector}`;
        const rule = selectorCache.get(fullSelector);

        const fillInput = document.getElementById('pattern-element-fill');
        const strokeInput = document.getElementById('pattern-element-stroke');
        const strokeWidthInput = document.getElementById('pattern-element-stroke-width');
        const strokeWidthValue = document.getElementById('pattern-element-stroke-width-value');

        // Reset to defaults
        let fill = '#ffffff00', stroke = '#000000', strokeWidth = 0.2;

        if (rule) {
            rule.walkDecls('fill', decl => fill = decl.value);
            rule.walkDecls('stroke', decl => stroke = decl.value);
            rule.walkDecls('stroke-width', decl => strokeWidth = parseFloat(decl.value));
        }

        fillInput.value = colorNameToHex(fill);
        strokeInput.value = colorNameToHex(stroke);
        strokeWidthInput.value = strokeWidth;
        strokeWidthValue.textContent = strokeWidth;

        // Trigger Coloris update
        fillInput.dispatchEvent(new Event('input', { bubbles: true }));
        strokeInput.dispatchEvent(new Event('input', { bubbles: true }));
    } finally {
        setUpdatingControls(false);
    }
}


export function openPatternStyler() {
    const fillPatternSelect = document.getElementById('fill-pattern-input');
    currentPatternId = fillPatternSelect.value;
    if (!currentPatternId) return;

    const panel = document.getElementById('pattern-editor-panel');
    panel.style.bottom = `7px`;
    panel.style.right = `7px`;
    panel.classList.remove('hidden');

    const ast = getCurrentCssAST();
    const patternDefs = getPatternDefs();
    const patternHTML = patternDefs[currentPatternId];
    
    // 1. Populate Global Transform Controls
    const transformRule = ast.nodes.find(node => node.type === 'rule' && node.selector === `#${currentPatternId}`);
    let scaleX = 1, scaleY = 1, rotate = 0;
    if (transformRule) {
        transformRule.walkDecls('transform', decl => {
            const scaleMatch = decl.value.match(/scale\(([^, )]+)(?:[ ,]+([^)]+))?\)/);
            if (scaleMatch) {
                scaleX = parseFloat(scaleMatch[1]);
                scaleY = scaleMatch[2] ? parseFloat(scaleMatch[2]) : scaleX;
            }
            const rotateMatch = decl.value.match(/rotate\(([^d\s]+)/);
            if (rotateMatch) rotate = parseFloat(rotateMatch[1]);
        });
    }
    document.getElementById('pattern-scale-x').value = scaleX;
    document.getElementById('pattern-scale-x-value').textContent = scaleX;
    document.getElementById('pattern-scale-y').value = scaleY;
    document.getElementById('pattern-scale-y-value').textContent = scaleY;
    document.getElementById('pattern-rotate').value = rotate;
    document.getElementById('pattern-rotate-value').textContent = rotate;

    // 2. Populate Sub-Element Inspector Dropdown
    const selectorDropdown = document.getElementById('pattern-sub-element-options'); // <-- Target the UL
    const selectedText = document.getElementById('pattern-sub-element-selected-text'); // <-- Target the SPAN
    selectorDropdown.innerHTML = '';
    const subElements = getPatternSubElements(patternHTML);

    if (subElements.length > 0) {
        subElements.forEach(el => {
            const li = document.createElement('li'); // <-- Create LI
            li.className = 'combobox-int';
            li.dataset.value = el.selector;
            li.textContent = el.text;
            selectorDropdown.appendChild(li);
        });
        
        // 3. Select the first element by default
        const firstElementSelector = subElements[0].selector;
        document.getElementById('pattern-sub-element-selector-value').value = firstElementSelector;
        selectedText.textContent = subElements[0].text;
        panel.dataset.currentSubElement = firstElementSelector;
        populatePatternSubElementControls(firstElementSelector);
    } else {
        // Handle patterns with no recognizable shapes
        panel.dataset.currentSubElement = '';
        populatePatternSubElementControls(null);
    }
}


export function populateAngleSelector() {
    console.group('Angle Calculation for Target Shape');

    const targetElement = getLastPickedElement();
    const optionsContainer = document.getElementById('pattern-angle-options-menu');
    optionsContainer.innerHTML = '';

    if (!targetElement) {
        console.warn('Cannot calculate angles, no element has been picked yet.');
        const noElemMsg = document.createElement('span');
        noElemMsg.className = 'block py-2 px-3 text-xs text-gray-500 dark:text-neutral-400';
        noElemMsg.textContent = 'Pick a shape first.';
        optionsContainer.appendChild(noElemMsg);
        console.groupEnd();
        return;
    }

    const tagName = targetElement.tagName.toLowerCase();
    let pathData = '';

    if (tagName === 'path') {
        pathData = targetElement.getAttribute('d');
    } else if (['polygon', 'polyline'].includes(tagName)) {
        const points = targetElement.getAttribute('points').trim();
        pathData = `M ${points.replace(/\s+/g, ' L ')}`;
        if (tagName === 'polygon') pathData += ' Z';
    } else if (tagName === 'rect') {
        const x = parseFloat(targetElement.getAttribute('x') || 0);
        const y = parseFloat(targetElement.getAttribute('y') || 0);
        const width = parseFloat(targetElement.getAttribute('width'));
        const height = parseFloat(targetElement.getAttribute('height'));
        pathData = `M ${x},${y} L ${x + width},${y} L ${x + width},${y + height} L ${x},${y + height} Z`;
    } else {
        const unsupportedMsg = document.createElement('span');
        unsupportedMsg.className = 'block py-2 px-3 text-xs text-gray-500 dark:text-neutral-400';
        unsupportedMsg.textContent = `Not supported for <${tagName}>.`;
        optionsContainer.appendChild(unsupportedMsg);
        console.groupEnd();
        return;
    }

    if (!pathData) {
        console.error('Could not extract geometric data from the element.');
        console.groupEnd();
        return;
    }

    const angles = calculateParallelogramAngles(pathData);

    if (angles.length === 0) {
        const noAnglesMsg = document.createElement('span');
        noAnglesMsg.className = 'block py-2 px-3 text-xs text-gray-500 dark:text-neutral-400';
        noAnglesMsg.textContent = 'No angles found.';
        optionsContainer.appendChild(noAnglesMsg);
        console.groupEnd();
        return;
    }

    const uniquePositiveAngles = [...new Set(angles.map(angle => {
        const positiveAngle = angle < 0 ? angle + 360 : angle;
        return positiveAngle > 180 ? positiveAngle - 180 : positiveAngle;
    }))];
    
    uniquePositiveAngles.sort((a, b) => a - b).forEach(angle => {
        const angleOption = document.createElement('a');
        angleOption.className = 'flex items-center gap-x-3.5 py-2 px-3 rounded-lg text-sm text-gray-800 hover:bg-gray-100 focus:outline-none focus:bg-gray-100 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:focus:bg-neutral-700 cursor-pointer';
        angleOption.href = "#";
        angleOption.textContent = `${angle.toFixed(1)}°`;
        angleOption.dataset.angle = angle;
        optionsContainer.appendChild(angleOption);
    });
    
    console.groupEnd();
}



/**
 * Commits either a transform change or a sub-element style change.
 * @param {'transform' | 'style'} type - The type of change to commit.
 */
export function commitPatternStyles(type) {
    if (!currentPatternId) return;

    const ast = getCurrentCssAST();
    const panel = document.getElementById('pattern-editor-panel');
    
    if (type === 'transform') {
        let transformRule = ast.nodes.find(node => node.type === 'rule' && node.selector === `#${currentPatternId}`);
        if (!transformRule) {
            transformRule = postcss.rule({ selector: `#${currentPatternId}` });
            insertRuleInCategory(ast, transformRule); // ✅ Fixed
        }
        transformRule.removeAll();
        const scaleX = document.getElementById('pattern-scale-x').value;
        const scaleY = document.getElementById('pattern-scale-y').value;
        const rotate = document.getElementById('pattern-rotate').value;
        transformRule.append(postcss.decl({ prop: 'transform', value: `scale(${scaleX}, ${scaleY}) rotate(${rotate}deg)` }));
    } 
    else if (type === 'style') {
        const subElementSelector = panel.dataset.currentSubElement;
        if (!subElementSelector) return;

        const fullSelector = `#${currentPatternId} > ${subElementSelector}`;
        let styleRule = ast.nodes.find(node => node.type === 'rule' && node.selector === fullSelector);
        if (!styleRule) {
            styleRule = postcss.rule({ selector: fullSelector });
            insertRuleInCategory(ast, styleRule); // ✅ Fixed
        }
        styleRule.removeAll();
        const fill = document.getElementById('pattern-element-fill').value;
        const stroke = document.getElementById('pattern-element-stroke').value;
        const strokeWidth = document.getElementById('pattern-element-stroke-width').value;
        styleRule.append(postcss.decl({ prop: 'fill', value: fill }));
        styleRule.append(postcss.decl({ prop: 'stroke', value: stroke }));
        styleRule.append(postcss.decl({ prop: 'stroke-width', value: strokeWidth }));
    }

    const newCssContent = ast.toString();
    setCurrentCssContent(newCssContent);

    const svgElement = document.querySelector('#svg-viewer-content svg');
    if (svgElement) {
        let styleTag = svgElement.querySelector('style');
        if (styleTag) styleTag.textContent = newCssContent;
        syncDefs(svgElement, ast);
    }
    updatePatternPreview(`url(#${currentPatternId})`);
}

export function closePatternStyler() {
    document.getElementById('pattern-editor-panel').classList.add('hidden');
    currentPatternId = null;
}

// NOTE: We are removing updateLivePreview and clearLivePreviewState for now to simplify.
// The `commit` function is fast enough for real-time feedback with this new model.
// We are also removing populateAngleSelector as it's tied to the old UI. It can be re-integrated later.