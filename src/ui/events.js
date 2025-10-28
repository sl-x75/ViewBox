// src/ui/events.js

import {
  updateCssRule,
  updateFillControlVisibility,
  findAndPopulateSubElement, 
} from '../logic/cssEditor.js';
import { 
  populateMarkerSubElementControls, 
  applyMarkerSubElementStyle 
} from '../logic/markerStyler.js';
import {
  openPatternStyler,
  closePatternStyler,
  commitPatternStyles,
  populatePatternSubElementControls,
  populateAngleSelector,
} from '../logic/patternStyler.js';
import {
  isPatternUsedByOtherRules,
  promptForPatternCopy,
  displayPatternUsageWarning,
  handleConfirmPatternCopy,
} from '../logic/patternUtils.js';
import { updatePatternPreview } from '../logic/patternPreview.js';
import { saveChanges, loadCssFile, saveLayout } from '../logic/files.js';
import { writeFileContent } from '../utils/fileOperations.js'; 
import {
  isEditing,
  setCurrentMode,
  getIsLayoutFile,
  getLayoutModified,
  isUpdatingControls,
  getIsCssReadOnly, 
  getCurrentCssContent,
  getCurrentSvgElement,
  getCurrentRuleObject,
  getCurrentSymbol,
  getNewRuleSelector, 
} from '../state.js';
import { destroyManipulation, toggleManipulation } from '../manipulation.js';
import { loadSvgFile } from '../logic/svgLoader.js';
// Imports from codeEditor.js
import { 
  openFileInEditor, 
  saveCodeEditorContent, 
  closeCodeEditor,
  toggleSearchPanel,
  runFindNext,
  runFindPrevious,
  runReplaceNext,
  runReplaceAll,
  updateSearchQuery
} from '../logic/codeEditor.js';
import { populateSymbolControls, applyGenericStyleToAllSubElements } from '../logic/symbolStyler.js';
import { setSpaceVisualization } from '../logic/spaceColorizer.js';
import { saveSetting, applySetting, populateSettingsPanel, getSetting } from '../logic/settings.js';



