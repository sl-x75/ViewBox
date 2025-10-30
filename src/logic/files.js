// src/logic/files.js

import fs from 'fs/promises';
import path from 'path';
import postcss from 'postcss';
import { buildSelectorCache } from './css-utils.js';
import { 
  getCurrentCssContent, 
  getCurrentCssFile, 
  isEditing, 
  setCurrentCssContent, 
  setCurrentCssFile, 
  getIsLayoutFile, 
  getLayoutFilePath, 
  getCurrentSvgElement, 
  setLayoutModified, 
  setOriginalLayoutContent, 
  getOriginalLayoutContent,
  setCurrentCssAST,
  setSelectorCache,
  getCurrentPatternsFile,
  getDrawingTargetViewMap // <-- CHANGE THIS
   // Add this line
} from '../state.js';



// --- NEW ICON HELPER FUNCTION ---
function getIconForType(type) {
  const commonAttrs = `width="24" height="24" viewBox="0 0 24 24" fill="#EDF2FB" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"`;
  switch (type) {
    case 'plan':
      return `<svg   width="800" height="800"    viewBox="-100 -150 1100 1100" class="prefix__icon" xmlns="http://www.w3.org/2000/svg" transform="scale(1.8)"><rect width="266.322" height="446.322" x="410.639" y="227.658" ry="10.892" opacity=".99" fill="#bdd0bd" fill-opacity=".992" fill-rule="evenodd" stroke="#666" stroke-width="53.678" paint-order="markers stroke fill"/><rect width="248.133" height="381.135" x="48.583" y="115.069" ry="9.301" opacity=".99" fill="#e9daaf" fill-opacity=".992" fill-rule="evenodd" stroke="#666" stroke-width="51.867" paint-order="markers stroke fill"/></svg>`
    case 'elevation':
      return `<svg  width="800" height="800" viewBox="-100 -150 1100 1100" class="prefix__prefix__icon" xmlns="http://www.w3.org/2000/svg" transform="scale(2.3)"><path d="M125.475 379.574L486.16 197.561l67.617 24.75c5.574 2.04 10.715 4.777 10.715 10.713V422.98a10.69 10.69 0 01-10.715 10.712h-417.59a10.689 10.689 0 01-10.712-10.712z" opacity=".99" fill="#eadbb1" fill-rule="evenodd" stroke="#e9dbb1" stroke-width="68.75" paint-order="markers stroke fill"/><rect width="486.249" height="132.589" x="213.716" y="468.805" ry="0" opacity=".99" fill="#bfd1bf" fill-rule="evenodd" paint-order="markers stroke fill"/><path d="M90.577 451.97h592.564a33.598 33.598 0 0133.598 33.598v96.302a36.024 36.024 0 01-36.024 36.024H90.577" opacity=".99" fill="none" stroke="#c0d1c0" stroke-width="34.375" paint-order="markers stroke fill"/><path d="M91.975 177.563l231.01 80.084 162.563-81.678 185.379 69.958" opacity=".99" fill="none" stroke="#e9dbb1" stroke-width="32.545" paint-order="markers stroke fill"/><rect width="93.951" height="105.346" x="-564.492" y="275.329" ry="5.784" transform="scale(-1 1)" opacity=".99" fill="#f2f2f2" fill-rule="evenodd" stroke="#676767" stroke-width="3.337" paint-order="markers stroke fill"/><rect width="217.916" height="103.642" x="-466.584" y="481.234" ry="5.69" transform="scale(-1 1)" opacity=".99" fill="#f2f2f2" fill-rule="evenodd" stroke="#676767" stroke-width="5.041" paint-order="markers stroke fill"/></svg>`;
    case 'section':
      return `
      <svg  class="hs-accordion-active:hidden block size-4"  viewBox="-100 -150 1100 1100" class="prefix__prefix__icon" xmlns="http://www.w3.org/2000/svg" transform="scale(2.1)"><g paint-order="markers stroke fill"><path d="M559.017 363.667L198.332 233.904l-67.617-24.75c-5.573-2.04-5.215 18.527-5.215 24.462v189.957c0 5.935-.72 10.713 5.215 10.713h417.59a10.689 10.689 0 0010.712-10.713z" opacity=".99" fill="#c0d1c0" fill-rule="evenodd"/><path d="M125.475 376.824L486.16 194.811l67.617 24.75c5.574 2.04 10.715 4.777 10.715 10.713V420.23a10.69 10.69 0 01-10.715 10.712h-417.59a10.689 10.689 0 01-10.712-10.712z" opacity=".99" fill="#eadbb1" fill-rule="evenodd" stroke="#666" stroke-width="34.375"/><g transform="translate(-63.25 -1001)"><rect width="484.567" height="128.756" x="288.203" y="1472.22" ry="31.352" opacity=".99" fill="#bfd1bf" fill-rule="evenodd"/><path d="M153.827 1452.97h592.564a33.598 33.598 0 0133.598 33.598v96.302a36.024 36.024 0 01-36.024 36.024H153.827" opacity=".99" fill="none" stroke="#666" stroke-width="34.375" stroke-opacity=".992"/></g><path d="M91.975 174.813l231.01 80.084 162.563-76.178 185.379 64.458" opacity=".99" fill="none" stroke="#666" stroke-width="32.545" stroke-opacity=".992"/></g></svg>`;
    case 'reflected':
      return `<svg width="800" height="800" viewBox="-100 -150 1100 1100" class="prefix__prefix__icon" xmlns="http://www.w3.org/2000/svg" transform="scale(1.8)"><g fill-rule="evenodd" stroke="#666" paint-order="markers stroke fill" transform="rotate(180 -326.92 241.563)"><path d="M-1092.873 189.375a9.281 9.281 0 009.303-9.3v-362.533c0-5.153-4.15-9.3-9.303-9.3h-229.531a9.279 9.279 0 00-9.3 9.3v362.533c0 5.153 4.147 9.3 9.3 9.3z" opacity=".99" fill="#e9daaf" fill-opacity=".597" stroke-width="51.867" stroke-dasharray="36.307 31.12"/><rect width="266.322" height="446.322" x="-969.649" y="-79.17" ry="10.892" opacity=".99" fill="#bdd0bd" fill-opacity=".6" stroke-width="53.678" rx="10.892" stroke-dasharray="37.575 32.207"/></g></svg>`
    case '3d':
      return `<svg  width="800" height="800" viewBox="-100 -150 1100 1100" class="prefix__prefix__icon" xmlns="http://www.w3.org/2000/svg" transform="scale(2.1)"><g stroke="#666" stroke-width="9.625"><path d="M582.087 337.777v4.787l-.852.527-.852.526-93.218 4.486-93.217 4.488-4.589.25-4.589.25 45.888 4.904 45.888 4.901 2.92.598 2.92.597.5-.256.5-.258 122.563-7.541 122.562-7.54 4.588-.577 4.59-.575-10.013-.64-10.011-.64-21.276-1.296-21.275-1.297-42.133-2.463-42.133-2.462-4.38-.384zm171.178 10.589l-75.37 4.673-75.368 4.674-54.649 3.324-54.648 3.324-5.214.48-5.215.482.007 18.496.007 18.497-.822 124.314-.82 124.314-.332 33.164-.329 33.165H481.531l130.998-46.462 131-46.46.186-.1.185-.1 5.054-137.523 5.051-137.523-.37-.37zM374.9 353.502l.541 67.375.54 67.374-.612.955-.61.955-39.63 6.034-39.631 6.035-2.086-.054-2.086-.054-22.526-9.574-22.527-9.575-.202.199-.202.2.912 44.573.913 44.572.958.963.958.962 112.216 69.832 112.217 69.834 2.503 1.556 2.503 1.554.156-2.683.158-2.686.999-172.94.999-172.938-.48-.481-.482-.48-49.066-5.285-49.066-5.285-3.682-.47z" fill="#c4d5c4" fill-opacity=".996" stroke-opacity=".992" stroke-width="5.8402575"/><path d="M288.264 92.23l-.314.313-.315.315 2.878 197.28 2.876 197.28.012 6.899.011 6.899 1.878-.437 1.877-.435 35.876-5.397 35.875-5.398 2.813-.498 2.814-.497-.564-67.314-.565-67.314.69-.994.69-.994 102.405-4.926 102.403-4.927.315-.337.313-.337 1.828-103.32 1.828-103.321-.383-.383-.383-.382-147.429-20.887zm-2.975 1.746L214.26 166.29l-71.027 72.317v8.524l2.946 96.32 2.947 96.32.402.402.4.402 70.283 29.817 70.282 29.818.625.07.626.068-.034-13.14-.033-13.141-2.772-189.624-2.773-189.624-.422-.422z" fill="#e9dbb1" fill-opacity=".553" stroke-opacity=".984" stroke-width="5.8402575"/></g></svg>`;
    case 'sketch':
      return `
      <svg width="800" height="800" viewBox="-100 -150 1100 1100" class="prefix__prefix__icon" xmlns="http://www.w3.org/2000/svg"  transform="scale(2.5)" ><g fill="#a4a4a4"><path d="M634.55 582.088c-.668 0-1.289.048-1.958.144l-117.334 15.186c-6.018.764-10.22-5.826-6.973-10.984 1.767-2.722 3.486-5.492 5.206-8.261 4.536-7.355-1.529-17.145-9.933-17.145-.574 0-1.147.049-1.767.144l-153.772 23.113-18.386 2.77-50.143 7.546c-5.683.86-9.503 5.682-9.025 11.461.19 2.578 1.241 5.014 2.913 6.829 1.958 2.149 4.68 3.343 7.64 3.343.574 0 1.147-.048 1.767-.143l183.285-27.555c6.256-.955 10.554 6.113 6.876 11.27-1.194 1.624-2.388 3.295-3.582 4.919-3.294 4.489-2.53 11.987 1.29 15.855 1.958 2.005 4.441 3.056 7.067 3.056.288 0 .621 0 .908-.048h.096l158.213-20.153h.096c2.721-.43 5.109-2.005 6.685-4.441 1.72-2.675 2.34-5.97 1.576-8.93-1.242-4.824-5.444-7.976-10.745-7.976zM263.301 583.999c.573-.669.43-1.72-.238-2.245l-20.678-16.857c-.24-.191-.43-.382-.621-.526-.669-.621-1.72-.478-2.293.239l-21.585 27.077c-.907 1.098 0 2.77 1.433 2.626l38.252-3.916c.43-.047.812-.238 1.098-.572zM284.839 452.529l-36.915 87.344c-1.719 4.06-1.05 8.596 1.576 11.987a10.063 10.063 0 001.863 1.91l20.678 16.858c.43.334.907.668 1.337.955 1.91 1.145 4.059 1.767 6.208 1.767 2.388 0 4.775-.717 6.877-2.15l77.076-54.154c-.764-.525-1.48-1.098-2.197-1.671l-74.832-61.413c-.572-.478-1.098-.956-1.671-1.433zM293.053 408.45c-5.11 5.684-6.972 13.086-5.779 20.01a23.767 23.767 0 003.82 9.408 23.855 23.855 0 004.585 5.014l74.833 61.413a22.977 22.977 0 006.112 3.63 23.737 23.737 0 009.026 1.767c.334 0 .62 0 .955-.048 7.02-.287 13.85-3.582 18.338-9.742l6.256-8.405 166.713-223.972c7.546-10.267 5.683-24.594-4.154-32.664l-55.635-45.081c-4.441-3.582-9.742-5.349-15.09-5.349a23.938 23.938 0 00-17.766 7.88l-185.48 208.547z"/></g></svg>`;
    default:
      return `<svg ${commonAttrs}><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`;
  }
}


