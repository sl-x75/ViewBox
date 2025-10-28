// src/logic/assets.js

import fs from 'fs/promises';
import { setPatternDefs, setMarkerDefs, setCurrentPatternsFile, getCurrentPatternsFile, setSymbolDefs, setCurrentSymbolsFile } from '../state.js';

/**
 * Loads and parses the patterns SVG file.
 * @param {string} filePath - The absolute path to the patterns file.
 */
export async function loadPatterns(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parser = new DOMParser();
    const svg = parser.parseFromString(data, 'image/svg+xml');
    const patterns = Array.from(svg.querySelectorAll('pattern'));
    const defs = Object.fromEntries(patterns.map(p => [p.id, p.outerHTML]));
    setPatternDefs(defs);
    
    // Store the current patterns file path (similar to how CSS files are tracked)
    setCurrentPatternsFile(filePath);
    
    const fillPatternOptions = document.getElementById('fill-pattern-options');
    if (fillPatternOptions) {
        fillPatternOptions.innerHTML = ''; // Clear existing options
        patterns.forEach(p => {
          const li = document.createElement('li');
          li.className = 'combobox-int';
          li.dataset.value = p.id;
          li.textContent = p.id;
          li.setAttribute('tabindex', '-1');
          fillPatternOptions.appendChild(li);
        });
    }

    console.log(`Loaded ${patterns.length} patterns from: ${filePath}`);
  } catch (err) {
    console.error('Error reading patterns file:', err);
  }
}




// --- REPLACE THIS ENTIRE FUNCTION ---
/**
 * Refreshes the pattern definitions and dropdown after a new pattern is added.
 * This reloads from the currently loaded patterns.svg file to ensure consistency.
 */
export async function refreshPatterns() {
  // FIX: Get the path from the state instead of a hardcoded string.
  const patternsFilePath = getCurrentPatternsFile();
  if (!patternsFilePath) {
    console.warn('Cannot refresh patterns, no patterns file is currently loaded.');
    return;
  }
  
  try {
    // Reload patterns from the file (this will update both state and dropdown)
    await loadPatterns(patternsFilePath);
    console.log('Patterns refreshed from reference file');
  } catch (error) {
    console.error('Error refreshing patterns:', error);
    throw error;
  }
}


/**
 * Adds a single pattern to the dropdown without reloading everything
 * More efficient than refreshPatterns() when you just added one pattern
 * @param {string} patternId - The pattern ID to add
 * @param {string} patternHTML - The pattern HTML
 */
export function addPatternToDropdown(patternId, patternHTML) {
  // Update the state
  const currentPatternDefs = getPatternDefs();
  const updatedPatternDefs = { ...currentPatternDefs, [patternId]: patternHTML };
  setPatternDefs(updatedPatternDefs);
  
  // Update the dropdown
  const fillPattern = document.getElementById('fill-pattern');
  const newOption = document.createElement('option');
  newOption.value = `url(#${patternId})`;
  newOption.textContent = patternId;
  fillPattern.appendChild(newOption);
  
  console.log(`Pattern "${patternId}" added to dropdown`);
}


/**
 * Loads and parses the markers SVG file.
 * @param {string} filePath - The absolute path to the markers file.
 */
export async function loadMarkers(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parser = new DOMParser();
    const svg = parser.parseFromString(data, 'image/svg+xml');
    const markers = Array.from(svg.querySelectorAll('marker'));
    const defs = Object.fromEntries(markers.map(m => [m.id, m.outerHTML]));
    setMarkerDefs(defs);

    const markerStartList = document.getElementById('marker-start-options'); // <-- Target UL
    const markerEndList = document.getElementById('marker-end-options');   // <-- Target UL
    markerStartList.innerHTML = '<li class="combobox-int" data-value="">None</li>'; // Add a "None" option
    markerEndList.innerHTML = '<li class="combobox-int" data-value="">None</li>';   // Add a "None" option

    markers.forEach(m => {
      const li = document.createElement('li'); // <-- Create LI
      li.className = 'combobox-int';
      li.dataset.value = `url(#${m.id})`;
      li.textContent = m.id;
      markerStartList.appendChild(li.cloneNode(true));
      markerEndList.appendChild(li);
    });
    console.log(`✒️ Loaded ${markers.length} markers.`);
  } catch (err) {
    console.error('Error reading markers file:', err);
  }
}

/**
 * Loads and parses the symbols SVG file.
 * @param {string} filePath - The absolute path to the symbols file.
 */
export async function loadSymbols(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    const parser = new DOMParser();
    const svg = parser.parseFromString(data, 'image/svg+xml');
    
    const symbols = Array.from(svg.querySelectorAll('svg > g'));
    
    if (symbols.length === 0) {
        console.warn('No <g> elements found as direct children of <svg> in the symbols file.');
    }

    const defs = Object.fromEntries(symbols.map(s => [s.id, s.outerHTML]));
    setSymbolDefs(defs);
    setCurrentSymbolsFile(filePath);
    console.log(`Loaded ${symbols.length} symbols from: ${filePath}`);
  } catch (err) {
    console.error('Error reading symbols file:', err);
  }
}


