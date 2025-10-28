// src/logic/defaultRules.js

import { getSelectorCache, setCurrentRuleObject } from '../state.js';
import { populateControls } from './cssEditor.js';

const defaultSelectors = [
  '.cut',
  '.projection',
  '.surface',
  '.annotation',
  '.IfcAnnotation',
  '.PredefinedType-TEXT',
  '.IfcGeographicElement',
  '.IfcSpace',
];

/**
 * Finds the default CSS rules and populates a dedicated UI section with buttons to edit them.
 */
export function initializeDefaultRules() {
  const container = document.getElementById('default-rules-container');
  const list = document.getElementById('default-rules-list');
  const cache = getSelectorCache();

  if (!container || !list || cache.size === 0) {
    if (container) container.style.display = 'none';
    return;
  }

  list.innerHTML = ''; // Clear previous buttons
  let foundRules = false;

  defaultSelectors.forEach(selector => {
    if (cache.has(selector)) {
      foundRules = true;
      const rule = cache.get(selector);
      const button = document.createElement('button');
      button.textContent = selector;
      button.dataset.selector = selector;
      // --- THIS IS THE FIX ---
      button.className = 'text-gray-500 hover:text-green-700 hover:bg-[#BEE79E40] dark:hover:bg-[#3A4150]';
      // --- END OF FIX ---
      list.appendChild(button);
    }
  });

  // Only show the container if we actually found rules to display
  container.style.display = foundRules ? 'flex' : 'none';
}

/**
 * Attaches a single event listener to the container to handle clicks on any default rule button.
 */
export function initializeDefaultRulesEventListeners() {
    const list = document.getElementById('default-rules-list');
    if (!list) return;

    list.addEventListener('click', (event) => {
        const target = event.target;
        if (target.tagName !== 'BUTTON' || !target.dataset.selector) {
            return; // Ignore clicks that aren't on a rule button
        }

        const selector = target.dataset.selector;
        const cache = getSelectorCache();
        const rule = cache.get(selector);

        if (rule) {
            console.log(`Editing default rule: ${selector}`);
            // 1. Set the selected rule object in the global state
            setCurrentRuleObject(rule);
            // 2. Populate the CSS editor controls with the rule's properties
            populateControls(rule);
            // 3. Update the rule title display
            document.getElementById('rule-title-text').textContent = selector;
            // 4. Hide the "Create New Rule" button
        }
    });
}