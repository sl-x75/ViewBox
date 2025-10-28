// src/logic/settings.js

import { ipcRenderer } from 'electron';
import Coloris from '@melloware/coloris';
import { setEditorFontSize, setEditorFontFamily, setEditorWordWrap } from './codeEditor.js';
import { applyTheme } from './theme.js';

// 1. Define Default Settings with all the new options
const DEFAULTS = {
  viewer: {
    backgroundColor: '#FAF9F5',
    backgroundColorDark: '#31353C'
  },
  coloris: {
    swatches: [ '#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51' ]
  },
  theme: {
    mode: 'system' // 'system', 'light', 'dark'
  },
   ifcSpace: {
   defaultDisplay: 'colorized' // 'colorized', 'hidden'
 },
   startPage: {
    recentProjectsCount: 10
  },

  codeEditor: {
    fontSize: 14,
    fontFamily: 'monospace',
    wordWrap: false
  },
  files: {
    autoSaveOnSwitch: true
  },
  sliders: {
    strokeWidth: { min: 0, max: 2, step: 0.05 },
    patternScale: { min: 0.01, max: 5, step: 0.05 },
    patternStrokeWidth: { min: 0, max: 2, step: 0.05 }
  }
};

let settings = {};

/**
 * Loads settings from the user's config file and merges them with defaults.
 */
export async function loadSettings() {
  const userSettings = await ipcRenderer.invoke('get-user-settings');
  // Deep merge to handle nested objects
  settings = {
    ...DEFAULTS,
    ...userSettings,
    viewer: { ...DEFAULTS.viewer, ...userSettings.viewer },
    coloris: { ...DEFAULTS.coloris, ...userSettings.coloris },
    theme: { ...DEFAULTS.theme, ...userSettings.theme },
    ifcSpace: { ...DEFAULTS.ifcSpace, ...userSettings.ifcSpace },
    startPage: { ...DEFAULTS.startPage, ...userSettings.startPage },
    codeEditor: { ...DEFAULTS.codeEditor, ...userSettings.codeEditor },
    files: { ...DEFAULTS.files, ...userSettings.files },
    sliders: { ...DEFAULTS.sliders, ...userSettings.sliders },
  };
  console.log('[Settings] Settings loaded:', settings);
}

/**
 * Gets a setting value using a dot-notation key.
 * @param {string} key - The setting key (e.g., 'viewer.backgroundColor').
 * @returns {any} The value of the setting.
 */
export function getSetting(key) {
  return key.split('.').reduce((obj, part) => obj && obj[part], settings);
}

/**
 * Saves a setting value and persists it to the user's config file.
 * @param {string} key - The setting key.
 * @param {any} value - The new value.
 */
export async function saveSetting(key, value) {
  const keys = key.split('.');
  let current = settings;
  for (let i = 0; i < keys.length - 1; i++) {
    if (!current[keys[i]]) current[keys[i]] = {};
    current = current[keys[i]];
  }
  current[keys[keys.length - 1]] = value;

  await ipcRenderer.invoke('save-user-settings', settings);
  console.log(`[Settings] Saved setting: ${key}`);
}

/**
 * Applies a specific setting to the application UI.
 * @param {string} key - The key of the setting to apply.
 * @param {any} value - The value to apply.
 */
export function applySetting(key, value) {
  switch (key) {
    case 'viewer.backgroundColor':
    case 'viewer.backgroundColorDark':
      // This case now intelligently selects the correct color based on the current theme setting.
      const viewerContainer = document.getElementById('viewer-container');
      if (viewerContainer) {
        const themeMode = getSetting('theme.mode');
        const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        
        let useEffectiveDarkMode = false;
        if (themeMode === 'dark') {
          useEffectiveDarkMode = true;
        } else if (themeMode === 'system' && isSystemDark) {
          useEffectiveDarkMode = true;
        }
        
        viewerContainer.style.backgroundColor = useEffectiveDarkMode
          ? getSetting('viewer.backgroundColorDark')
          : getSetting('viewer.backgroundColor');
      }
      break;

    case 'coloris.swatches':
      Coloris.setInstance('.coloris-input', { theme: 'editor', swatches: value });
      Coloris.setInstance('.coloris-input-pattern-editor', { theme: 'pattern', swatches: value });
      break;

    // --- REPLACE THE 'theme.mode' CASE ---
    case 'theme.mode':
      // 1. Save the user's preference FIRST.
      localStorage.setItem('hs_theme', value);
      // 2. Now, call our function to apply the theme.
      //    It will read the value we just saved.
      applyTheme(localStorage.getItem('hs_theme'));

      applySetting('viewer.backgroundColor'); 
      break;

    case 'ifcSpace.defaultDisplay':
       // This doesn't have an immediate live effect, but will be read
       // when the next drawing is loaded or when controls are populated.
       // We could call setSpaceVisualization(value) here if we wanted an instant change.
       break;
       

    case 'codeEditor.fontSize':
      setEditorFontSize(value);
      break;
    case 'codeEditor.fontFamily':
      setEditorFontFamily(value);
      break;
    case 'codeEditor.wordWrap':
      setEditorWordWrap(value);
      break;

    case 'sliders.strokeWidth':
    case 'sliders.patternScale':
    case 'sliders.patternStrokeWidth':
        updateAllSliderAttributes();
      break;
  }
}

