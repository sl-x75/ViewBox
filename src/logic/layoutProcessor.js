// src/logic/layoutProcessor.js

import fs from 'fs/promises';
import path from 'path';
import { getDrawingToAssetMap } from '../state.js'; // Import the asset map getter

// This function escapes a string for use in a RegExp
const escapeRegExp = (string) => string.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

/**
 * Processes an SVG layout file by inlining linked SVGs, scoping their styles,
 * and combining them into a single stylesheet.
 * @param {SVGElement} svgElement - The main SVG element of the layout file.
 * @param {string} layoutFilePath - The absolute path to the layout SVG file.
 */
export async function processLayoutFile(svgElement, layoutFilePath) {
  const svgDir = path.dirname(layoutFilePath);
  const images = Array.from(svgElement.querySelectorAll('image'));
  const parser = new DOMParser();
  let imageCounter = 0;
  let combinedStyleSheet = '';
  
  // Get the map of drawings to their assets
  const assetMap = getDrawingToAssetMap();

  for (const image of images) {
    let href = image.getAttribute('xlink:href') || image.getAttribute('href');
    if (!href || !href.toLowerCase().endsWith('.svg')) continue;

    href = decodeURIComponent(href);
    const linkedSvgPath = path.resolve(svgDir, href);
    const linkedSvgFilename = path.basename(linkedSvgPath);
    imageCounter++;
    const uniqueSuffix = `inst${imageCounter}`;
    const uniqueClass = `drawing-inst-${imageCounter}`;

    try {
      const linkedSvgData = await fs.readFile(linkedSvgPath, 'utf8');
      const linkedSvgDoc = parser.parseFromString(linkedSvgData, 'image/svg+xml');
      const linkedSvgRoot = linkedSvgDoc.documentElement;

      if (!linkedSvgRoot || linkedSvgRoot.tagName !== 'svg') {
        console.error(`Invalid SVG document for ${href}`);
        continue;
      }

      // This scopes all IDs (like 'brickface') and returns a map of oldId -> newId
      const idMap = scopeIdsAndReferences(linkedSvgRoot, uniqueSuffix);

      // --- NEW: Process External Stylesheet ---
      const assets = assetMap[linkedSvgFilename];
      if (assets && assets.Stylesheet) {
        // Construct the full path to the CSS file relative to the project root
        const cssFilePath = path.resolve(svgDir, '..', assets.Stylesheet);
        try {
          let externalCss = await fs.readFile(cssFilePath, 'utf8');

          // 1. Scope pattern IDs within the CSS first (e.g., #brickface -> #brickface-inst1)
          idMap.forEach((newId, oldId) => {
            const idPattern = new RegExp(`#${escapeRegExp(oldId)}(?=[\\s,{:]|$)`, 'g');
            externalCss = externalCss.replace(idPattern, `#${newId}`);
          });

          // 2. Scope class-based rules (e.g., .surface -> .drawing-inst-1 .surface)
          const scopedClassCss = scopeCssRules(externalCss, uniqueClass);
          combinedStyleSheet += scopedClassCss + '\n';

        } catch (cssErr) {
          console.warn(`Could not load or process external stylesheet at ${cssFilePath}:`, cssErr);
        }
      }

      const styleElements = linkedSvgRoot.querySelectorAll('style');
      styleElements.forEach(styleEl => {
        let styleContent = styleEl.textContent || '';
        idMap.forEach((newId, oldId) => {
          const urlPattern = new RegExp(`url\\(\\s*#${escapeRegExp(oldId)}\\s*\\)`, 'g');
          styleContent = styleContent.replace(urlPattern, `url(#${newId})`);
        });
        const scopedStyle = scopeCssRules(styleContent, uniqueClass);
        combinedStyleSheet += scopedStyle + '\n';
        styleEl.remove();
      });

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const x = parseFloat(image.getAttribute('x')) || 0;
      const y = parseFloat(image.getAttribute('y')) || 0;
      const transform = image.getAttribute('transform');

      if (transform) {
        g.setAttribute('transform', transform);
      } else {
        g.setAttribute('transform', `translate(${x}, ${y})`);
      }
      
      g.setAttribute('data-type', 'drawing');
      g.setAttribute('data-source', href);
      g.classList.add(uniqueClass);
      // ADD ONLY THIS LINE:
      g.setAttribute('data-original-image-attrs', JSON.stringify({
        x: image.getAttribute('x') || '0',
        y: image.getAttribute('y') || '0',
        width: image.getAttribute('width') || '',
        height: image.getAttribute('height') || '',
        transform: image.getAttribute('transform') || ''
      }));

      const importedSvg = document.importNode(linkedSvgRoot, true);
      while (importedSvg.firstChild) {
        g.appendChild(importedSvg.firstChild);
      }

      image.parentNode.replaceChild(g, image);

    } catch (err) {
      console.error(`Could not load or process linked SVG at ${linkedSvgPath}:`, err);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', image.getAttribute('x') || '0');
      text.setAttribute('y', image.getAttribute('y') || '0');
      text.setAttribute('fill', 'red');
      text.textContent = `Error: Could not load ${href}`;
      image.parentNode.replaceChild(text, image);
    }
  }

  if (combinedStyleSheet.trim()) {
    const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
    styleElement.textContent = combinedStyleSheet;
    svgElement.prepend(styleElement);
  }
}

