// src/ui/init.js

/**
 * Handles the initial setup of the user interface on application start.
 */
export function initializeUI() {
  const svgViewerContent = document.getElementById('svg-viewer-content');
  const cssRuleEditor = document.getElementById('css-editor-container');
  const saveCssButton = document.getElementById('save-css-button');
  const cssFileName = document.getElementById('css-file-name');

  // Set the initial message in the viewer
  svgViewerContent.innerHTML = '<p style="padding: 10px; color: #888;">Select a drawing from the sidebar to begin.</p>';

  // Hide controls that are not needed until a file is loaded
  cssRuleEditor.style.display = 'none';
  saveCssButton.style.display = 'none';
  cssFileName.style.display = 'none';

  const activeDrawingInfoContainer = document.getElementById('active-drawing-info');
  if (activeDrawingInfoContainer) {
    activeDrawingInfoContainer.classList.add('hidden');
  }

  console.log('✅ UI initialized');
}

/**
 * Sets up the UI for a newly loaded SVG file.
 * This function's ONLY responsibility is to prepare the CSS editor panel.
 * @param {string} fileName - The name of the loaded CSS file.
 */
export function setupUIForSvg(fileName) {
  // --- START: REMOVED LOGGING ---
  // console.log(`[init.js] ==> Running setupUIForSvg("${fileName}")`);
  // --- END: REMOVED LOGGING ---
  const cssRuleEditor = document.getElementById('css-editor-container');
  const saveCssButton = document.getElementById('save-css-button');
  const cssFileName = document.getElementById('css-file-name');
  const ruleTitleText = document.getElementById('rule-title-text');
  const ruleTitleContainer = document.getElementById('rule-title-container');
  const defaultRulesContainer = document.getElementById('default-rules-container');
  const defaultRulesList = document.getElementById('default-rules-list');


  // --- Show Core UI Elements ---
  cssRuleEditor.style.display = 'flex';
  cssFileName.style.display = 'block';
  cssFileName.textContent = ` ${fileName}`;

  // --- THIS IS THE FIX: Explicitly manage the default rules container and button ---
  if (defaultRulesContainer) {
    defaultRulesContainer.style.display = 'flex';
  }
  if (defaultRulesList) {
    defaultRulesList.style.display = 'flex'; // Ensure the list area is visible
  }
  if (saveCssButton) {
    saveCssButton.style.display = 'inline-flex';
    saveCssButton.textContent = 'Save CSS'; // Reset button text
  }

  // --- THIS IS THE FIX: Explicitly reset UI state from read-only mode ---
  if (ruleTitleText) {
    ruleTitleText.textContent = 'Click on an element to see its CSS rule';
  }
  if (ruleTitleContainer) {
    // Remove any special styling from read-only or create modes
    ruleTitleContainer.classList.remove('readonly-warning', 'input-create-mode');
  }

  // Explicitly hide all optional control groups to ensure a clean slate
  document.getElementById('fill-control-group').style.display = 'none';
  document.getElementById('fill-switcher').style.display = 'none';
  document.getElementById('stroke-color-control-group').style.display = 'none';
  document.getElementById('stroke-width-control-group').style.display = 'none';
  document.getElementById('stroke-dasharray-control-group').style.display = 'none';
  document.getElementById('marker-start-control-group').style.display = 'none';
  document.getElementById('marker-end-control-group').style.display = 'none';
  document.getElementById('text-controls-container').style.display = 'none';
  document.getElementById('marker-styler-panel').style.display = 'none';
  document.getElementById('symbol-editor-controls').style.display = 'none';
  document.getElementById('symbol-inspector-container').style.display = 'none';

  
}

/**
 * Sets the main editor panel to a specific mode, ensuring a clean UI state.
 * This function performs a "hard reset" by hiding all optional panels before
 * showing the ones required for the new mode.
 * @param {'css' | 'symbol' | 'viewing'} mode The mode to switch to.
 */
