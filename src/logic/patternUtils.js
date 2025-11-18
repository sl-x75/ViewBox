// src/logic/patternUtils.js

import { getPatternDefs, getCurrentCssAST, getCurrentRuleObject, setPatternDefs } from '../state.js';
import { savePatternToBothLocations } from './files.js';

/**
 * Checks if a given pattern URL is used by any rule OTHER than the one currently being edited.
 * @param {string} patternUrl - The full `url(#...)` string of the pattern.
 * @param {object} currentRule - The PostCSS rule object currently being edited.
 * @returns {boolean} - True if the pattern is in use by other rules, false otherwise.
 */
export function isPatternUsedByOtherRules(patternUrl, currentRule) {
    const ast = getCurrentCssAST();
    if (!ast || !patternUrl) {
        return false;
    }

    let usageCount = 0;
    let currentRuleUsesPattern = false;

   ast.walkRules(rule => {
       rule.walkDecls('fill', decl => {
           if (decl.value === patternUrl) {
               if (currentRule && rule === currentRule) {
                   currentRuleUsesPattern = true;
               } else {
                   usageCount++;
               }
           }
       });
   });
   // If the current rule uses this pattern, a warning is needed if any other rule also uses it.
   if (currentRuleUsesPattern) {
       return usageCount > 0;
   } 
   // If the current rule does NOT use this pattern (e.g., we are about to apply it),
   // a warning is needed if any other rule is already using it.
   else {
       return usageCount > 0;
   }
}

/**
 * Displays or hides a warning message in the main rule title bar if a pattern is already in use.
 * @param {boolean} isUsed - Whether the pattern is in use by other rules.
 * @param {string} patternId - The ID of the pattern (e.g., "parquet").
 */
export function displayPatternUsageWarning(isUsed, patternId) {
  const warningArea = document.getElementById('rule-title-warning-area');
  const ruleTitleText = document.getElementById('rule-title-text');
  if (!warningArea || !ruleTitleText) return;

  warningArea.innerHTML = ''; // Clear previous content
  ruleTitleText.classList.remove('text-green-500'); // Reset color

  if (isUsed && patternId) {
    const buttonHTML = `<button id="copy-pattern-btn" data-original-pattern-id="${patternId}" class="new-rule-btn ml-2 dark:border-gray-700" type="button">Create a Copy</button>`;
    warningArea.innerHTML = `
        <span class="mx-2 text-gray-300">|</span>
        <span class="text-xs whitespace-nowrap text-red-500">#${patternId} is in use</span>
        ${buttonHTML}
    `;
  }
}

/**
 * Handles the core logic of copying a pattern after the user confirms in the modal.
 * This function is now separate so it can be called from an event listener.
 * It returns the new pattern ID on success, or null on failure.
 */
export async function handleConfirmPatternCopy() {
  const input = document.getElementById('new-pattern-id-input');
  const confirmBtn = document.getElementById('confirm-pattern-copy-btn');
  const originalPatternId = confirmBtn.dataset.originalPatternId;
  const newPatternId = input.value.trim();

  if (!newPatternId) {
    alert('Please enter a pattern ID.');
    input.focus();
    return null;
  }

  if (newPatternId === originalPatternId) {
    alert('The new ID cannot be the same as the original ID.');
    input.focus();
    return null;
  }

  if (isPatternUsedByOtherRules(`url(#${newPatternId})`, null)) {
    alert(`The ID "${newPatternId}" is already in use in the stylesheet. Please choose a different one.`);
    input.focus();
    return null;
  }

  const patternDefs = getPatternDefs();
  if (patternDefs[newPatternId]) {
    alert(`The ID "${newPatternId}" already exists in pattern definitions. Please choose a different one.`);
    input.focus();
    return null;
  }

  const originalPatternHTML = patternDefs[originalPatternId];
  if (!originalPatternHTML) {
    console.error(`Could not find original pattern HTML for ID: ${originalPatternId}`);
    alert('Error: Could not find the original pattern data.');
    window.HSOverlay.close('#pattern-copy-modal');
    return null;
  }

  try {
    const idRegex = new RegExp(`id\\s*=\\s*(["'])${originalPatternId}\\1`);
    if (!idRegex.test(originalPatternHTML)) {
      throw new Error(`Could not find id="${originalPatternId}" in the pattern's HTML.`);
    }
    const newPatternHTML = originalPatternHTML.replace(idRegex, `id=$1${newPatternId}$1`);

    const newPatternDefs = { ...patternDefs, [newPatternId]: newPatternHTML };
    setPatternDefs(newPatternDefs);

    await savePatternToBothLocations(newPatternId, newPatternHTML);

    window.HSOverlay.close('#pattern-copy-modal');
    
    return newPatternId; // Return the new ID on success

  } catch (error) {
    console.error('Error copying pattern:', error);
    alert('Error occurred while copying pattern. Check console for details.');
    window.HSOverlay.close('#pattern-copy-modal');
    return null; // Return null on failure
  }
}

