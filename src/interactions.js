// src/interactions.js

import { isEditing, getCurrentCssAST, setCurrentRuleBlock, setCurrentRuleObject, getCurrentRuleObject, setNewRuleSelector, getSelectorCache, setLastPickedElement, setCurrentSymbol} from './state.js';
import { populateControls } from './logic/cssEditor.js';
import { populateSymbolControls } from './logic/symbolStyler.js';
import { setEditorMode } from './ui/init.js'; // <-- THIS IS THE CRITICAL MISSING LINE


let pickerHandler = null;
let updateFunction = null;

export function enableZoomPan(svg) {
  // This function is now disabled.
  // All pan and zoom logic is handled by InfiniteViewer in guides.js
}

export function triggerUpdate() {
    if (updateFunction) {
        updateFunction();
    }
}

/**
 * A highly performant way to find a rule by checking for selectors in a pre-built cache.
 * @param {Map<string, object>} cache - The selector cache map from the state.
 * @param {string[]} selectors - An array of selector strings to test, in order of priority.
 * @returns {object|null} The matched PostCSS rule object or null.
 */
function findRuleInCache(cache, selectors) {
  for (const selector of selectors) {
    if (cache.has(selector)) {
      return cache.get(selector);
    }
  }
  return null;
}

// --- START: NEW HELPER FUNCTION ---
/**
 * Checks if an element's class list contains any class starting with "PredefinedType-".
 * @param {Element} element The DOM element to check.
 * @returns {boolean} True if a PredefinedType class is found.
 */
function elementHasPredefinedTypeClass(element) {
    if (!element || !element.classList) return false;
    for (const cls of element.classList) {
        if (cls.startsWith('PredefinedType-')) {
            return true;
        }
    }
    return false;
}