/**
 * Finds all SVG files in a given directory.
 * @param {string} dir - The directory to search.
 * @returns {Promise<string[]>} A list of absolute file paths.
 */
async function findSvgFiles(dir) {
  const files = await fs.readdir(dir);
  const filelist = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isFile() && path.extname(file).toLowerCase() === '.svg') {
      filelist.push(filePath);
    }
  }
  return filelist;
}

/**
 * Formats a string (like a TargetView or filename) into a human-readable title case.
 * Example: "RC_PLAN_VIEW" -> "Rc Plan View"
 * Example: "my_drawing_01.svg" -> "My Drawing 01"
 * @param {string} name The input string.
 * @returns {string} The formatted string.
 */
function formatName(name) {
  return name
    .replace('.svg', '') // Remove file extension
    .replace(/_/g, ' ')   // Replace underscores with spaces
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize the first letter of each word
}

/**
 * Gets a simplified key for icon selection based on the full TargetView name.
 * @param {string} targetView The raw TargetView string (e.g., "RC_PLAN_VIEW").
 * @returns {string} The icon key (e.g., "plan").
 */
function getIconKeyFromTargetView(targetView) {
  const upperView = targetView.toUpperCase();
  if (upperView.includes('REFLECTED')) return 'reflected';
  if (upperView.includes('PLAN')) return 'plan';
  if (upperView.includes('SECTION')) return 'section';
  if (upperView.includes('ELEVATION')) return 'elevation';
  if (upperView.includes('3D') || upperView.includes('MODEL')) return '3d';
  if (upperView.includes('SKETCH') || upperView.includes('DRAFT')) return 'sketch';
  return 'default';
}


