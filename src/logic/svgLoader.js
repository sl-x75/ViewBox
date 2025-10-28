// src/logic/svgLoader.js

import fs from 'fs/promises';
import path from 'path';
import { getDrawingToAssetMap, isEditing, isManipulating, getManipulationEnabled, setIsLayoutFile, setLayoutFilePath, setOriginalLayoutContent, setCurrentSvgElement, setLayoutModified, setCurrentCssContent, setCurrentCssFile, getCurrentCssContent,  getCurrentMode, getViewer, setIsCssReadOnly, getCurrentCssAST} from '../state.js';
import { initializeManipulation, destroyManipulation } from '../manipulation.js';

import { setupUIForSvg, setupUIForReadOnlyMode } from '../ui/init.js';
import { loadCssFile } from './files.js';

function formatName(name) {
  return name.replace('.svg', '').replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, char => char.toUpperCase());
}
import { loadPatterns, loadMarkers, loadSymbols } from './assets.js';
import { processLayoutFile } from './layoutProcessor.js';
import { enablePicker, enableZoomPan, triggerUpdate } from '../interactions.js';
import { initializeDefaultRules } from './defaultRules.js';
import { parseAndStoreFontFamilies, populateFontFamilyCombobox } from './cssEditor.js'; // Import new functions

let resizeObserver;

// --- START: FIX 2 - A robust, viewer-relative padding logic for layouts ---
/**
 * Adjusts the viewBox of the SVG to fit and center its content within the viewer.
 * Applies a significantly larger, viewer-relative padding for layout files.
 * @param {SVGElement} svgElement The SVG element to adjust.
 * @param {string|null} originalViewBox The original viewBox string for drawings.
 * @param {boolean} isLayout True if the file is a layout.
 */
function adjustViewBox(svgElement, originalViewBox, isLayout) {
  if (!svgElement) return;
  const viewer = document.getElementById('svg-wrapper');
  if (!viewer) return;

  try {
    const viewerWidth = viewer.clientWidth;
    const viewerHeight = viewer.clientHeight;

    let contentBox;
    // For layouts, always use getBBox. For drawings, respect the original viewBox.
    if (originalViewBox && !isLayout) {
      const parts = originalViewBox.split(' ').map(parseFloat);
      contentBox = { x: parts[0], y: parts[1], width: parts[2], height: parts[3] };
    } else {
      contentBox = svgElement.getBBox();
      if (contentBox.width === 0 || contentBox.height === 0) {
        console.warn("Layout content has zero width or height. Cannot adjust viewBox.");
        return;
      }
    }
    
    const contentRatio = contentBox.width / contentBox.height;
    const viewerRatio = viewerWidth / viewerHeight;

    let scale;
    if (contentRatio > viewerRatio) {
      scale = viewerWidth / contentBox.width;
    } else {
      scale = viewerHeight / contentBox.height;
    }

    // Calculate a new viewBox that perfectly fits the content.
    let newWidth = viewerWidth / scale;
    let newHeight = viewerHeight / scale;
    let newX = contentBox.x - (newWidth - contentBox.width) / 2;
    let newY = contentBox.y - (newHeight - contentBox.height) / 2;

    // For layouts, make the view 50% larger than the container to add generous padding.
    if (isLayout) {
      const paddingFactor = 1.5; // 50% larger view
      const paddedWidth = newWidth * paddingFactor;
      const paddedHeight = newHeight * paddingFactor;

      // Recalculate X and Y to keep the content centered in the new, larger view.
      newX -= (paddedWidth - newWidth) / 2;
      newY -= (paddedHeight - newHeight) / 2;
      newWidth = paddedWidth;
      newHeight = paddedHeight;
      console.log('📐 Applying spacious layout padding.');
    } else {
      // For drawings, use a small, 10% padding.
      const paddingFactor = 1.1; // 10% larger view
      const paddedWidth = newWidth * paddingFactor;
      const paddedHeight = newHeight * paddingFactor;
      newX -= (paddedWidth - newWidth) / 2;
      newY -= (paddedHeight - newHeight) / 2;
      newWidth = paddedWidth;
      newHeight = paddedHeight;
    }
    
    const finalViewBox = `${newX} ${newY} ${newWidth} ${newHeight}`;
    svgElement.setAttribute('viewBox', finalViewBox);
    console.log('👀 Set centered viewBox:', finalViewBox);

  } catch (e) {
    console.warn("⚠️ Could not get BBox or process viewBox. Skipping adjustment.", e);
  }
}
// --- END: FIX 2 ---