// Fixed picker function that properly handles material vs layer-material priority
export function enablePicker(svg) {
  if (!isEditing()) return;

  pickerHandler = async function (e) {
    if (e.shiftKey) return;
    e.preventDefault();
    e.stopPropagation();

    const clickedElement = e.target;

        // --- START: THIS IS THE FIX ---
    // Check if the clicked element or any of its parents is an IfcSpace.
    // If so, ignore the click entirely for picking purposes.
    if (clickedElement.closest('.IfcSpace')) {
      console.log('%cPicker: Ignored click on an ".IfcSpace" element.', 'color: magenta;');
      // We return here to stop any further processing. The user can still
      // use the ".IfcSpace" button in the default rules bar to style them all.
      return;
    }

    // --- START: SYMBOL DETECTION ---
    const symbolUse = clickedElement.closest('use');
    if (symbolUse) {
        const symbolId = symbolUse.href.baseVal.slice(1);
        console.log(`%cPicker: Clicked on a symbol: ${symbolId}`, 'color: lightblue;');

        // --- FIX #1: When entering Symbol Mode, clear the CSS rule state. ---
        setCurrentRuleObject(null);
        setNewRuleSelector(null);
        // --- END FIX #1 ---

        setCurrentSymbol({ id: symbolId });
        populateSymbolControls(symbolId);
        return; // Stop further processing
    }
    // --- END: SYMBOL DETECTION ---

        // --- THIS IS THE CRITICAL FIX for switching FROM Symbol TO CSS ---
    // If the click was not on a symbol, we immediately reset the UI to CSS mode.
    // This cleans up any leftover symbol controls before we proceed.
     // --- FIX #2: When entering CSS Mode, clear the Symbol state. ---
    setCurrentSymbol(null);
    setEditorMode('css');
    // --- END FIX #2 ---
    
    console.log('%cPicker: New element clicked.', 'color: yellow; font-weight: bold;');
    setLastPickedElement(e.target);
    console.log('%cPicker: Stored last picked element in state:', 'color: cyan;', e.target);

    const selectorCache = getSelectorCache();
    const ruleTitleContainer = document.getElementById('rule-title-container');
    const ruleTitle = document.getElementById('rule-title-text');
    // --- START: MODIFICATION ---
    // Remove all special styling from the title by default.
    // This resets the UI from any previous "create mode" state.
    ruleTitleContainer.classList.remove('input-create-mode');
    // We no longer need the createRuleContainer.
    // --- END: MODIFICATION ---

    setNewRuleSelector(null);

    if (selectorCache.size === 0) {
      ruleTitle.textContent = 'Error: Stylesheet not loaded correctly.';
      return;
    }    
    
    function getElementClasses(element) {
      if (!element) return [];
      const classAttr = element.getAttribute('class');
      if (classAttr) return classAttr.split(' ').filter(cls => cls.trim());
      if (element.className) {
        const classValue = typeof element.className === 'string' ? element.className : element.className.baseVal;
        return classValue.split(' ').filter(cls => cls.trim());
      }
      return [];
    }

    const tagName = clickedElement.tagName.toLowerCase();

    // --- START: REFINED TEXT DETECTION LOGIC ---
    // This branch now ONLY handles "Type 1" text (e.g., text.DIMENSION, text.title).
    // It specifically ignores text that has a PredefinedType class, letting it be handled by the shape logic below.
    if ((tagName === 'text' || tagName === 'tspan') && !elementHasPredefinedTypeClass(clickedElement)) {
      console.log('%cPicker: Clicked on a non-PredefinedType text element.', 'color: cyan;');
      const elementClasses = getElementClasses(clickedElement);

      if (elementClasses.length === 0) {
        console.log('%cPicker: Ignored click on text with no classes (uses default rule).', 'color: magenta;');
        ruleTitle.textContent = 'Uses default text styling';
        const { default: postcss } = await import('postcss');
        populateControls(postcss.rule({ selector: '' }));
        setCurrentRuleObject(null);
        return;
      }

      // Find the most relevant class, ignoring generic/system classes.
      const primaryClass = elementClasses.find(c => 
        c !== 'annotation' && 
        !c.startsWith('Ifc') && 
        !c.startsWith('GlobalId-')
      ) || elementClasses[0]; // Fallback just in case

      const idealSelectorPart1 = `text.${primaryClass}`;
      const idealSelectorPart2 = `tspan.${primaryClass}`;
      const searchPriority = [idealSelectorPart1, idealSelectorPart2];

      const bestAvailableRule = findRuleInCache(selectorCache, searchPriority);

      if (bestAvailableRule) {
        console.log(`%cPicker: Found text rule: "${bestAvailableRule.selector}"`, 'color: lightgreen;');
        setCurrentRuleObject(bestAvailableRule);
        populateControls(bestAvailableRule);
        ruleTitle.textContent = bestAvailableRule.selector;      } else {
        console.log(`%cPicker: No rule found. Offering to create new text rule for "${primaryClass}"`, 'color: orange;');
        const newRuleFullSelector = `${idealSelectorPart1}, ${idealSelectorPart2}`;
        ruleTitle.textContent = `Create rule for: ${primaryClass} (Text)`;
        setNewRuleSelector(newRuleFullSelector);
        

        const { default: postcss } = await import('postcss');
        populateControls(postcss.rule({ selector: newRuleFullSelector }));
        setCurrentRuleObject(null);
      }
      return; // End processing for this type of text.
    }

    // --- UNIFIED LOGIC FOR SHAPES AND "PredefinedType-TEXT" ---
    function findElementWithClasses(startElement) {
      let currentElement = startElement;
      while (currentElement && currentElement !== svg) {
        const classes = getElementClasses(currentElement);
        const hasMeaningfulClasses = classes.some(cls => 
          cls.startsWith('material-') || 
          cls.startsWith('Ifc') || 
          cls.includes('surface') || 
          cls.includes('cut') ||
          cls.startsWith('layer-material-') ||
          cls.startsWith('PredefinedType-')
        );
        
        if (hasMeaningfulClasses) {
          return { element: currentElement, classes };
        }
        currentElement = currentElement.parentElement;
      }
      return { element: startElement, classes: getElementClasses(startElement) };
    }

    const { element: targetElement, classes: elementClasses } = findElementWithClasses(clickedElement);
    const parentClasses = targetElement.parentElement ? getElementClasses(targetElement.parentElement) : [];

    const isProjection = elementClasses.includes('projection');
    const isCut = elementClasses.includes('cut');
    const isSurface = elementClasses.includes('surface');
    const hasMaterial = elementClasses.some(cls => cls.startsWith('material-'));

    if (isProjection) {
        console.log('%cPicker: Ignored click on a ".projection" element.', 'color: magenta;');
        return;
    }
    if (isCut && !hasMaterial) {
        console.log('%cPicker: Ignored click on a generic ".cut" element that has no material class.', 'color: magenta;');
        return;
    }

    const findAllClasses = (classes, prefix) => classes.filter(cls => cls.startsWith(prefix));
    
    let idealSelector = null;
    const searchPriority = [];
    const materialClasses = findAllClasses(elementClasses, 'material-');
    const layerMaterialClasses = findAllClasses(elementClasses, 'layer-material-');
    const parentLayerMaterialClasses = findAllClasses(parentClasses, 'layer-material-');
    const predefinedTypeClass = elementClasses.find(cls => cls.startsWith('PredefinedType-'));

    // Helper function to determine if a material is a compound (multi-layer) material
    function isCompoundMaterial(materialClass, elementClasses) {
      if (!materialClass) return false;
      const hasLayerMaterials = elementClasses.some(cls => cls.startsWith('layer-material-'));
      if (hasLayerMaterials) {
        console.log(`Material ${materialClass} is compound because it has explicit layer-material classes.`);
        return true;
      }
      return false;
    }

    // NEW, UNIFIED PRIORITY LOGIC
    if (predefinedTypeClass) {
        const tagName = targetElement.tagName.toLowerCase();
        const isTextElement = tagName === 'text' || tagName === 'tspan';

        if (predefinedTypeClass === 'PredefinedType-TEXTLEADER') {
            if (isTextElement) {
                idealSelector = 'text.PredefinedType-TEXTLEADER, tspan.PredefinedType-TEXTLEADER';
                searchPriority.push('tspan.PredefinedType-TEXTLEADER', 'text.PredefinedType-TEXTLEADER');
            } else { // Assumes path for the leader line
                idealSelector = 'path.PredefinedType-TEXTLEADER';
                searchPriority.push(idealSelector);
            }
        } else { // Generic handler for LINEWORK, TEXT, etc.
            const modifierClasses = elementClasses.filter(cls => 
                !cls.startsWith('Ifc') && 
                !cls.startsWith('GlobalId-') &&
                !cls.startsWith('PredefinedType-') &&
                cls !== 'cut' && cls !== 'surface'
            ).sort();

            let baseSelector;
            
            // Only prepend tag name if it's a base PredefinedType-TEXT on a text element.
            if (isTextElement && predefinedTypeClass === 'PredefinedType-TEXT' && modifierClasses.length === 0) {
                baseSelector = `tspan.PredefinedType-TEXT`;
                idealSelector = `text.PredefinedType-TEXT, tspan.PredefinedType-TEXT`;
            } else {
                // For all other cases (LINEWORK, or TEXT with subclasses), use a class-only selector.
                baseSelector = `.${predefinedTypeClass}`;
                idealSelector = baseSelector;
            }

            const idealSelectorWithModifiers = [baseSelector.split(',')[0].trim(), ...modifierClasses].join('.');
            
            if (modifierClasses.length > 0) {
                idealSelector = idealSelectorWithModifiers;
            }
            
            // Build search priority from most specific to least specific
            let currentSelector = idealSelectorWithModifiers;
            searchPriority.push(currentSelector);
            
            for (let i = modifierClasses.length - 1; i >= 0; i--) {
                const lastClass = modifierClasses[i];
                const classToTry = currentSelector.substring(0, currentSelector.lastIndexOf(`.${lastClass}`));
                if (classToTry !== currentSelector && !searchPriority.includes(classToTry)) {
                    searchPriority.push(classToTry);
                }
                currentSelector = classToTry;
            }
            
            if (!searchPriority.includes(baseSelector)) {
                searchPriority.push(baseSelector);
            }

            // Add text tag fallbacks ONLY for the base text rule case
            if (isTextElement && predefinedTypeClass === 'PredefinedType-TEXT' && modifierClasses.length === 0) {
                if (!searchPriority.includes(`tspan.PredefinedType-TEXT`)) searchPriority.push(`tspan.PredefinedType-TEXT`);
                if (!searchPriority.includes(`text.PredefinedType-TEXT`)) searchPriority.push(`text.PredefinedType-TEXT`);
                if (!searchPriority.includes(`.PredefinedType-TEXT`)) searchPriority.push(`.PredefinedType-TEXT`);
            }
        }
    } else if (layerMaterialClasses.length > 0) {
        idealSelector = `.${layerMaterialClasses[0]}`;
        searchPriority.push(idealSelector);
    } else if (parentLayerMaterialClasses.length > 0) {
        idealSelector = `.${parentLayerMaterialClasses[0]}`;
        searchPriority.push(idealSelector);
    } else if (isSurface && materialClasses.length > 0) {
        idealSelector = `.surface.${materialClasses[0]}`;
        searchPriority.push(idealSelector, '.surface');
    } else if (materialClasses.length > 0 && !isCompoundMaterial(materialClasses[0], elementClasses)) {
        idealSelector = `.${materialClasses[0]}`;
        searchPriority.push(idealSelector);
        const materialName = idealSelector.substring('.material-'.length);
        searchPriority.push(`.layer-material-${materialName}`);
    } else if (isSurface) {
        idealSelector = '.surface';
        searchPriority.push(idealSelector);
    }

    if (!idealSelector) {
      // --- FIX #3: Clear state and UI when clicking on an empty area (the canvas). ---
      ruleTitle.textContent = 'Click on an element to edit its style.';
      setCurrentRuleObject(null);
      setNewRuleSelector(null);
      const { default: postcss } = await import('postcss');
      populateControls(postcss.rule({ selector: '' })); // Visually clears the controls
      return;
      // --- END FIX #3 ---
    }
    
    const bestAvailableRule = findRuleInCache(selectorCache, searchPriority);

    const isPerfectMatch = idealSelector.split(',').every(sel => bestAvailableRule && bestAvailableRule.selectors.includes(sel.trim()));


    if (bestAvailableRule && isPerfectMatch) {
        // --- PERFECT MATCH ---
        console.log(`%cPicker: Perfect match found for '${idealSelector}'. Using existing rule: '${bestAvailableRule.selector}'`, 'color: lightgreen');
        populateControls(bestAvailableRule);
        ruleTitle.textContent = bestAvailableRule.selector;
        setCurrentRuleObject(bestAvailableRule);
    } else {
        // --- NO RULE FOUND or FALLBACK DETECTED ---
        ruleTitleContainer.classList.add('input-create-mode');
        setCurrentRuleObject(null);
        setNewRuleSelector(idealSelector);

        // If a fallback rule was found (e.g., found '.surface' instead of '.surface.material-X'),
        // populate the controls with its values as a starting point for the new rule.
        if (bestAvailableRule) {
            populateControls(bestAvailableRule);
        }

        const isSimpleMaterial = idealSelector && (idealSelector.startsWith('.material-') || idealSelector.startsWith('.layer-material-')) && !idealSelector.includes('.surface');

        if (isSimpleMaterial) {
            const baseName = idealSelector.substring(idealSelector.lastIndexOf('-') + 1);
            const finalText = `.material-${baseName} & .layer-material-${baseName}`;
            ruleTitle.textContent = `Create rule for: ${finalText}`;
            // If no fallback was found, clear the controls for a truly new rule.
            if (!bestAvailableRule) {
                const { default: postcss } = await import('postcss');
                populateControls(postcss.rule({ selector: finalText }));
            }
        } else {
            ruleTitle.textContent = `Create rule for: ${idealSelector}`;
            if (!bestAvailableRule) {
                const { default: postcss } = await import('postcss');
                populateControls(postcss.rule({ selector: idealSelector }));
            }
        }
    }
  };
  
  svg.addEventListener('click', pickerHandler);
}

export function disablePicker(svg) {
  if (pickerHandler) {
    svg.removeEventListener('click', pickerHandler);
    pickerHandler = null;
  }
}