/**
 * Populates a given list element with SVG files from a specific folder within a given project.
 * @param {string} projectPath - The absolute path to the root of the project.
 * @param {string} folderName - The name of the folder within the project path (e.g., 'drawings').
 * @param {HTMLElement} listContainer - The parent container (e.g., #accordion-drawings-content or a <ul>).
 */
export async function populateFileList(projectPath, folderName, listContainer) {
  const folderPath = path.join(projectPath, folderName);

  try {
    if (!(await fs.stat(folderPath)).isDirectory()) return;

    const svgFiles = await findSvgFiles(folderPath);

    if (folderName === 'drawings') {
      const targetViewMap = getDrawingTargetViewMap();
      const dynamicContainer = document.getElementById('dynamic-accordion-container');
      if (!dynamicContainer) return;

      // 1. Group files by their actual TargetView name
      const groupedFiles = {};
      svgFiles.forEach(filePath => {
        const fileName = path.basename(filePath);
        const targetView = targetViewMap[fileName] || 'Uncategorized';
        if (!groupedFiles[targetView]) {
          groupedFiles[targetView] = [];
        }
        groupedFiles[targetView].push({ fileName, filePath });
      });

      dynamicContainer.innerHTML = '';

      // 2. Implement custom sorting for group names
      const priorityOrder = ['PLAN_VIEW', 'SECTION_VIEW', 'ELEVATION_VIEW', 'REFLECTED_PLAN_VIEW', 'MODEL_VIEW'];
      const sortedGroupNames = Object.keys(groupedFiles).sort((a, b) => {
        const rankA = priorityOrder.indexOf(a);
        const rankB = priorityOrder.indexOf(b);

        // If both are in the priority list, sort by their rank
        if (rankA !== -1 && rankB !== -1) return rankA - rankB;
        // If only A is in the list, it comes first
        if (rankA !== -1) return -1;
        // If only B is in the list, it comes first
        if (rankB !== -1) return 1;
        // If neither are in the list, sort them alphabetically
        return a.localeCompare(b);
      });

      // 3. Dynamically create an accordion for each sorted group
      for (const groupName of sortedGroupNames) {
        const filesInGroup = groupedFiles[groupName];
        filesInGroup.sort((a, b) => a.fileName.localeCompare(b.fileName));

        const iconKey = getIconKeyFromTargetView(groupName);
        const baseIconHTML = getIconForType(iconKey);
        
        // --- THIS IS THE FIX for the list item icons ---
        const listItemsHTML = filesInGroup.map(file => {
          const itemIconHTML = baseIconHTML.replace('<svg ', '<svg class="size-4 shrink-0" ');
          return `
            <li data-file-path="${file.filePath}" data-folder="${folderName}">
              ${itemIconHTML}
              <span class="file-name">${formatName(file.fileName)}</span>
            </li>
          `;
        }).join('');

        // --- THIS IS THE FIX for the accordion button icons ---
        // Create two separate, properly classed SVG strings
        const closedIconHTML = baseIconHTML.replace('<svg ', '<svg class="hs-accordion-active:hidden block size-4 shrink-0" ');
        const openIconHTML = baseIconHTML.replace('<svg ', '<svg class="hs-accordion-active:block hidden size-4 shrink-0" ');

        const accordionHTML = `
          <div class="hs-accordion">
            <button class="hs-accordion-toggle hs-accordion-active:text-[#3b82f6] dark:text-gray-400 accordion-D-L-S-G">
              ${closedIconHTML}
              ${openIconHTML}
              ${formatName(groupName)}
            </button>
            <div class="hs-accordion-content hidden w-full overflow-hidden transition-[height] duration-300 ">
              <ul class="ps-6 text-[12px] font-[DejaVu_Sans] dark:bg-[#3D424C] dark:shadow-neutral-700/70 dark:text-gray-400">${listItemsHTML}</ul>
            </div>
          </div>
        `;
        dynamicContainer.insertAdjacentHTML('beforeend', accordionHTML);
      }

      // 4. Re-initialize Preline accordions
      setTimeout(() => {
        if (window.HSStaticMethods) {
          window.HSStaticMethods.autoInit('hs-accordion');
        }
      }, 0);

    } else {
      // Logic for Layouts and Sheets
      listContainer.innerHTML = '';
      svgFiles.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
      
      svgFiles.forEach(filePath => {
        const fileName = path.basename(filePath);
        const iconHTML = getIconForType('default').replace('<svg ', '<svg class="size-4 shrink-0" ');
        const listItem = document.createElement('li');
        listItem.innerHTML = `${iconHTML}<span class="file-name">${formatName(fileName)}</span>`;
        listItem.dataset.filePath = filePath;
        listItem.dataset.folder = folderName;
        listContainer.appendChild(listItem);
      });
    }
  } catch (err) {
    console.error(`Error populating file list for ${folderName}:`, err);
  }
}

