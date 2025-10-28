// src/logic/debugging.js

import { getCurrentCssContent, getPatternDefs, getCurrentRuleObject } from './state.js';
import { isPatternUsedByOtherRules, displayPatternUsageWarning } from './patternUtils.js';

function debugPatternUsage(patternUrl) {
  console.group('🔍 Pattern Usage Debug');
  
  const cssContent = getCurrentCssContent();
  console.log('CSS Content length:', cssContent?.length || 'No CSS content');
  
  if (!cssContent) {
    console.log('❌ No CSS content found');
    console.groupEnd();
    return false;
  }

  console.log('CSS Content sample (first 500 chars):\n', cssContent.substring(0, 500));
  
  const patternIdMatch = patternUrl?.match(/#([^)]+)/);
  if (!patternIdMatch) {
    console.log('❌ Could not extract pattern ID from URL:', patternUrl);
    console.groupEnd();
    return false;
  }
  
  const patternId = patternIdMatch[1];
  console.log('Extracted pattern ID:', patternId);
  
  const testPatterns = [
    {
      name: 'Basic fill pattern',
      regex: new RegExp(`fill\s*:\s*url\s*\(\s*['"']?#${patternId.replace(/[.*+?^${}()|[\\]/g, '\\$&')}['"']?\s*\)`, 'gi')
    },
    {
      name: 'Case insensitive fill',
      regex: new RegExp(`fill\s*:\s*url\s*\(\s*['"']?#${patternId.replace(/[.*+?^${}()|[\\]/g, '\\$&')}['"']?\s*\)`, 'i')
    },
    {
      name: 'Simple case sensitive',
      regex: new RegExp(`fill:\s*url\(#${patternId}\)`)
    },
    {
      name: 'Very loose pattern',
      regex: new RegExp(`#${patternId}`, 'gi')
    }
  ];
  
  console.log('Testing regex patterns:');
  testPatterns.forEach(({ name, regex }) => {
    const matches = cssContent.match(regex);
    console.log(`${name}:`, matches ? `✅ Found ${matches.length} matches` : '❌ No matches');
    if (matches) {
      console.log('  Matches:', matches);
    }
  });
  
  const patternIdInCss = cssContent.includes(`#${patternId}`);
  console.log(`Pattern ID "${patternId}" found anywhere in CSS:`, patternIdInCss ? '✅ Yes' : '❌ No');
  
  const fillDeclarations = cssContent.match(/fill\s*:[^;}]+/gi);
  console.log('All fill declarations found:', fillDeclarations);
  
  console.groupEnd();
  
  return isPatternUsedByOtherRules(patternUrl, getCurrentRuleObject());
}

function debugPatternDefinitions() {
  console.group('📋 Pattern Definitions Debug');
  
  const patternDefs = getPatternDefs();
  console.log('Pattern definitions:', patternDefs);
  console.log('Number of patterns:', Object.keys(patternDefs).length);
  
  Object.entries(patternDefs).forEach(([id, html]) => {
    console.log(`Pattern "${id}":`);
    console.log('  HTML length:', html?.length || 'No HTML');
    console.log('  HTML preview:', html?.substring(0, 100) + '...');
  });
  
  console.groupEnd();
}

function debugFillPatternDropdown() {
  console.group('📋 Fill Pattern Dropdown Debug');
  
  const fillPatternSelect = document.getElementById('fill-pattern-input');
  if (!fillPatternSelect) {
    console.log('❌ fill-pattern-input element not found');
    console.groupEnd();
    return;
  }
  
  console.log('Current selected value:', fillPatternSelect.value);
  
  const fillPatternOptions = document.getElementById('fill-pattern-options');
  if (!fillPatternOptions) {
    console.log('❌ fill-pattern-options element not found');
    console.groupEnd();
    return;
  }
  
  console.log('Available options:');
  Array.from(fillPatternOptions.querySelectorAll('li')).forEach((option, index) => {
    console.log(`  ${index}: "${option.dataset.value}" - "${option.textContent}"`);
  });
  
  console.groupEnd();
}

function debugPatternWarningSystem() {
  console.log('🔍 Debug Pattern Warning System');
  
  const warningContainer = document.getElementById('rule-title-warning-area');
  console.log('Warning container found:', !!warningContainer);
  if (warningContainer) {
    console.log('Warning container current content:', warningContainer.innerHTML);
  }
  
  const fillPatternInput = document.getElementById('fill-pattern-input');
  if (fillPatternInput) {
    console.log('Current pattern selection:', fillPatternInput.value);
    
    displayPatternUsageWarning(true, 'parquet');
    console.log('After test - Warning container content:', warningContainer.innerHTML);
    
    const copyButton = document.getElementById('copy-pattern-btn');
    console.log('Copy button found after test:', !!copyButton);
    if (copyButton) {
      console.log('Copy button dataset:', copyButton.dataset);
    }
  }
}

export function initializeDebugTools() {
    console.log('🐛 Bonsai debugging tools enabled. Functions are now available on the window object.');

    window.debugPatternUsage = debugPatternUsage;
    window.debugPatternDefinitions = debugPatternDefinitions;
    window.debugFillPatternDropdown = debugFillPatternDropdown;
    window.debugPatternWarningSystem = debugPatternWarningSystem;

    window.debugPatternSystem = function(patternUrl) {
        console.clear();
        console.log('🐛 Starting Pattern System Debug');
        
        if (!patternUrl) {
            const fillPatternInput = document.getElementById('fill-pattern-input');
            patternUrl = fillPatternInput ? `url(#${fillPatternInput.value})` : null;
        }
        
        if (!patternUrl) {
            console.log('❌ No pattern URL provided and none selected');
            return;
        }
        
        debugFillPatternDropdown();
        debugPatternDefinitions();
        const isInUse = debugPatternUsage(patternUrl);
        
        console.log('🎯 Final result: Pattern in use =', isInUse);
        
        return isInUse;
    };


  // --- In events.js, add this block at the end of initializeEventListeners ---
//
document.addEventListener('click', (event) => {
    const incrementBtn = event.target.closest('[data-hs-input-number-increment]');
    const decrementBtn = event.target.closest('[data-hs-input-number-decrement]');

    if (incrementBtn || decrementBtn) {
        // Check if this click is for our font-size input
        const wrapper = document.getElementById('font-size-control-wrapper');
        if (wrapper.contains(event.target)) {
            console.warn('============= BUTTON CLICK DETECTED =============');
            const inputElement = document.getElementById('font-size-input');
            const instance = window.HSInputNumber.getInstance(wrapper);

            console.log('State AT THE MOMENT OF CLICK:');
            console.log('  - Input visual value:', inputElement.value);
            console.log('  - Instance internal value:', instance ? instance.value : 'Instance not found!');
            console.warn('=================================================');
        }
    }
}, true); // Use capture phase to be extra sure we run before the component's own listener
//
// --- END OF NEW BLOCK ---




}