export function initializeEventListeners() {

      // Generic helper for our new custom dropdowns
    const setupCustomDropdown = (buttonId, optionsWrapperId, optionsListId, valueInputId, selectedTextId, onSelectCallback) => {
        const button = document.getElementById(buttonId);
        const wrapper = document.getElementById(optionsWrapperId);
        const list = document.getElementById(optionsListId);
        
        if (!button || !wrapper || !list) return;

        let highlightIndex = -1;
        list.setAttribute('tabindex', '-1'); // Make list focusable

        const openDropdown = () => {
            wrapper.classList.remove('hidden');
            list.focus();
            const options = Array.from(list.querySelectorAll('li:not(.hidden)'));
            const selectedValue = valueInputId ? document.getElementById(valueInputId)?.value : null;
            highlightIndex = options.findIndex(opt => opt.dataset.value === selectedValue);
            if (highlightIndex === -1) highlightIndex = 0;
            updateHighlight();
        };

        const closeDropdown = () => {
            wrapper.classList.add('hidden');
            highlightIndex = -1;
            list.querySelectorAll('li').forEach(li => li.classList.remove('option-highlight'));
        };

        const updateHighlight = () => {
            const options = list.querySelectorAll('li:not(.hidden)');
            options.forEach((option, index) => {
                option.classList.toggle('option-highlight', index === highlightIndex);
            });
            if (options[highlightIndex]) {
                options[highlightIndex].scrollIntoView({ block: 'nearest' });
            }
        };

        button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (wrapper.classList.contains('hidden')) {
                openDropdown();
            } else {
                closeDropdown();
            }
        });

        list.addEventListener('blur', () => setTimeout(closeDropdown, 150));

        list.addEventListener('keydown', (e) => {
            const options = list.querySelectorAll('li:not(.hidden)');
            if (e.key !== 'Escape' && options.length === 0) return;

            let preventDefault = true;
            switch (e.key) {
                case 'Escape':
                    closeDropdown();
                    button.focus();
                    break;
                case 'ArrowDown':
                    highlightIndex = (highlightIndex < options.length - 1) ? highlightIndex + 1 : 0;
                    updateHighlight();
                    break;
                case 'ArrowUp':
                    highlightIndex = (highlightIndex > 0) ? highlightIndex - 1 : options.length - 1;
                    updateHighlight();
                    break;
                case 'Enter':
                case ' ': // Space bar
                    if (highlightIndex > -1 && options[highlightIndex]) {
                        options[highlightIndex].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    }
                    break;
                case 'Tab':
                    closeDropdown();
                    preventDefault = false;
                    break;
                default:
                    preventDefault = false;
            }
            if (preventDefault) e.preventDefault();
        });
        
        list.addEventListener('mousedown', (event) => {
            const li = event.target.closest('li[data-value]');
            if (li) {
                const value = li.dataset.value;
                if(document.getElementById(valueInputId)) document.getElementById(valueInputId).value = value;
                if(document.getElementById(selectedTextId)) document.getElementById(selectedTextId).textContent = li.textContent;
                wrapper.classList.add('hidden');
                
                // Fire the specific callback for this dropdown
                if (onSelectCallback) onSelectCallback(value);
            }
        });
    };

  // --- Find and REPLACE the file list click handler ---
  // --- REPLACE THE OLD FILE LIST CLICK HANDLER WITH THIS ---
  document.getElementById('sidebar').addEventListener('click', async (event) => {
    // Use .closest() to find the clicked file item, no matter how deeply nested it is.
    const listItem = event.target.closest('li[data-file-path]');
    
    if (listItem) {
      if (listItem.classList.contains('active')) {
        return; // Do nothing if the clicked item is already active
      }

      // Silently save any pending changes before switching
      // --- REPLACE THE SAVE BLOCK WITH THIS ---
      if (getSetting('files.autoSaveOnSwitch')) {
        if (isEditing()) {
          await saveChanges(true);
        } else if (getIsLayoutFile() && getLayoutModified()) {
          await saveLayout(true);
        }
      }
      // --- END REPLACEMENT ---

      
      const manipulationToggleContainer = document.getElementById('manipulation-toggle');
      const saveButton = document.getElementById('save-css-button');
      const filePath = listItem.dataset.filePath;
      const folder = listItem.dataset.folder;
      
      switch (folder) {
        case 'drawings':
          setCurrentMode('editing');
          if (manipulationToggleContainer) manipulationToggleContainer.style.display = 'none';
          saveButton.textContent = 'Save CSS';
          saveButton.style.display = 'inline-flex';
          break;
        case 'layouts':
          setCurrentMode('manipulating');
          if (manipulationToggleContainer) manipulationToggleContainer.style.display = 'block';
          saveButton.textContent = 'Save Layout';
          saveButton.style.display = 'inline-flex';
          break;
        case 'sheets':
          setCurrentMode('viewing');
          if (manipulationToggleContainer) manipulationToggleContainer.style.display = 'none';
          saveButton.style.display = 'none';
          break;
      }
      
      // Update active class on the correct list item
      document.querySelectorAll('#sidebar li.active').forEach(li => li.classList.remove('active'));
      listItem.classList.add('active');
      
      await loadSvgFile(filePath);
    }
  });
  // --- END OF REPLACEMENT ---
        
  // --- Drawing Info File Path Click Handler ---
  document.getElementById('active-drawing-info').addEventListener('click', async (event) => {
    const clickablePath = event.target.closest('.clickable-file-path');
    if (clickablePath) {
      const fullFilePath = clickablePath.dataset.fullFilePath;
      if (fullFilePath) {
        await openFileInEditor(fullFilePath);
      }
    }
  });

  // --- Code Editor Controls ---
  const saveEditorBtn = document.getElementById('code-editor-save-btn');
  const closeEditorBtn = document.getElementById('code-editor-close-btn');
  if (saveEditorBtn) {
    saveEditorBtn.addEventListener('click', saveCodeEditorContent);
  }
  if (closeEditorBtn) {
    closeEditorBtn.addEventListener('click', closeCodeEditor);
  }
  


  
  // Search Option Toggles
  const searchInput = document.getElementById('search-input');
  const replaceInput = document.getElementById('replace-input');
  const caseBtn = document.getElementById('search-case-btn');
  const wordBtn = document.getElementById('search-word-btn');
  const regexpBtn = document.getElementById('search-regexp-btn');
 
  // Helper function to handle toggle button clicks
  const setupSearchToggle = (button) => {
    // Add a null check to prevent errors
    if (!button) return;   
    button.addEventListener('click', () => {
      // Toggle the data-active attribute
      const isActive = button.dataset.active === 'true';
      button.dataset.active = !isActive;
      // Immediately update the search query to apply the change
      updateSearchQuery();
    });
  };

  setupSearchToggle(caseBtn);
  setupSearchToggle(wordBtn);
  setupSearchToggle(regexpBtn);


  // Add null checks for all other search-related elements
  if(document.getElementById('search-next-btn')) {
    document.getElementById('search-next-btn').addEventListener('click', runFindNext);
  }
  if(document.getElementById('search-prev-btn')) {
    document.getElementById('search-prev-btn').addEventListener('click', runFindPrevious);
  }
  if(document.getElementById('replace-btn')) {
    document.getElementById('replace-btn').addEventListener('click', runReplaceNext);
  }
  if(document.getElementById('replace-all-btn')) {
    document.getElementById('replace-all-btn').addEventListener('click', runReplaceAll);
  }
  
  if (searchInput) {
    searchInput.addEventListener('input', updateSearchQuery);
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'ArrowDown') {
        e.preventDefault();
        runFindNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        runFindPrevious();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        toggleSearchPanel(false);
      }
    });
  }

  if (replaceInput) {
    replaceInput.addEventListener('input', updateSearchQuery);
    replaceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); runReplaceNext(); }
      if (e.key === 'Escape') { e.preventDefault(); toggleSearchPanel(false); }
    });
  }
  

  // --- START: REWRITTEN SAVE BUTTON HANDLER ---
  const saveButton = document.getElementById('save-css-button');
  saveButton.addEventListener('click', async () => {
    try {
      if (getIsCssReadOnly()) {
        // ACTION: Save internal styles to a new file and reload.
        const targetPath = saveButton.dataset.targetCssPath;
        if (!targetPath) {
          alert('Error: Could not determine the target path to save the CSS file.');
          return;
        }

        const cssContent = getCurrentCssContent();
        await writeFileContent(targetPath, cssContent);
        
        alert('CSS file created successfully! Reloading in editing mode.');
        
        // Reload the current SVG. This will re-trigger the entire load process,
        // which will now find the CSS file and switch to the standard editing UI.
        const currentSvg = getCurrentSvgElement();
        if (currentSvg && currentSvg.dataset.filePath) {
          await loadSvgFile(currentSvg.dataset.filePath);
        }
      } else {
        // ACTION: Standard save for either a layout or a drawing's CSS.
        if (getIsLayoutFile()) {
          await saveLayout();
        } else {
          const reloadedPath = await saveChanges(); // Existing CSS save functionality
          if (reloadedPath) {
            await loadSvgFile(reloadedPath);
          }
        }
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Error during save: ' + error.message);
    }
  });
  // --- END: REWRITTEN SAVE BUTTON HANDLER ---


  // --- Main CSS Editor Controls (Your Original, Working Structure) ---
  // --- START: NEW EVENT LISTENERS FOR CUSTOM SELECTS ---

  // Logic for the custom Fill Type dropdown
  const fillTypeButton = document.getElementById('fill-type-button');
  const fillTypeOptionsWrapper = document.getElementById('fill-type-options-wrapper');
  const fillTypeOptions = document.getElementById('fill-type-options');
  const fillTypeInput = document.getElementById('fill-type');
  const fillTypeSelectedText = document.getElementById('fill-type-selected-text');

  if (fillTypeButton && fillTypeOptionsWrapper && fillTypeOptions) {
    let highlightIndex = -1;
    fillTypeOptions.setAttribute('tabindex', '-1');

    const openDropdown = () => {
        fillTypeOptionsWrapper.classList.remove('hidden');
        fillTypeOptions.focus();
        const options = Array.from(fillTypeOptions.querySelectorAll('li'));
        highlightIndex = options.findIndex(opt => opt.dataset.value === fillTypeInput.value);
        if (highlightIndex === -1) highlightIndex = 0;
        options.forEach((opt, i) => opt.classList.toggle('option-highlight', i === highlightIndex));
    };

    const closeDropdown = () => {
        fillTypeOptionsWrapper.classList.add('hidden');
        highlightIndex = -1;
        fillTypeOptions.querySelectorAll('li').forEach(li => li.classList.remove('option-highlight'));
    };

    fillTypeButton.addEventListener('click', (e) => {
        e.stopPropagation();
        if (fillTypeOptionsWrapper.classList.contains('hidden')) {
            openDropdown();
        } else {
            closeDropdown();
        }
    });

    fillTypeOptions.addEventListener('blur', () => setTimeout(closeDropdown, 150));

    fillTypeOptions.addEventListener('keydown', (e) => {
        const options = Array.from(fillTypeOptions.querySelectorAll('li'));
        if (e.key !== 'Escape' && options.length === 0) return;

        let preventDefault = true;
        switch (e.key) {
            case 'Escape':
                closeDropdown();
                fillTypeButton.focus();
                break;
            case 'ArrowDown':
                highlightIndex = (highlightIndex < options.length - 1) ? highlightIndex + 1 : 0;
                break;
            case 'ArrowUp':
                highlightIndex = (highlightIndex > 0) ? highlightIndex - 1 : 0;
                break;
            case 'Enter':
            case ' ':
                if (highlightIndex > -1 && options[highlightIndex]) {
                    options[highlightIndex].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                }
                break;
            case 'Tab':
                closeDropdown();
                preventDefault = false;
                break;
            default:
                preventDefault = false;
        }
        
        if (preventDefault) {
            e.preventDefault();
            options.forEach((opt, i) => opt.classList.toggle('option-highlight', i === highlightIndex));
            if (options[highlightIndex]) options[highlightIndex].scrollIntoView({ block: 'nearest' });
        }
    });

    // Use mousedown on options to select before blur event on button hides the dropdown
    fillTypeOptions.addEventListener('mousedown', (event) => {
        const li = event.target.closest('li[data-value]');
        if (li) {
            const value = li.dataset.value;
            fillTypeInput.value = value;
            fillTypeSelectedText.textContent = li.textContent;
            fillTypeOptionsWrapper.classList.add('hidden');
            updateFillControlVisibility();
            updateCssRule();
        }
    });
  }

  // Logic for the custom Fill Pattern combobox
  const fillPatternInput = document.getElementById('fill-pattern-input');
  const fillPatternOptions = document.getElementById('fill-pattern-options');
  let fillPatternHighlightIndex = -1;

  if (fillPatternInput && fillPatternOptions) {
    fillPatternInput.addEventListener('focus', () => {
      fillPatternOptions.classList.remove('hidden');
    });

    fillPatternInput.addEventListener('blur', () => {
      setTimeout(() => {
        fillPatternOptions.classList.add('hidden');
      }, 150);
    });

    fillPatternInput.addEventListener('input', () => {
      const filter = fillPatternInput.value.toLowerCase();
      const options = fillPatternOptions.querySelectorAll('li');
      options.forEach(option => {
        const text = option.textContent.toLowerCase();
        option.classList.toggle('hidden', !text.includes(filter));
      });
      fillPatternHighlightIndex = -1;
    });

    fillPatternOptions.addEventListener('click', (event) => {
      const clickedLi = event.target.closest('li[data-value]');
      if (clickedLi) {
        const patternId = clickedLi.dataset.value;
        fillPatternInput.value = patternId;
        fillPatternOptions.classList.add('hidden');
        
        const patternUrl = `url(#${patternId})`;
        const currentRule = getCurrentRuleObject();
        const isInUse = isPatternUsedByOtherRules(patternUrl, currentRule);
        displayPatternUsageWarning(isInUse, patternId);
        updatePatternPreview(patternUrl);
        updateCssRule();

        const patternEditorPanel = document.getElementById('pattern-editor-panel');
        if (patternEditorPanel && !patternEditorPanel.classList.contains('hidden')) {
          console.log('[Sync] Forcing pattern editor to refresh for new selection...');
          openPatternStyler();
        }       
        
      }
    });

    fillPatternInput.addEventListener('keydown', (e) => {
      const visibleOptions = Array.from(fillPatternOptions.querySelectorAll('li:not(.hidden)'));
      if (visibleOptions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          fillPatternHighlightIndex = (fillPatternHighlightIndex < visibleOptions.length - 1) ? fillPatternHighlightIndex + 1 : 0;
          break;
        case 'ArrowUp':
          e.preventDefault();
          fillPatternHighlightIndex = (fillPatternHighlightIndex > 0) ? fillPatternHighlightIndex - 1 : visibleOptions.length - 1;
          break;
        case 'Enter':
          e.preventDefault();
          if (fillPatternHighlightIndex > -1 && visibleOptions[fillPatternHighlightIndex]) {
            visibleOptions[fillPatternHighlightIndex].click();
          }
          break;
        case 'Escape':
          fillPatternInput.blur();
          break;
      }

      visibleOptions.forEach((option, index) => {
        option.classList.toggle('option-highlight', index === fillPatternHighlightIndex);
      });
      if (visibleOptions[fillPatternHighlightIndex]) {
        visibleOptions[fillPatternHighlightIndex].scrollIntoView({ block: 'nearest' });
      }
    });
  }

  // --- END: NEW EVENT LISTENERS FOR CUSTOM SELECTS ---

  document.getElementById('fill-color').addEventListener('input', () => {
    // If the controls are being programmatically updated, do nothing.
    if (isUpdatingControls()) {
      return;
    }
    updateCssRule();
  });

  document.addEventListener('click', (event) => {
    if (event.target && event.target.id === 'copy-pattern-btn') {
      event.preventDefault();
      const originalPatternId = event.target.dataset.originalPatternId;
      if (originalPatternId) {
        promptForPatternCopy(originalPatternId);
      }
    }
  });
    // --- REPLACE THIS LISTENER ---
  document.getElementById('stroke-color').addEventListener('input', () => {
    // If the controls are being programmatically updated, do nothing.
    if (isUpdatingControls()) {
      return;
    }
    updateCssRule();
  });
  document.getElementById('stroke-width').addEventListener('input', () => {
    document.getElementById('stroke-width-value').textContent = document.getElementById('stroke-width').value;
    updateCssRule();
  });
  document.getElementById('stroke-dasharray').addEventListener('change', updateCssRule);


    // Setup for Marker Styler Dropdown
    setupCustomDropdown(
        'marker-sub-element-button',
        'marker-sub-element-options-wrapper',
        'marker-sub-element-options',
        'marker-sub-element-selector-value',
        'marker-sub-element-selected-text',
        (selectedValue) => {
            document.getElementById('marker-styler-panel').dataset.currentSubElement = selectedValue;
            populateMarkerSubElementControls(selectedValue);
        }
    );

    // Listeners for the new marker styler controls
    document.getElementById('marker-element-fill').addEventListener('input', () => {
        if (!isUpdatingControls()) applyMarkerSubElementStyle();
    });
    document.getElementById('marker-element-stroke').addEventListener('input', () => {
        if (!isUpdatingControls()) applyMarkerSubElementStyle();
    });

    // --- END: ADD THIS BLOCK ---

  // --- START: NEW, COMPLETE LOGIC FOR CUSTOM COMBOBOX ---

  const fontFamilyInput = document.getElementById('font-family-input');
  const fontFamilyOptions = document.getElementById('font-family-options');
  let highlightIndex = -1;

  if (fontFamilyInput && fontFamilyOptions) {
    // Show dropdown on focus
    fontFamilyInput.addEventListener('focus', () => {
      fontFamilyOptions.classList.remove('hidden');
    });

    // Hide dropdown on blur, with a delay to allow clicks to register
    fontFamilyInput.addEventListener('blur', () => {
      setTimeout(() => fontFamilyOptions.classList.add('hidden'), 150);
    });

    // Handle filtering as the user types
    fontFamilyInput.addEventListener('input', () => {
      const filter = fontFamilyInput.value.toLowerCase();
      const options = fontFamilyOptions.querySelectorAll('li');
      options.forEach(option => {
        const text = option.textContent.toLowerCase();
        option.classList.toggle('hidden', !text.includes(filter));
      });
      highlightIndex = -1; // Reset highlight on filter
    });

    // Handle clicks on the options
    fontFamilyOptions.addEventListener('click', (event) => {
      const clickedLi = event.target.closest('li');
      if (clickedLi) {
        fontFamilyInput.value = clickedLi.dataset.value;
        fontFamilyOptions.classList.add('hidden');
        updateCssRule();
      }
    });

    // Handle keyboard navigation
    fontFamilyInput.addEventListener('keydown', (e) => {
      const visibleOptions = Array.from(fontFamilyOptions.querySelectorAll('li:not(.hidden)'));
      if (visibleOptions.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          highlightIndex = (highlightIndex < visibleOptions.length - 1) ? highlightIndex + 1 : 0;
          break;
        case 'ArrowUp':
          e.preventDefault();
          highlightIndex = (highlightIndex > 0) ? highlightIndex - 1 : visibleOptions.length - 1;
          break;
        case 'Enter':
          e.preventDefault();
          if (highlightIndex > -1 && visibleOptions[highlightIndex]) {
            visibleOptions[highlightIndex].click(); // Simulate a click to select
          }
          break;
        case 'Escape':
          fontFamilyInput.blur(); // Close dropdown
          break;
      }

      // Update visual highlight
      visibleOptions.forEach((option, index) => {
        option.classList.toggle('option-highlight', index === highlightIndex);
      });
       if (visibleOptions[highlightIndex]) {
        visibleOptions[highlightIndex].scrollIntoView({ block: 'nearest' });
      }
    });
  }




  // --- END: DEFINITIVE FIX FOR TEXT CONTROLS ---

    // The other text control listeners remain the same and are correct.
  document.getElementById('font-fill-color').addEventListener('input', () => {
    if (!isUpdatingControls()) {
      updateCssRule();
    }
  });

const fontSizeWrapper = document.getElementById('font-size-control-wrapper');
if (fontSizeWrapper) {
    fontSizeWrapper.addEventListener('click', (event) => {
        // We only care about clicks on the increment/decrement buttons.
        if (event.target.closest('[data-hs-input-number-increment]') || event.target.closest('[data-hs-input-number-decrement]')) {
            
            // Wait for the library to finish its own task of updating the visual input value.
            // This timeout wins the "race condition" you correctly identified.
            setTimeout(() => {
                // Now that the visual value is correct, simply tell our app to update the CSS.
                // Our other fix ensures the *next* click will calculate from this new value.
                updateCssRule();
            }, 0);
        }
    });
}

// --- START: ADD THIS ENTIRE BLOCK ---------------------------------------------------------------------------------------------
// This adds the missing listeners for the font size text input itself.
const fontSizeInput = document.getElementById('font-size-input');
if (fontSizeInput) {
  // 1. Listen for the "Enter" key
  fontSizeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      // Prevent the default form submission behavior
      event.preventDefault();
      // Apply the CSS rule
      updateCssRule();
      // Optional: blur the input to signify the action is complete
      fontSizeInput.blur();
    }
  });

  // 2. Listen for the 'change' event (fires on blur if the value has changed)
  fontSizeInput.addEventListener('change', () => {
    // This handles the case where the user types a value and clicks away.
    if (isUpdatingControls()) return;
    updateCssRule();
  });
}
// --- END: ADD THIS ENTIRE BLOCK ---

  // --- Pattern Styler Controls ---
  // --- REPLACE THE ENTIRE "Pattern Styler Controls" SECTION ---
  document.getElementById('pattern-preview-container').addEventListener('click', openPatternStyler);
  document.getElementById('close-pattern-editor').addEventListener('click', closePatternStyler);
    // When the "Rotate" button is clicked, populate the angle options
  document.getElementById('pattern-angle-selector-btn').addEventListener('click', (event) => {
    populateAngleSelector();
  });

  // When an angle is clicked from the dropdown menu
  document.getElementById('pattern-angle-options-menu').addEventListener('click', (event) => {
      const target = event.target.closest('a[data-angle]');
      if (!target) return;
  
      event.preventDefault();
  
      const angle = parseFloat(target.dataset.angle);
      const slider = document.getElementById('pattern-rotate');
      const valueDisplay = document.getElementById('pattern-rotate-value');
  
      if (slider && valueDisplay) {
          slider.value = angle;
          valueDisplay.textContent = Math.round(angle);
          
          // --- THIS IS THE FIX ---
          // Call the commit function with the correct type to apply the change immediately.
          commitPatternStyles('transform');
      }
  });
  
  // Generic handler for all pattern control inputs
  const addPatternControlListener = (elementId, commitType, valueId = null) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.addEventListener('input', (e) => {
      if (isUpdatingControls()) return; // <-- FIX: Prevent feedback loop
      if (valueId) document.getElementById(valueId).textContent = e.target.value;
      // Commit on every input event for live feedback
      commitPatternStyles(commitType);
    });
  };

  // Global Transform Controls
  addPatternControlListener('pattern-scale-x', 'transform', 'pattern-scale-x-value');
  addPatternControlListener('pattern-scale-y', 'transform', 'pattern-scale-y-value');
  addPatternControlListener('pattern-rotate', 'transform', 'pattern-rotate-value');

  // Sub-Element Style Controls
  addPatternControlListener('pattern-element-fill', 'style');
  addPatternControlListener('pattern-element-stroke', 'style');
  addPatternControlListener('pattern-element-stroke-width', 'style', 'pattern-element-stroke-width-value');

  // --- Modal Event Listeners ---
  const confirmCopyBtn = document.getElementById('confirm-pattern-copy-btn');
  if (confirmCopyBtn) {
    confirmCopyBtn.addEventListener('click', async () => {
      const newPatternId = await handleConfirmPatternCopy();
      
      if (newPatternId) {
        const fillPatternInput = document.getElementById('fill-pattern-input');
        const fillPatternOptions = document.getElementById('fill-pattern-options');

        const newLi = document.createElement('li');
        newLi.className = 'combobox-int';
        newLi.dataset.value = newPatternId;
        newLi.textContent = newPatternId;
        newLi.setAttribute('tabindex', '-1');
        fillPatternOptions.appendChild(newLi);
        
        fillPatternInput.value = newPatternId;

        displayPatternUsageWarning(false, newPatternId);
        updatePatternPreview(`url(#${newPatternId})`);
        updateCssRule();
        
        const notification = document.createElement('div');
        notification.className = ' modal-warning';
        notification.textContent = `Pattern copied successfully! Now editing "${newPatternId}".`;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 3000);
      }
    });
  }

  const newPatternIdInput = document.getElementById('new-pattern-id-input');
  if (newPatternIdInput) {
    newPatternIdInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmCopyBtn.click();
      }
    });
  }
  
  // --- Symbol Editor Controls (Definitively Context-Aware) ---
  const symbolFillColor = document.getElementById('symbol-fill-color');
  const symbolStrokeColor = document.getElementById('symbol-stroke-color');
  const symbolStrokeWidth = document.getElementById('symbol-stroke-width');

  // Helper function with the corrected logic for all symbol control inputs
  // --- Find and REPLACE the symbolControlHandler function ---
  const symbolControlHandler = () => {
    if (isUpdatingControls()) return;

    const currentRule = getCurrentRuleObject();
    const newRuleSelector = getNewRuleSelector();
    const currentSymbol = getCurrentSymbol();

    if (currentRule || newRuleSelector) {
      // CASE 1: A specific sub-element is selected.
      // updateCssRule handles creating/updating nth-of-type rules perfectly. This is correct.
      updateCssRule();
    } 
    else if (currentSymbol) {
      // CASE 2: No specific sub-element is selected, so we are in "Generic Style" mode.
      // Call our new function to apply the style to all sub-elements.
      applyGenericStyleToAllSubElements(currentSymbol.id);
    }
  };

  if (symbolFillColor) {
    symbolFillColor.addEventListener('input', symbolControlHandler);
  }
  if (symbolStrokeColor) {
    symbolStrokeColor.addEventListener('input', symbolControlHandler);
  }
  if (symbolStrokeWidth) {
    symbolStrokeWidth.addEventListener('input', () => {
      document.getElementById('symbol-stroke-width-value').textContent = symbolStrokeWidth.value;
      symbolControlHandler();
    });
  }

      // START: REVISED LISTENER FOR SYMBOL INSPECTOR DROPDOWN
      const inspectorButton = document.getElementById('symbol-inspector-button');
      const inspectorOptionsWrapper = document.getElementById('symbol-inspector-options-wrapper');
      const inspectorList = document.getElementById('symbol-inspector-list');

      if (inspectorButton && inspectorOptionsWrapper && inspectorList) {
        let highlightIndex = -1;
        inspectorList.setAttribute('tabindex', '-1');

        const openDropdown = () => {
            inspectorOptionsWrapper.classList.remove('hidden');
            inspectorList.focus();
            const options = Array.from(inspectorList.querySelectorAll('li'));
            highlightIndex = options.findIndex(opt => opt.classList.contains('option-highlight'));
            if (highlightIndex === -1) highlightIndex = 0;
            options.forEach((opt, i) => opt.classList.toggle('option-highlight', i === highlightIndex));
        };

        const closeDropdown = () => {
            inspectorOptionsWrapper.classList.add('hidden');
            highlightIndex = -1;
            inspectorList.querySelectorAll('li').forEach(li => li.classList.remove('option-highlight'));
        };

        inspectorButton.addEventListener('click', (e) => {
            e.stopPropagation();
            if (inspectorOptionsWrapper.classList.contains('hidden')) {
                openDropdown();
            } else {
                closeDropdown();
            }
        });

        inspectorList.addEventListener('blur', () => setTimeout(closeDropdown, 150));

        inspectorList.addEventListener('keydown', (e) => {
            const options = Array.from(inspectorList.querySelectorAll('li'));
            if (e.key !== 'Escape' && options.length === 0) return;

            let preventDefault = true;
            switch (e.key) {
                case 'Escape':
                    closeDropdown();
                    inspectorButton.focus();
                    break;
                case 'ArrowDown':
                    highlightIndex = (highlightIndex < options.length - 1) ? highlightIndex + 1 : 0;
                    break;
                case 'ArrowUp':
                    highlightIndex = (highlightIndex > 0) ? highlightIndex - 1 : 0;
                    break;
                case 'Enter':
                case ' ':
                    if (highlightIndex > -1 && options[highlightIndex]) {
                        options[highlightIndex].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                    }
                    break;
                case 'Tab':
                    closeDropdown();
                    preventDefault = false;
                    break;
                default:
                    preventDefault = false;
            }

            if (preventDefault) {
                e.preventDefault();
                options.forEach((opt, i) => opt.classList.toggle('option-highlight', i === highlightIndex));
                if (options[highlightIndex]) options[highlightIndex].scrollIntoView({ block: 'nearest' });
            }
        });

        // Handle the actual click on a list item
  inspectorList.addEventListener('mousedown', (event) => {
    const listItem = event.target.closest('li[data-symbol-id]');
    if (!listItem) return;

    const { symbolId, elementIndex, elementTag, action } = listItem.dataset;
    const selectedText = document.getElementById('symbol-inspector-selected-text');
    
    // Update highlighting in the list
    inspectorList.querySelectorAll('li').forEach(li => li.classList.remove('option-highlight'));
    listItem.classList.add('option-highlight');

    // Handle which item was clicked
    if (action === 'show-generic') {
      // User clicked "Generic Style". Repopulate everything from scratch.
      populateSymbolControls(symbolId); // This also resets the controls and title
      selectedText.textContent = `Editing: Generic Style`;
    } else {
      // User clicked a sub-element.
      findAndPopulateSubElement(symbolId, elementTag, parseInt(elementIndex, 10));
      selectedText.textContent = `Editing: ${listItem.textContent}`;
    }

    // Do NOT hide the dropdown.
    // inspectorOptionsWrapper.classList.add('hidden');
  });
}
      // END: REVISED LISTENER FOR SYMBOL INSPECTOR DROPDOWN  


  // --- Other UI Handlers ---
  const manipulationToggle = document.getElementById('manipulation-enabled');
  if (manipulationToggle) {
    manipulationToggle.addEventListener('change', (event) => {
      toggleManipulation(event.target.checked);
    });
  }

  window.addEventListener('beforeunload', (event) => {
    if (getLayoutModified()) {
      event.preventDefault();
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      return event.returnValue;
    }
  });

  const recentProjectsList = document.getElementById('recent-projects-list');
  const openProjectButton = document.getElementById('open-project-button');

  if (recentProjectsList) {
    recentProjectsList.addEventListener('click', (event) => {
      const projectCard = event.target.closest('a[data-path]');
      if (projectCard) {
        event.preventDefault();
        showMainApp(projectCard.dataset.path);
      }
    });
  }

  if (openProjectButton) {
    openProjectButton.addEventListener('click', async () => {
      const projectPath = await ipcRenderer.invoke('open-project-dialog');
      if (projectPath) {
        showMainApp(projectPath);
      }
    });
  }

  // --- START: ADD THIS NEW EVENT LISTENER ---
  const backToStartPageBtn = document.getElementById('back-to-start-page-btn');
  if (backToStartPageBtn) {
    backToStartPageBtn.addEventListener('click', () => {
      // Reloading the window is the safest and cleanest way to reset all state
      // and return to the start page.
      location.reload();
    });
  }

  // --- REPLACE the old spaceColorizerToggle listener with this block ---
  const spaceVizGroup = document.getElementById('space-visualization-group');
  if (spaceVizGroup) {
    spaceVizGroup.addEventListener('change', (event) => {
      // The event target is the radio button that was just selected.
      // Its value will be 'hidden', 'default', or 'colorized'.
      setSpaceVisualization(event.target.value);
    });
  }

    // Setup for Pattern Sub-Element Dropdown
    setupCustomDropdown(
        'pattern-sub-element-button',
        'pattern-sub-element-options-wrapper',
        'pattern-sub-element-options',
        'pattern-sub-element-selector-value',
        'pattern-sub-element-selected-text',
        (selectedValue) => {
            document.getElementById('pattern-editor-panel').dataset.currentSubElement = selectedValue;
            populatePatternSubElementControls(selectedValue);
        }
    );

    // Setup for Marker Start Dropdown
    setupCustomDropdown(
        'marker-start-button',
        'marker-start-options-wrapper',
        'marker-start-options',
        'marker-start-value',
        'marker-start-selected-text',
        () => updateCssRule() // On select, just update the main CSS rule
    );

    // Setup for Marker End Dropdown
    setupCustomDropdown(
        'marker-end-button',
        'marker-end-options-wrapper',
        'marker-end-options',
        'marker-end-value',
        'marker-end-selected-text',
        () => updateCssRule() // On select, just update the main CSS rule
    );

  // --- REPLACE THE PREVIOUS SETTINGS LISTENERS WITH THIS BLOCK ---
  const projectBtn = document.getElementById('sidebar-project-btn');
  const settingsBtn = document.getElementById('sidebar-settings-btn');
  const projectView = document.getElementById('sidebar-project-view');
  const settingsView = document.getElementById('sidebar-settings-view');

  if (projectBtn && settingsBtn && projectView && settingsView) {
    // Show Project View
    projectBtn.addEventListener('click', () => {
      projectView.classList.remove('hidden');
      settingsView.classList.add('hidden');
      projectBtn.classList.add('active');
      settingsBtn.classList.remove('active');
    });

    // Show Settings View
    settingsBtn.addEventListener('click', () => {
      projectView.classList.add('hidden');
      settingsView.classList.remove('hidden');
      projectBtn.classList.remove('active');
      settingsBtn.classList.add('active');
      
      // Ensure the panel is populated with current settings when opened
      populateSettingsPanel();
    });
  }

  // Helper for saving and applying on change
  const addSettingListener = (elementId, key, valueFn, isLive = false) => {
    const element = document.getElementById(elementId);
    if (!element) return;
    const eventType = element.type === 'checkbox' ? 'change' : 'input';

    if (isLive) {
        element.addEventListener(eventType, (e) => applySetting(key, valueFn(e.target)));
    }
    element.addEventListener('change', (e) => saveSetting(key, valueFn(e.target)));
  };

  // Appearance
  addSettingListener('setting-viewer-bg-color', 'viewer.backgroundColor', el => el.value, true);
  addSettingListener('setting-viewer-bg-color-dark', 'viewer.backgroundColorDark', el => el.value, true);
  addSettingListener('setting-coloris-swatches', 'coloris.swatches', el => el.value.split(',').map(s => s.trim()).filter(s => s.startsWith('#')), true);
  addSettingListener('setting-theme-mode', 'theme.mode', el => el.value, true);
  addSettingListener('setting-ifcspace-default-display', 'ifcSpace.defaultDisplay', el => el.value);

 // Start Page
  addSettingListener('setting-startpage-recents-count', 'startPage.recentProjectsCount', el => parseInt(el.value, 10));
  
  // Code Editor
  addSettingListener('setting-ce-font-size', 'codeEditor.fontSize', el => parseInt(el.value, 10), true);
  addSettingListener('setting-ce-font-family', 'codeEditor.fontFamily', el => el.value, true);
  addSettingListener('setting-ce-word-wrap', 'codeEditor.wordWrap', el => el.checked, true);
  
  // Files
  addSettingListener('setting-files-autosave', 'files.autoSaveOnSwitch', el => el.checked);

  // Sliders
  const addSliderListeners = (prefix, key) => {
    const minEl = document.getElementById(`setting-slider-${prefix}-min`);
    const maxEl = document.getElementById(`setting-slider-${prefix}-max`);
    const stepEl = document.getElementById(`setting-slider-${prefix}-step`);

    [minEl, maxEl, stepEl].forEach(el => {
      if (el) {
        el.addEventListener('change', () => {
          const newValues = {
            min: parseFloat(minEl.value),
            max: parseFloat(maxEl.value),
            step: parseFloat(stepEl.value)
          };
          saveSetting(`sliders.${key}`, newValues);
          applySetting(`sliders.${key}`, newValues);
        });
      }
    });
  };

  addSliderListeners('sw', 'strokeWidth');
  addSliderListeners('ps', 'patternScale');
  addSliderListeners('psw', 'patternStrokeWidth');
  // --- END OF REPLACEMENT BLOCK ---


    // --- END: ADD THIS BLOCK ---
  console.log('Event listeners initialized');
}