/**
 * Scopes CSS rules by prepending a class to each selector.
 * It now intelligently handles selectors starting with 'svg' by replacing
 * it with the scope class, allowing for global drawing styles like filters.
 * @param {string} cssContent - The CSS content to scope.
 * @param {string} scopeClass - The class to prepend.
 * @returns {string} The scoped CSS content.
 */
function scopeCssRules(cssContent, scopeClass) {
  // This complex splitting logic is necessary to correctly handle @-rules like @keyframes.
  const rules = [];
  let currentRule = '';
  let braceLevel = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < cssContent.length; i++) {
    const char = cssContent[i];
    const prevChar = i > 0 ? cssContent[i - 1] : '';

    if (!inString && (char === '"' || char === "'")) {
      inString = true;
      stringChar = char;
    } else if (inString && char === stringChar && prevChar !== '\\') {
      inString = false;
    }

    if (!inString) {
      if (char === '{') {
        braceLevel++;
      } else if (char === '}') {
        braceLevel--;
        if (braceLevel === 0) {
          currentRule += char;
          rules.push(currentRule.trim());
          currentRule = '';
          continue;
        }
      }
    }
    currentRule += char;
  }

  const scopedRules = rules.map(rule => {
    if (!rule.includes('{')) return rule; // Keep @-rules like @charset as is.
    
    const parts = rule.split('{');
    const selectorsPart = parts.shift();
    const declarations = `{${parts.join('{')}`;
    
    const selectors = selectorsPart.split(',').map(selector => {
      const trimmed = selector.trim();
      
      // Ignore @-rules like @keyframes or empty selectors
      if (!trimmed || trimmed.startsWith('@')) {
        return trimmed;
      }
      
      // --- START: THIS IS THE NEW LOGIC ---
      // If the selector targets the root 'svg' element...
      if (trimmed.startsWith('svg')) {
        // ...replace 'svg' with the scope class.
        // This correctly transforms 'svg path' into '.drawing-inst-1 path'.
        const restOfSelector = trimmed.substring('svg'.length).trim();
        return `.${scopeClass} ${restOfSelector}`;
      } 
      // --- END: NEW LOGIC ---
      
      // For all other selectors (like '.surface' or 'path'), just prepend the class.
      return `.${scopeClass} ${trimmed}`;
    });
    
    return `${selectors.join(', ')}${declarations}`;
  });

  return scopedRules.join('\n');
}

  

/**
 * Scopes all IDs within an SVG element by adding a unique suffix and updates all references.
 * @param {SVGElement} element - The SVG element to process.
 * @param {string} uniqueSuffix - The unique suffix to append to IDs.
 * @returns {Map<string, string>} A map of old IDs to new IDs.
 */
function scopeIdsAndReferences(element, uniqueSuffix) {
  const idMap = new Map();
  const elementsWithIds = element.querySelectorAll('[id]');
  
  elementsWithIds.forEach(el => {
    const oldId = el.id;
    const newId = `${oldId}-${uniqueSuffix}`;
    idMap.set(oldId, newId);
    el.id = newId;
  });

  const allElements = element.querySelectorAll('*');
  allElements.forEach(el => {
    const urlAttributes = ['fill', 'stroke', 'filter', 'marker-start', 'marker-mid', 'marker-end', 'clip-path', 'mask'];
    urlAttributes.forEach(attrName => {
      if (el.hasAttribute(attrName)) {
        let attrValue = el.getAttribute(attrName);
        idMap.forEach((newId, oldId) => {
          const urlPattern = new RegExp(`url\\(\\s*#${escapeRegExp(oldId)}\\s*\\)`, 'g');
          if (urlPattern.test(attrValue)) {
            attrValue = attrValue.replace(urlPattern, `url(#${newId})`);
            el.setAttribute(attrName, attrValue);
          }
        });
      }
    });

    const hrefAttrs = ['href', 'xlink:href'];
    hrefAttrs.forEach(attrName => {
      if (el.hasAttribute(attrName)) {
        const href = el.getAttribute(attrName);
        if (href && href.startsWith('#')) {
          const oldId = href.substring(1);
          if (idMap.has(oldId)) {
            el.setAttribute(attrName, `#${idMap.get(oldId)}`);
          }
        }
      }
    });

    if (el.tagName.toLowerCase() === 'style') {
      let styleContent = el.textContent || '';
      idMap.forEach((newId, oldId) => {
        const urlPattern = new RegExp(`url\\(\\s*#${escapeRegExp(oldId)}\\s*\\)`, 'g');
        if (urlPattern.test(styleContent)) {
          styleContent = styleContent.replace(urlPattern, `url(#${newId})`);
        }
      });
      el.textContent = styleContent;
    }
  });

  return idMap;
}