/**
 * Saves the current CSS changes to the .css file and the internal <style> of the .svg file.
 * @param {boolean} silent - If true, suppresses the success alert.
 */
export async function saveChanges(silent = false) {
  if (isEditing()) {
    const svgViewerContent = document.getElementById('svg-viewer-content');
    const currentSvgElement = svgViewerContent.querySelector('svg');
    if (!currentSvgElement) {
      if (!silent) alert('No SVG is currently loaded.');
      return;
    }
    const currentSvgFilePath = currentSvgElement.dataset.filePath;
    const cssFile = getCurrentCssFile();
    let cssContent = getCurrentCssContent();

    if (!cssFile && !currentSvgFilePath) {
      if (!silent) alert('Cannot save. No CSS file or SVG file is loaded.');
      return;
    }

    // --- START: FORMATTING LOGIC ---
    // Remove double newlines between rules, but preserve them around comments.
    cssContent = cssContent.replace(/(\r\n|\n){2,}(?!\s*\/\*)/g, '\n');
    // --- END: FORMATTING LOGIC ---

    try {
      // 1. Overwrite the external .css file
      if (cssFile) {
        await fs.writeFile(cssFile, cssContent, 'utf8');
        console.log(`💾 CSS saved to: ${cssFile}`);
      }

      // 2. Overwrite the internal <style> block of the .svg file
      if (currentSvgFilePath) {
        let svgData = await fs.readFile(currentSvgFilePath, 'utf8');
        const styleRegex = /<style[\s\S]*?<\/style>/;
        const newStyleTag = `<style type="text/css"><![CDATA[${cssContent}]]></style>`;

        if (styleRegex.test(svgData)) {
          svgData = svgData.replace(styleRegex, newStyleTag);
        } else {
          // If no style tag exists, insert it before the closing <\/svg> tag
          svgData = svgData.replace('</svg>', `${newStyleTag}\n</svg>`);
        }
        await fs.writeFile(currentSvgFilePath, svgData, 'utf8');
        console.log(`💾 CSS saved to internal style block of: ${currentSvgFilePath}`);
      }

      if (!silent) {
        alert('CSS saved successfully!');
      }
      return currentSvgFilePath; // Return path for potential reload

    } catch (err) {
      console.error('Error saving files:', err);
      if (!silent) alert('An error occurred while saving. See the console for details.');
    }
  } else {
    // If not in editing mode, we are in manipulation/layout mode.
    await saveLayout(silent);
  }
  return null;
}