/**
 * Populates and opens the Preline modal for copying a pattern.
 * @param {string} originalPatternId - The ID of the pattern to copy.
 */
export function promptForPatternCopy(originalPatternId) {
  const modalBody = document.getElementById('pattern-copy-modal-body');
  const input = document.getElementById('new-pattern-id-input');
  const confirmBtn = document.getElementById('confirm-pattern-copy-btn');

  modalBody.innerHTML = `Pattern "<strong>${originalPatternId}</strong>" is already in use. Enter a new unique ID for the copy:`;
  input.value = `${originalPatternId}-copy`;

  confirmBtn.dataset.originalPatternId = originalPatternId;
  
  window.HSOverlay.open('#pattern-copy-modal');

  setTimeout(() => {
    input.focus();
    input.select();
  }, 100);
}

/**
 * Extracts the pattern ID from a url(#...) string.
 * @param {string|null} url - Example: "url(#pattern1)".
 * @returns {string|null} The raw pattern ID or null.
 */
export function extractPatternId(url) {
    if (!url) return null;
    const match = url.match(/url\(#([\w-]+)\)/);
    return match ? match[1] : null;
}

/**
 * Parses a pattern's SVG string to find which shape types it contains.
 * @param {string} patternId The ID of the pattern to inspect.
 * @returns {Set<string>} A Set containing the lower-case tag names of existing shapes (e.g., {'path', 'line'}).
 */
export function getExistingShapesInPattern(patternId) {
    const patternDefs = getPatternDefs();
    const patternHTML = patternDefs[patternId];
    if (!patternHTML) return new Set();
    const parser = new DOMParser();
    const doc = parser.parseFromString(patternHTML, 'image/svg+xml');
    const patternElement = doc.querySelector('pattern');
    const existingShapes = new Set();
    if (patternElement) {
        if (patternElement.querySelector('path')) existingShapes.add('path');
        if (patternElement.querySelector('line')) existingShapes.add('line');
        if (patternElement.querySelector('rect')) existingShapes.add('rect');
        if (patternElement.querySelector('circle')) existingShapes.add('circle');
    }
    return existingShapes;
}

export function colorNameToHex(color) {
    const colors = {
        "aliceblue":"#f0f8ff","antiquewhite":"#faebd7","aqua":"#00ffff","aquamarine":"#7fffd4","azure":"#f0ffff",
        "beige":"#f5f5dc","bisque":"#ffe4c4","black":"#000000","blanchedalmond":"#ffebcd","blue":"#0000ff",
        "blueviolet":"#8a2be2","brown":"#a52a2a","burlywood":"#deb887","cadetblue":"#5f9ea0","chartreuse":"#7fff00",
        "chocolate":"#d2691e","coral":"#ff7f50","cornflowerblue":"#6495ed","cornsilk":"#fff8dc","crimson":"#dc143c",
        "cyan":"#00ffff","darkblue":"#00008b","darkcyan":"#008b8b","darkgoldenrod":"#b8860b","darkgray":"#a9a9a9",
        "darkgreen":"#006400","darkkhaki":"#bdb76b","darkmagenta":"#8b008b","darkolivegreen":"#556b2f",
        "darkorange":"#ff8c00","darkorchid":"#9932cc","darkred":"#8b0000","darksalmon":"#e9967a","darkseagreen":"#8fbc8f",
        "darkslateblue":"#483d8b","darkslategray":"#2f4f4f","darkturquoise":"#00ced1","darkviolet":"#9400d3",
        "deeppink":"#ff1493","deepskyblue":"#00bfff","dimgray":"#696969","dodgerblue":"#1e90ff",
        "firebrick":"#b22222","floralwhite":"#fffaf0","forestgreen":"#228b22","fuchsia":"#ff00ff",
        "gainsboro":"#dcdcdc","ghostwhite":"#f8f8ff","gold":"#ffd700","goldenrod":"#daa520","gray":"#808080",
        "green":"#008000","greenyellow":"#adff2f","honeydew":"#f0fff0","hotpink":"#ff69b4","indianred ":"#cd5c5c",
        "indigo":"#4b0082","ivory":"#fffff0","khaki":"#f0e68c","lavender":"#e6e6fa","lavenderblush":"#fff0f5",
        "lawngreen":"#7cfc00","lemonchiffon":"#fffacd","lightblue":"#add8e6","lightcoral":"#f08080","lightcyan":"#e0ffff",
        "lightgoldenrodyellow":"#fafad2","lightgrey":"#d3d3d3","lightgreen":"#90ee90","lightpink":"#ffb6c1",
        "lightsalmon":"#ffa07a","lightseagreen":"#20b2aa","lightskyblue":"#87cefa","lightslategray":"#778899",
        "lightsteelblue":"#b0c4de","lightyellow":"#ffffe0","lime":"#00ff00","limegreen":"#32cd32","linen":"#faf0e6",
        "magenta":"#ff00ff","maroon":"#800000","mediumaquamarine":"#66cdaa","mediumblue":"#0000cd","mediumorchid":"#ba55d3",
        "mediumpurple":"#9370d8","mediumseagreen":"#3cb371","mediumslateblue":"#7b68ee","mediumspringgreen":"#00fa9a",
        "mediumturquoise":"#48d1cc","mediumvioletred":"#c71585","midnightblue":"#191970","mintcream":"#f5fffa",
        "mistyrose":"#ffe4e1","moccasin":"#ffe4b5","navajowhite":"#ffdead","navy":"#000080","oldlace":"#fdf5e6",
        "olive":"#800000","olivedrab":"#6b8e23","orange":"#ffa500","orangered":"#ff4500","orchid":"#da70d6",
        "palegoldenrod":"#eee8aa","palegreen":"#98fb98","paleturquoise":"#afeeee","palevioletred":"#d87093",
        "papayawhip":"#ffefd5","peachpuff":"#ffdab9","peru":"#cd853f","pink":"#ffc0cb","plum":"#dda0dd",
        "powderblue":"#b0e0e6","purple":"#800080","rebeccapurple":"#663399","red":"#ff0000","rosybrown":"#bc8f8f",
        "royalblue":"#4169e1","saddlebrown":"#8b4513","salmon":"#fa8072","sandybrown":"#f4a460","seagreen":"#2e8b57",
        "seashell":"#fff5ee","sienna":"#a0522d","silver":"#c0c0c0","skyblue":"#87ceeb","slateblue":"#6a5acd",
        "slategray":"#708090","snow":"#fffafa","springgreen":"#00ff7f","steelblue":"#4682b4","tan":"#d2b48c",
        "teal":"#008080","thistle":"#d8bfd8","tomato":"#ff6347","turquoise":"#40e0d0","violet":"#ee82ee",
        "wheat":"#f5deb3","white":"#ffffff","whitesmoke":"#f5f5f5","yellow":"#ffff00","yellowgreen":"#9acd32"
    };

    if (typeof colors[color.toLowerCase()] != 'undefined')
        return colors[color.toLowerCase()];

    return color;
}