/**
 * Updates the min/max/step attributes of all sliders in the UI.
 */
export function updateAllSliderAttributes() {
    const sw = getSetting('sliders.strokeWidth');
    const ps = getSetting('sliders.patternScale');
    const psw = getSetting('sliders.patternStrokeWidth');

    // Main Stroke Width
    const strokeWidthSlider = document.getElementById('stroke-width');
    if (strokeWidthSlider) Object.assign(strokeWidthSlider, sw);
    const symbolStrokeWidthSlider = document.getElementById('symbol-stroke-width');
    if (symbolStrokeWidthSlider) Object.assign(symbolStrokeWidthSlider, sw);
    
    // Pattern Scale
    const patternScaleX = document.getElementById('pattern-scale-x');
    if(patternScaleX) Object.assign(patternScaleX, ps);
    const patternScaleY = document.getElementById('pattern-scale-y');
    if(patternScaleY) Object.assign(patternScaleY, ps);

    // Pattern Stroke Width
    const patternStrokeWidthSlider = document.getElementById('pattern-element-stroke-width');
    if(patternStrokeWidthSlider) Object.assign(patternStrokeWidthSlider, psw);
}


/**
 * Populates the settings panel UI with the currently loaded settings.
 */
export function populateSettingsPanel() {
  // Appearance
  document.getElementById('setting-viewer-bg-color').value = getSetting('viewer.backgroundColor');
  document.getElementById('setting-viewer-bg-color-dark').value = getSetting('viewer.backgroundColorDark');
  document.getElementById('setting-coloris-swatches').value = getSetting('coloris.swatches').join(', ');
  document.getElementById('setting-theme-mode').value = getSetting('theme.mode');
  document.getElementById('setting-ifcspace-default-display').value = getSetting('ifcSpace.defaultDisplay');

  // Start Page
  document.getElementById('setting-startpage-recents-count').value = getSetting('startPage.recentProjectsCount');
 

  // Editor
  document.getElementById('setting-ce-font-size').value = getSetting('codeEditor.fontSize');
  document.getElementById('setting-ce-font-family').value = getSetting('codeEditor.fontFamily');
  document.getElementById('setting-ce-word-wrap').checked = getSetting('codeEditor.wordWrap');

  // Files
  document.getElementById('setting-files-autosave').checked = getSetting('files.autoSaveOnSwitch');

  // Sliders
  const sw = getSetting('sliders.strokeWidth');
  document.getElementById('setting-slider-sw-min').value = sw.min;
  document.getElementById('setting-slider-sw-max').value = sw.max;
  document.getElementById('setting-slider-sw-step').value = sw.step;

  const ps = getSetting('sliders.patternScale');
  document.getElementById('setting-slider-ps-min').value = ps.min;
  document.getElementById('setting-slider-ps-max').value = ps.max;
  document.getElementById('setting-slider-ps-step').value = ps.step;

  const psw = getSetting('sliders.patternStrokeWidth');
  document.getElementById('setting-slider-psw-min').value = psw.min;
  document.getElementById('setting-slider-psw-max').value = psw.max;
  document.getElementById('setting-slider-psw-step').value = psw.step;

  // Manually trigger coloris to update the swatch colors
  document.getElementById('setting-viewer-bg-color').dispatchEvent(new Event('input', { bubbles: true }));
  document.getElementById('setting-viewer-bg-color-dark').dispatchEvent(new Event('input', { bubbles: true }));
}