async function generateLayoutFromCurrentState() {
  // A function to parse SVG transform attributes, duplicated here to avoid complex module dependencies.
  function parseTransform(transformStr) {
    let dx = 0, dy = 0, rotation = 0;
    if (!transformStr) return { dx, dy, rotation };
    const translateMatch = transformStr.match(/translate\s*\(\s*([^,\s]+)(?:\s*,\s*([^)]+))?\s*\)/);
    if (translateMatch) {
      dx = parseFloat(translateMatch[1]) || 0;
      dy = parseFloat(translateMatch[2]) || 0;
    }
    const rotateMatch = transformStr.match(/rotate\s*\(\s*([^,\s)]+)(?:\s*,\s*([^,\s)]+)\s*,\s*([^)]+))?\s*\)/);
    if (rotateMatch) {
      rotation = parseFloat(rotateMatch[1]) || 0;
    }
    return { dx, dy, rotation };
  }

  const originalLayoutString = getOriginalLayoutContent();
  const liveSvg = getCurrentSvgElement();

  if (!originalLayoutString || !liveSvg) {
    console.error("Cannot save layout: Missing original layout content or live SVG element.");
    throw new Error("Missing original layout content or live SVG element.");
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(originalLayoutString, "image/svg+xml");
  const templateSvg = doc.documentElement;

  const liveDrawingGroups = liveSvg.querySelectorAll('g[data-type="drawing"][data-drawing]');

  liveDrawingGroups.forEach(liveGroup => {
    const drawingId = liveGroup.getAttribute('data-drawing');
    const transformStr = liveGroup.getAttribute('transform') || '';

    const templateGroup = templateSvg.querySelector(`g[data-drawing="${drawingId}"]`);
    if (!templateGroup) {
      console.warn(`SaveLayout: Could not find group with data-drawing="${drawingId}" in template.`);
      return;
    }

    const { dx, dy, rotation } = parseTransform(transformStr);

    if (rotation !== 0) {
      console.warn(`Rotation for drawing ${drawingId} is being ignored to conform to the required output format.`);
    }

    if (dx === 0 && dy === 0) {
      return; // No translation change, so skip.
    }

    const templateImages = templateGroup.querySelectorAll('image');
    templateImages.forEach(image => {
      const x_orig = parseFloat(image.getAttribute('x')) || 0;
      const y_orig = parseFloat(image.getAttribute('y')) || 0;

      const newX = x_orig + dx;
      const newY = y_orig + dy;

      image.setAttribute('x', newX.toFixed(6));
      image.setAttribute('y', newY.toFixed(6));
      image.removeAttribute('transform'); // Ensure no transform attribute is left.
    });
  });

  // --- Upsert foreignObject text blocks ---
  const liveForeignObjects = liveSvg.querySelectorAll('g[data-fo-id]');
  liveForeignObjects.forEach(liveFoGroup => {
    const foId = liveFoGroup.getAttribute('data-fo-id');
    const existingFoGroupInTemplate = templateSvg.querySelector(`g[data-fo-id="${foId}"]`);
    
    const cleanFoGroup = liveFoGroup.cloneNode(true);
    cleanFoGroup.classList.remove('fo-selected');

    if (existingFoGroupInTemplate) {
      // If it already exists in the template, replace it with the updated version
      existingFoGroupInTemplate.parentNode.replaceChild(cleanFoGroup, existingFoGroupInTemplate);
    } else {
      // If it's a new text block, append it
      templateSvg.appendChild(cleanFoGroup);
    }
  });
  // --- END --- 

  // Clean the root SVG element to strictly match the correct format.
  const allowedAttributes = ['xmlns', 'xmlns:xlink', 'id', 'version', 'width', 'height', 'viewBox'];
  for (let i = templateSvg.attributes.length - 1; i >= 0; i--) {
    const attr = templateSvg.attributes[i];
    if (!allowedAttributes.includes(attr.name)) {
      templateSvg.removeAttribute(attr.name);
    }
  }
  
  // Ensure required attributes are present
  templateSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  templateSvg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');


  const serializer = new XMLSerializer();
  let svgString = serializer.serializeToString(templateSvg);

  // The serializer can sometimes create incorrect namespace prefixes; this corrects them.
  svgString = svgString.replace(/ (xmlns:)?ns\d+=""/g, ''); // Remove empty namespaces
  svgString = svgString.replace(/ns\d+:href/g, 'xlink:href'); // Fix hrefs

  return svgString;
}