export function setEditorMode(mode) {
  // --- Get references to ALL major control containers ---
  const cssRuleEditor = document.getElementById('css-editor-container');
  const ruleTitleContainer = document.getElementById('rule-title-container');
  const defaultRules = document.getElementById('default-rules-container');

  // CSS-specific groups
  const fillControlGroup = document.getElementById('fill-control-group');
  const fillSwitcher = document.getElementById('fill-switcher');
  const strokeColorGroup = document.getElementById('stroke-color-control-group');
  const strokeWidthGroup = document.getElementById('stroke-width-control-group');
  const strokeDasharrayGroup = document.getElementById('stroke-dasharray-control-group');
  const markerGroups = [
    document.getElementById('marker-start-control-group'),
    document.getElementById('marker-end-control-group'),
    document.getElementById('marker-content-stroke-control-group'),
    document.getElementById('marker-styler-panel')
  ];
  const textControls = document.getElementById('text-controls-container');

  // Symbol-specific groups
  const symbolControls = document.getElementById('symbol-editor-controls');
  const symbolInspector = document.getElementById('symbol-inspector-container');

  // --- 1. HARD RESET: Hide EVERYTHING first ---
  // This is the crucial step that prevents state pollution.
  [
    fillControlGroup, fillSwitcher, strokeColorGroup, strokeWidthGroup,
    strokeDasharrayGroup, textControls, symbolControls, symbolInspector,
    defaultRules, ruleTitleContainer
  ].forEach(el => { if (el) el.style.display = 'none'; });
  
  markerGroups.forEach(el => { if (el) el.style.display = 'none'; });
  
  // --- 2. SELECTIVELY RE-ENABLE based on mode ---
  cssRuleEditor.style.display = 'flex'; // The main container is always visible unless viewing.

  switch (mode) {
    case 'symbol':
      // Show the main rule title and the dedicated symbol controls.
      ruleTitleContainer.style.display = 'flex';
      symbolControls.style.display = 'flex';
      symbolInspector.style.display = 'block'; // Use block for the dropdown container

      // --- THE "GOOD ACCIDENT" AS A FEATURE ---
      // We also show text controls here because symbols often contain text.
      // This makes the desired mixed-mode behavior intentional and reliable.
      // textControls.style.display = 'flex'; //
      break;

    case 'css':
      // Show the main rule title and the default rules.
      // The specific CSS controls (fill, stroke, etc.) will be made visible
      // by the `populateControls` function itself.
      ruleTitleContainer.style.display = 'flex';
      defaultRules.style.display = 'flex';
      break;

    case 'viewing':
      // In viewing mode (e.g., for Sheets), hide the entire editor bar.
      cssRuleEditor.style.display = 'none';
      break;
  }
}

/**
 * Sets up the UI for the read-only mode when an external CSS file is missing.
 * @param {string} expectedFileName - The name of the CSS file that was expected.
 * @param {string} fullExpectedPath - The full path where the file should be saved.
 */
export function setupUIForReadOnlyMode(expectedFileName, fullExpectedPath) {
  console.log(`[init.js] ==> Running setupUIForReadOnlyMode("${expectedFileName}")`);
  const cssRuleEditor = document.getElementById('css-editor-container');
  const saveCssButton = document.getElementById('save-css-button');
  const cssFileName = document.getElementById('css-file-name');
  const ruleTitleText = document.getElementById('rule-title-text');
  const ruleTitleContainer = document.getElementById('rule-title-container');
  const defaultRulesContainer = document.getElementById('default-rules-container');
  const defaultRulesList = document.getElementById('default-rules-list');

  // Ensure the main editor container is visible
  cssRuleEditor.style.display = 'flex';
  saveCssButton.style.display = 'inline-flex';
  cssFileName.style.display = 'block';

  // Show the parent container but hide the (empty) list of default rules.
  if (defaultRulesContainer) {
    defaultRulesContainer.style.display = 'flex';
  }
  if (defaultRulesList) {
    defaultRulesList.style.display = 'none';
  }

  // Update UI text to inform the user
  cssFileName.textContent = `Using Internal Styles (Read-Only)`;
  if (ruleTitleText) ruleTitleText.textContent = `To edit, save styles to create "${expectedFileName}"`;
  saveCssButton.textContent = 'Save to Enable Editing';

  // Store the full path on the button's dataset for the event listener to use
  saveCssButton.dataset.targetCssPath = fullExpectedPath;

  if (ruleTitleContainer) ruleTitleContainer.classList.add('readonly-warning');

  // Explicitly hide all optional control groups to prevent interaction
  document.getElementById('fill-control-group').style.display = 'none';
  document.getElementById('fill-switcher').style.display = 'none';
  document.getElementById('stroke-color-control-group').style.display = 'none';
  document.getElementById('stroke-width-control-group').style.display = 'none';
  document.getElementById('stroke-dasharray-control-group').style.display = 'none';
  document.getElementById('marker-start-control-group').style.display = 'none';
  document.getElementById('marker-end-control-group').style.display = 'none';
  document.getElementById('text-controls-container').style.display = 'none';
}