/**
 * Loads and displays an SVG file, handling different modes (editing/manipulating).
 * @param {string} filePath - The absolute path to the SVG file.
 */
export async function loadSvgFile(filePath) {
    // --- START: ADD LOGGING ---
  console.group(`[svgLoader.js] Loading Process for: ${path.basename(filePath)}`);
  // --- END: ADD LOGGING ---
  console.log('📁 Loading SVG file:', filePath);
  const currentMode = getCurrentMode();
  console.log(`🔧 Current mode: ${currentMode}`);

  const projectPath = path.resolve(path.dirname(filePath), '..');
  console.log(`[SVG Loader] Deduced project path: ${projectPath}`);

  if (resizeObserver) {
    resizeObserver.disconnect();
  }

  const svgViewerContent = document.getElementById('svg-viewer-content');
  svgViewerContent.style.visibility = 'hidden';

  try {
    const rawSvgContent = await fs.readFile(filePath, 'utf8');
    svgViewerContent.innerHTML = rawSvgContent;
    const svgElement = svgViewerContent.querySelector('svg');

    if (!svgElement) {
      throw new Error('No SVG element found in the loaded file.');
    }

    const isLayout = filePath.includes('/layouts/') || filePath.includes('\\layouts');
    const originalViewBox = svgElement.getAttribute('viewBox');

    // --- START: FIX 1 - Update the central application state ---
    // This is the critical fix for the save and manipulation toggle bugs.
    setIsLayoutFile(isLayout);
    setLayoutFilePath(isLayout ? filePath : '');
    setOriginalLayoutContent(isLayout ? rawSvgContent : '');
    setCurrentSvgElement(svgElement);
    setLayoutModified(false);
    // --- END: FIX 1 ---

    if (originalViewBox && !isLayout) {
      const [x, y, width, height] = originalViewBox.split(' ').map(parseFloat);
      let defs = svgElement.querySelector('defs');
      if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svgElement.prepend(defs);
      }
      const clipPath = document.createElementNS('http://www.w3.org/2000/svg', 'clipPath');
      const clipPathId = 'original-viewbox-clip';
      clipPath.setAttribute('id', clipPathId);
      const clipRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      clipRect.setAttribute('x', x);
      clipRect.setAttribute('y', y);
      clipRect.setAttribute('width', width);
      clipRect.setAttribute('height', height);
      clipPath.appendChild(clipRect);
      defs.appendChild(clipPath);
      const contentGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      contentGroup.setAttribute('id', 'main-drawing-content');
      contentGroup.setAttribute('clip-path', `url(#${clipPathId})`);
      Array.from(svgElement.children).forEach(child => {
        if (child.tagName.toLowerCase() !== 'defs' && child.tagName.toLowerCase() !== 'style') {
          contentGroup.appendChild(child);
        }
      });
      svgElement.appendChild(contentGroup);
      console.log(`📎 Applied clip path '${clipPathId}' because this is a drawing.`);
    }

    const existingDebugRect = svgElement.querySelector('#viewbox-debug-rect');
    if (existingDebugRect) existingDebugRect.remove();
    if (originalViewBox) {
        const [minX, minY, width, height] = originalViewBox.split(' ').map(parseFloat);
        const debugRect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        debugRect.setAttribute('x', minX);
        debugRect.setAttribute('y', minY);
        debugRect.setAttribute('width', width);
        debugRect.setAttribute('height', height);
        debugRect.setAttribute('id', 'viewbox-debug-rect');
        debugRect.setAttribute('fill', 'none');
        debugRect.setAttribute('stroke', 'gray');
        debugRect.setAttribute('stroke-width', '0.6');
        debugRect.setAttribute('stroke-dasharray', '6 3');
        debugRect.setAttribute('pointer-events', 'none');
        const mainContent = svgElement.querySelector('#main-drawing-content') || svgElement;
        mainContent.appendChild(debugRect);
    }
    
    svgElement.dataset.filePath = filePath;
    svgElement.dataset.isLayout = isLayout.toString();

    const event = new CustomEvent('svg-loaded', { detail: { svgElement } });
    window.dispatchEvent(event);

    // --- START: Set Cursor based on Mode ---
    const viewerContainer = document.getElementById('viewer-container');
    if (isEditing()) {
      viewerContainer.classList.add('editing-mode');
    } else {
      viewerContainer.classList.remove('editing-mode');
    }
    // --- END: Set Cursor based on Mode ---
    
    svgElement.removeAttribute('width');
    svgElement.removeAttribute('height');
    svgElement.removeAttribute('viewBox');

    svgElement.style.width = '100%';
    svgElement.style.height = '100%';

    // --- START: THIS IS THE REPLACEMENT LOGIC BLOCK ---

    const drawingName = path.basename(filePath);
    const assets = getDrawingToAssetMap()[drawingName];
    const activeDrawingInfoContainer = document.getElementById('active-drawing-info');
    const drawingDetailsContent = document.getElementById('drawing-details-content');
    const saveButton = document.getElementById('save-css-button');

    // --- Main Logic Branching ---

    if (isEditing() && assets) {
      // --- CASE 1: Editing mode AND we have asset data for this drawing. ---

      // 1. Populate and show the info panel.
      drawingDetailsContent.innerHTML = ''; // Clear previous content
      const unwantedKeys = ['HumanScale', 'HasUnderlay', 'HasLinework', 'HasAnnotation', 'CurrentShadingStyle', 'FillMode', 'GlobalReferencing', 'DPI', 'IsNTS'];
      document.querySelector('#active-drawing-info h2').textContent = `Info: ${formatName(drawingName)} `;
      for (const key in assets) {
        if (Object.hasOwnProperty.call(assets, key) && !unwantedKeys.includes(key)) {
          let value = assets[key];
          let finalHTML;
          if (key === 'Metadata' && typeof value === 'string' && value.includes(',')) {
            const formattedValue = value.split(',').join(',<br>');
            finalHTML = `<span class="font-[Saira] text-[13px] font-semibold">${key}:</span><br>${formattedValue}`;
          } else if ((key === 'Stylesheet' || key === 'Markers' || key === 'Symbols' || key === 'Patterns' || key === 'ShadingStyles') && typeof value === 'string') {
            const fullPath = path.join(projectPath, value);
            const displayValue = `./${path.basename(value)}`;
            finalHTML = `<span class="font">${key}:</span> <span class="clickable-file-path text-blue-600 cursor-pointer hover:underline" data-full-file-path="${fullPath}">${displayValue}</span>`;
          } else {
            finalHTML = `<span class=" font-[Saira]  text-gray-500">${key}:</span> ${value}`;
          }
          const p = document.createElement('p');
          p.innerHTML = finalHTML;
          drawingDetailsContent.appendChild(p);
        }
      }
      activeDrawingInfoContainer.classList.remove('hidden');

      // 2. Set up buttons for editing mode.
      saveButton.style.display = 'inline-flex';

      // 3. Handle CSS loading (with read-only fallback).
      if (assets.Stylesheet) {
        const cssFilePath = path.join(projectPath, assets.Stylesheet);
        const cssLoadResult = await loadCssFile(cssFilePath);

        if (cssLoadResult.success) {
          setIsCssReadOnly(false);
          setupUIForSvg(path.basename(cssFilePath));
        } else {
          setIsCssReadOnly(true);
          const styleTag = svgElement.querySelector('style');
          const internalCss = styleTag ? styleTag.textContent.replace(/<!\[CDATA\[|\]\]>/g, '').trim() : '';
          setCurrentCssContent(internalCss);
          const expectedCssFileName = path.basename(cssFilePath);
          setupUIForReadOnlyMode(expectedCssFileName, cssFilePath);
        }
      } else {
        setIsCssReadOnly(false);
        setCurrentCssContent('');
        setCurrentCssFile(null);
        setupUIForSvg('No Stylesheet');
      }

      // 4. Load other assets and initialize editor features.
      await Promise.all([
        assets.Patterns ? loadPatterns(path.join(projectPath, assets.Patterns)) : Promise.resolve(),
        assets.Markers ? loadMarkers(path.join(projectPath, assets.Markers)) : Promise.resolve(),
        assets.Symbols ? loadSymbols(path.join(projectPath, assets.Symbols)) : Promise.resolve(),
      ]);
      
      parseAndStoreFontFamilies(getCurrentCssAST());
      populateFontFamilyCombobox();

      const currentCss = getCurrentCssContent();
      let styleTag = svgElement.querySelector('style');
      if (!styleTag) {
        styleTag = document.createElementNS('http://www.w3.org/2000/svg', 'style');
        svgElement.prepend(styleTag);
      }
      styleTag.textContent = currentCss;
      initializeDefaultRules();

    } else {
      // --- CASE 2: All other scenarios (Not editing, or no assets). ---
      
      // 1. Hide the info panel. This is the only place it gets hidden.
      activeDrawingInfoContainer.classList.add('hidden');

      // 2. Set up the UI for the correct mode.
      if (currentMode === 'manipulating') {
        saveButton.style.display = 'inline-flex';
        setupUIForSvg('Layout');
      } else if (currentMode === 'viewing') {
        saveButton.style.display = 'none';
        setupUIForSvg('Sheet');
      } else { // Handle case of Editing mode but no assets
        saveButton.style.display = 'inline-flex';
        setCurrentCssContent('');
        setCurrentCssFile(null);
        setupUIForSvg('No Stylesheet or Asset Data');
      }
    }
    // --- END: REPLACEMENT LOGIC BLOCK ---

    const images = svgElement.querySelectorAll('image');
    const svgImages = Array.from(images).filter(img => img.href.baseVal.toLowerCase().endsWith('.svg'));
    if (isManipulating() && svgImages.length > 0) {
      console.log('🔄 Processing layout file in manipulation mode...');
      await processLayoutFile(svgElement, filePath);
    }

    await destroyManipulation();
    if (currentMode === 'manipulating') {
      console.log('🔧 Initializing manipulation...');
      if (getManipulationEnabled()) {
        await initializeManipulation(svgElement);
      }
    }

    if (isEditing()) {
      console.log('✏️ Enabling picker for editing mode');
      enablePicker(svgElement);
    } else {
      const pickerHandler = null;
      if (pickerHandler) {
          svgElement.removeEventListener('click', pickerHandler);
      }
    }
    
    // --- START: FIX 3 - Update the function calls with the isLayout flag ---
    resizeObserver = new ResizeObserver(() => 
      adjustViewBox(svgElement, originalViewBox, isLayout)
    );

    setTimeout(() => {
      adjustViewBox(svgElement, originalViewBox, isLayout);
      svgViewerContent.style.visibility = 'visible';
      document.getElementById('h-guides').style.visibility = 'visible';
      document.getElementById('v-guides').style.visibility = 'visible';
      document.getElementById('ruler-corner').style.visibility = 'visible';
      console.log('👁️ SVG now visible');
    }, 150);
    // --- END: FIX 3 ---

  } catch (err) {
    console.error(`Error loading SVG file: ${filePath}`, err);
    svgViewerContent.innerHTML = `<p class="text-red-500 p-4">Error loading file: ${err.message}</p>`;
    svgViewerContent.style.visibility = 'visible';
  }
}