/**
 * Saves the current state of the layout back to its original file.
 * @param {boolean} silent - If true, suppresses the success alert.
 */
export async function saveLayout(silent = false) {
  if (!getIsLayoutFile() || !getLayoutFilePath()) {
    throw new Error('No layout file currently loaded');
  }

  const currentSvg = getCurrentSvgElement();
  if (!currentSvg) {
    throw new Error('No SVG element found');
  }

  const newLayoutContent = await generateLayoutFromCurrentState(currentSvg);
  await fs.writeFile(getLayoutFilePath(), newLayoutContent, 'utf8');

  setLayoutModified(false);
  setOriginalLayoutContent(newLayoutContent);
  
  if (!silent) {
    alert('Layout saved successfully');
  }
}

/**
 * Attempts to load a CSS file and updates the state on success.
 * Returns an object indicating success or failure, allowing the caller to handle fallbacks.
 * @param {string} filePath - The absolute path to the CSS file.
 * @returns {Promise<{success: boolean, error?: Error}>}
 */
export async function loadCssFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    
    // On success, update the state with the file's content and path.
    setCurrentCssContent(content);
    setCurrentCssFile(filePath);
    
    // Report success back to the caller (svgLoader).
    return { success: true };
    
  } catch (err) {
    // On failure, we no longer touch the state or the DOM here.
    // We simply report the failure back to the caller.
    console.warn(`Could not find or read CSS file at ${filePath}. Will attempt to use internal styles.`);
    return { success: false, error: err };
  }
}

// --- REWRITTEN PATTERN SAVING LOGIC ---

/**
 * Helper function to remove an existing pattern from an SVG string content.
 * @param {string} content - The SVG file content as a string.
 * @param {string} patternId - The ID of the pattern to remove.
 * @returns {string} - The content with the pattern removed.
 */
function removePatternFromString(content, patternId) {
  // This regex finds a <pattern> tag with a specific id and removes it entirely.
  // It handles single or double quotes around the id and multi-line pattern definitions.
  const patternRegex = new RegExp(`<pattern[^>]*id=["']${patternId}["'][^>]*>[\\s\\S]*?<\\/pattern>`, 'g');
  return content.replace(patternRegex, '').trim();
}

/**
 * Saves a new or updated pattern to both the reference patterns.svg file and the current drawing.
 * This function orchestrates the saving process.
 * @param {string} patternId - The new pattern ID.
 * @param {string} patternHTML - The complete pattern HTML string.
 */
export async function savePatternToBothLocations(patternId, patternHTML) {
  try {
    // 1. Save to reference patterns.svg file
    await savePatternToReferenceFile(patternId, patternHTML);
    
    // 2. Save to current drawing's <defs> section (both live DOM and file)
    await savePatternToCurrentDrawing(patternId, patternHTML);
    
    console.log(`Pattern "${patternId}" saved to both reference file and current drawing`);
  } catch (error) {
    console.error('Error saving pattern to both locations:', error);
    throw error;
  }
}

/**
 * Saves/updates a pattern in the reference patterns.svg file using string manipulation.
 * @param {string} patternId - The pattern ID.
 * @param {string} patternHTML - The pattern HTML string.
 */
async function savePatternToReferenceFile(patternId, patternHTML) {
  const patternsFilePath = getCurrentPatternsFile();
  if (!patternsFilePath) throw new Error('No patterns file currently loaded');
  
  try {
    let content = await fs.readFile(patternsFilePath, 'utf8');
    
    // First, remove the old version of the pattern if it exists.
    content = removePatternFromString(content, patternId);

    // Find the closing </svg> tag to insert the new pattern before it.
    const insertionPoint = content.lastIndexOf('</svg>');
    if (insertionPoint === -1) {
      throw new Error('Invalid patterns.svg file: missing </svg> tag.');
    }

    // Insert the new pattern HTML right before the closing </svg> tag.
    const updatedContent = `${content.slice(0, insertionPoint)}${patternHTML}\n${content.slice(insertionPoint)}`;
    
    await fs.writeFile(patternsFilePath, updatedContent, 'utf8');
    console.log(`Pattern "${patternId}" saved to reference patterns.svg`);
  } catch (error) {
    console.error('Error saving pattern to reference file:', error);
    throw error;
  }
}

/**
 * Saves/updates a pattern in the current drawing's <defs> section.
 * It updates both the live DOM for immediate feedback and the SVG file on disk.
 * @param {string} patternId - The pattern ID.
 * @param {string} patternHTML - The pattern HTML string.
 */
async function savePatternToCurrentDrawing(patternId, patternHTML) {
  const svgViewerContent = document.getElementById('svg-viewer-content');
  const currentSvgElement = svgViewerContent.querySelector('svg');
  if (!currentSvgElement) throw new Error('No current SVG drawing loaded');
  
  const currentSvgFilePath = currentSvgElement.dataset.filePath;
  if (!currentSvgFilePath) throw new Error('No file path found for current SVG');

  try {
    // 1. Update the live DOM first for instant visual update.
    let defs = currentSvgElement.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      currentSvgElement.insertBefore(defs, currentSvgElement.firstChild);
    }
    
    // Remove existing pattern from live DOM if it's there.
    const existingLivePattern = defs.querySelector(`pattern[id="${patternId}"]`);
    if (existingLivePattern) existingLivePattern.remove();
    
    // Add the new pattern at the end of the <defs> section in the live DOM.
    defs.insertAdjacentHTML('beforeend', patternHTML);
    
    // 2. Update the SVG file on disk using non-destructive string manipulation.
    let fileContent = await fs.readFile(currentSvgFilePath, 'utf8');
    
    // Remove the old version of the pattern from the file content.
    fileContent = removePatternFromString(fileContent, patternId);

    // Find the closing </defs> tag. This is the correct place to add new definitions.
    const insertionPoint = fileContent.lastIndexOf('</defs>');
    
    if (insertionPoint !== -1) {
      // If <defs> exists, insert the pattern HTML right before its closing tag.
      const updatedFileContent = `${fileContent.slice(0, insertionPoint)}${patternHTML}\n${fileContent.slice(insertionPoint)}`;
      await fs.writeFile(currentSvgFilePath, updatedFileContent, 'utf8');
    } else {
      // Fallback: If no <defs> tag, create one and insert it after the opening <svg> tag.
      const svgTagEnd = fileContent.indexOf('>') + 1;
      const updatedFileContent = `${fileContent.slice(0, svgTagEnd)}\n<defs>\n${patternHTML}\n</defs>${fileContent.slice(svgTagEnd)}`;
      await fs.writeFile(currentSvgFilePath, updatedFileContent, 'utf8');
    }
    
    console.log(`Pattern "${patternId}" saved to current drawing: ${path.basename(currentSvgFilePath)}`);
  } catch (error) {
    console.error('Error saving pattern to current drawing:', error);
    throw error;
  }
}