// src/renderer.js

import './styles/tailwind.css';
import './styles/guides.css';
import './styles/start-page.css';
import '@melloware/coloris/dist/coloris.css';
import 'preline';
import path from 'path';
import { ipcRenderer } from 'electron';

// State and Logic imports
import { populateFileList } from './logic/files.js';
import { setupViewerAndGuides } from './logic/guides.js';
import { initializeDefaultRulesEventListeners } from './logic/defaultRules.js';
import { initializeCodeEditor } from './logic/codeEditor.js';
import { initializeUI } from './ui/init.js';
import { initializeEventListeners } from './ui/events.js';
import Coloris from '@melloware/coloris';
import { loadSvgFile } from './logic/svgLoader.js'; // <-- ADDED
import { getCurrentSvgElement, setDrawingToAssetMap, setIfcMaterialCategories, setDrawingTargetViewMap } from './state.js'; // <-- ADDED
import { getDrawingToAssetMap as parseAssetMap, getMaterialsFromIFC as parseMaterials, getDrawingTargetViewMap as parseDrawingTargetViews, getProjectCardData as parseProjectCardData } from './ifc-parser.js'; // <-- ADDED
import { loadSettings,getSetting, applySetting, populateSettingsPanel, updateAllSliderAttributes } from './logic/settings.js'; // Update imports
import { initializeTheme } from './logic/theme.js';


// --- SPA and Title Bar Logic ---

const startPageView = document.getElementById('start-page-view');
const mainAppView = document.getElementById('main-app-view');
let isAppInitialized = false; 

async function showMainApp(projectPath) {
  const svgOverlay = document.getElementById('svg-overlay');
  if (svgOverlay) {
      svgOverlay.classList.add('hidden');
  }
  if (!projectPath) return;

  ipcRenderer.send('set-project-to-watch', projectPath);

  startPageView.classList.add('hidden');
  mainAppView.classList.remove('hidden');

  if (!isAppInitialized) {
    await initializeMainApp(projectPath);
    isAppInitialized = true;
  }

  await populateFileList(projectPath, 'drawings', document.getElementById('accordion-drawings-content'));
  await populateFileList(projectPath, 'layouts', document.getElementById('layouts-list'));
  await populateFileList(projectPath, 'sheets', document.getElementById('sheets-list'));

  const projectNameTitle = document.querySelector('#sidebar h1');
  if (projectNameTitle) {
    const cardData = await parseProjectCardData(projectPath);
    projectNameTitle.textContent = cardData.projectName || path.basename(projectPath);
  }
}

async function initializeMainApp(projectPath) {
  // --- REPLACE YOUR EXISTING Coloris.init() WITH THIS BLOCK ---
  // Load settings first
  await loadSettings();
  
  // Now initialize Coloris with the loaded settings
  Coloris.init();
  Coloris.setInstance('.coloris-input', {
    theme: 'editor',
    swatches: getSetting('coloris.swatches')
  });
   Coloris.setInstance('.coloris-input-pattern-editor', {
    theme: 'pattern',
    swatches: getSetting('coloris.swatches')
  });
  // --- END REPLACEMENT BLOCK ---

  // --- Apply initial settings ---
  applySetting('viewer.backgroundColor'); // This will now respect the theme
  applySetting('codeEditor.fontSize', getSetting('codeEditor.fontSize'));
  applySetting('codeEditor.fontFamily', getSetting('codeEditor.fontFamily'));
  applySetting('codeEditor.wordWrap', getSetting('codeEditor.wordWrap'));
  updateAllSliderAttributes(); // Apply slider settings on load
  
  const [assetMap, materialCategories, drawingTargetViewMap] = await Promise.all([
    parseAssetMap(projectPath),
    parseMaterials(projectPath),
    parseDrawingTargetViews(projectPath)
  ]);

  setDrawingToAssetMap(assetMap);
  setIfcMaterialCategories(materialCategories);
  setDrawingTargetViewMap(drawingTargetViewMap);

  initializeUI();
  await setupViewerAndGuides();
  initializeEventListeners();
  initializeDefaultRulesEventListeners();
  initializeCodeEditor(document.getElementById('code-editor-content'));
  
  console.log('✅ Main App Initialization complete');
}



function updateCardWithRichData(cardElement, cardData) {
  const finalInnerHTML = `
    <div class="relative pt-[50%] rounded-t-xl overflow-hidden bg-gray-100">
      <img class="size-full absolute top-0 start-0 object-cover group-hover:scale-105 transition-transform duration-500 ease-in-out" src="" alt="Project Preview">
    </div>
    <div class="p-4 md:p-5 flex flex-col justify-between flex-grow">
      <div>
        <h3 class="text-md font-[DejaVu_Sans]  text-gray-900 truncate ">${cardData.projectName || 'Unnamed Project'}</h3>
        <div class="mt-2 space-y-2 text-xs text-gray-600  font-[DejaVu_Sans]"></div>
      </div>
      <span class="mt-4 text-xs text-blue-600 hover:underline truncate open-folder-link cursor-pointer" title="Open project folder" data-folder-path="${cardData.projectPath}">${cardData.projectPath}</span>
    </div>
  `;
  cardElement.innerHTML = finalInnerHTML;
  const imgElement = cardElement.querySelector('img');
  const detailsContainer = cardElement.querySelector('.space-y-2');
  const addDetail = (label, value, email = null) => {
    if (!value) return;
    const emailLink = email ? ` (<a href="mailto:${email}" class="text-blue-600 hover:underline" onclick="event.stopPropagation()">${email}</a>)` : '';
    detailsContainer.innerHTML += `<div><span class="font-semibold">${label}:</span> <span class="text-gray-800">${value}${emailLink}</span></div>`;
  };
  addDetail('Author', cardData.author, cardData.authorEmail);
  addDetail('Organization', cardData.organization, cardData.organizationEmail);
  addDetail('Authorizer', cardData.authorizer);
  addDetail('View', cardData.viewDefinition);
  addDetail('Schema', cardData.schema);
  addDetail('Modified', cardData.lastModified);
  if (cardData.previewImagePath) {
    imgElement.src = `bonsai-file://${cardData.previewImagePath}`;
  } else {
    imgElement.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23d1d5db' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z'/%3E%3Cpolyline points='14 2 14 8 20 8'/%3E%3C/svg%3E";
    imgElement.classList.add('p-8');
  }
}

function renderSkeletonCards(projects) {
  const recentProjectsList = document.getElementById('recent-projects-list');
  if (!recentProjectsList) return;
  if (projects && projects.length > 0) {
    recentProjectsList.innerHTML = '';
    const cardTemplate = `<a class="flex flex-col group bg-white border-2 border-gray-200 shadow-md rounded-xl overflow-hidden w-72 flex-shrink-0" href="#"><div class="relative pt-[50%] rounded-t-xl overflow-hidden bg-gray-100"><div class="size-full absolute top-0 start-0 bg-gray-200 animate-pulse"></div></div><div class="p-4 md:p-5 flex flex-col justify-between flex-grow"><div><h3 class="text-md font-[DejaVu_Sans] text-gray-900 truncate"></h3><div class="mt-2 space-y-3"><div class="h-4 bg-gray-200 rounded  w-3/4 animate-pulse"></div><div class="h-4 bg-gray-200 rounded w-1/2 animate-pulse"></div><div class="h-4 bg-gray-200 rounded w-5/6 animate-pulse"></div></div></div><p class="mt-4 text-xs text-gray-400 truncate" title="Project Path"></p></div></a>`;
    projects.forEach(p => {
      const cardFragment = document.createRange().createContextualFragment(cardTemplate);
      const cardElement = cardFragment.querySelector('a');
      cardElement.dataset.path = p.projectPath;
      cardElement.querySelector('h3').textContent = p.projectName || 'Unnamed Project';
      const pathElement = cardElement.querySelector('p.truncate');
      pathElement.textContent = p.projectPath;
      pathElement.title = p.projectPath;
      recentProjectsList.appendChild(cardElement);
    });
  } else {
    recentProjectsList.innerHTML = '<li class="text-sm text-gray-500">No recent projects.</li>';
  }
}

async function fetchRichDataForCards(projects) {
  const { getProjectCardData } = await import('./ifc-parser.js');
  for (const project of projects) {
    const cardElement = document.querySelector(`a[data-path="${project.projectPath}"]`);
    if (cardElement) {
      try {
        const cardData = await getProjectCardData(project.projectPath);
        updateCardWithRichData(cardElement, cardData);
      } catch (e) {
        console.error(`Failed to get card data for ${project.projectPath}`, e);
        const detailsContainer = cardElement.querySelector('.space-y-2');
        if (detailsContainer) detailsContainer.innerHTML = '<p class="text-red-500">Error loading details.</p>';
      }
    }
    await new Promise(resolve => setTimeout(resolve, 50));
  }
}

async function loadAndPopulateRecentProjects() {
  const projects = await ipcRenderer.invoke('get-recent-projects');
  renderSkeletonCards(projects);
  return fetchRichDataForCards(projects);
}

function initializeCoreEventListeners() {
  const recentProjectsList = document.getElementById('recent-projects-list');
  const openProjectButton = document.getElementById('open-project-button');
  if (recentProjectsList) {
    recentProjectsList.addEventListener('click', (event) => {
      const folderLink = event.target.closest('.open-folder-link');
      
      if (folderLink) {
        event.stopPropagation();
        const folderPath = folderLink.dataset.folderPath;
        if (folderPath) {
          ipcRenderer.invoke('open-folder', folderPath);
        }
        return;
      }
      
      const projectCard = event.target.closest('a[data-path]');
      if (projectCard) {
        event.preventDefault();
        showMainApp(projectCard.dataset.path);
      }
    }, true);
  }
  if (openProjectButton) {
    openProjectButton.addEventListener('click', async () => {
      const projectPath = await ipcRenderer.invoke('open-project-dialog');
      if (projectPath) showMainApp(projectPath);
    });
  }
  // --- Title Bar Button Listeners ---
  document.getElementById('minimize-btn')?.addEventListener('click', () => {
    ipcRenderer.send('minimize-window');
  });
  document.getElementById('maximize-btn')?.addEventListener('click', () => {
    ipcRenderer.send('maximize-window');
  });
  document.getElementById('close-btn')?.addEventListener('click', () => {
    ipcRenderer.send('close-window');
  });  
}

function startAnimationWorkflow() {
  const overlay = document.getElementById('svg-overlay');
  const startPage = document.getElementById('start-page-view');

  if (sessionStorage.getItem('hasAnimated')) {
    // Subsequent load: hide animation overlay, show start page.
    if (overlay) overlay.style.display = 'none';
    startPage.style.visibility = 'visible';
    loadAndPopulateRecentProjects();
  } else {
    // First load: play animation, then hide overlay and show start page.
    if (overlay) overlay.style.display = 'flex'; // Make sure it's a flex container
    const paths = document.querySelectorAll('#svg-overlay .draw-path');
    startPage.style.visibility = 'hidden'; // Keep start page hidden during animation
    
    if (paths.length === 0) {
      // No animation, just switch views.
      if (overlay) overlay.style.display = 'none';
      startPage.style.visibility = 'visible';
      loadAndPopulateRecentProjects();
      sessionStorage.setItem('hasAnimated', 'true');
      return;
    }

    loadAndPopulateRecentProjects(); // Load projects during animation

    let finishedAnimations = 0;
    const onAllDrawFinished = () => {
      sessionStorage.setItem('hasAnimated', 'true');
      if (overlay) {
        // Fade out and then hide the animation overlay
        overlay.style.opacity = '0';
        overlay.addEventListener('transitionend', () => {
          overlay.style.display = 'none';
        }, { once: true });
      }
      // Make the start page visible
      startPage.style.visibility = 'visible';
    };
    
    paths.forEach(p => {
      p.addEventListener('animationend', () => {
        finishedAnimations++;
        if (finishedAnimations === paths.length) {
          onAllDrawFinished();
        }
      }, { once: true });
    });
  }
}

// --- GLOBAL STARTUP ---
document.addEventListener('DOMContentLoaded', async () => {
  // --- START: SVG Duplication for Start Page ---
  const animatedWrapper = document.getElementById('svg-wrapper-animated');
  if (animatedWrapper) {
    const staticWrapper = animatedWrapper.cloneNode(true);
    staticWrapper.id = 'svg-wrapper-static';
    
    // The paths inside the static one should not be animated, but should be visible with the right style.
    staticWrapper.querySelectorAll('path').forEach(p => {
      p.classList.remove('draw-path');
      p.style.strokeWidth = '5px';
      p.style.fill = 'none';
      p.style.strokeOpacity = '0.95';
      p.setAttribute('vector-effect', 'non-scaling-stroke');
    });

    const staticContainer = document.createElement('div');
    staticContainer.id = 'start-page-static-svg-container';
    staticContainer.appendChild(staticWrapper);

    const contentWrapper = document.querySelector('#start-page-content-wrapper ');
    if (contentWrapper) {
      contentWrapper.style.position = 'relative'; // Make it a positioning context
      contentWrapper.prepend(staticContainer);
    } else {
      // Fallback to old behavior if the structure isn't found
      document.getElementById('start-page-view').prepend(staticContainer);
    }
  }
  // --- END: SVG Duplication ---

    // --- START: ADD THIS PLATFORM DETECTION BLOCK ---
  // Add a CSS class to the body based on the operating system.
  // This allows for platform-specific styling.
  if (window.platform) {
    document.body.classList.add(`platform-${window.platform}`);
  }
  // --- END: ADD THIS BLOCK ---
   // Defer theme initialization to run *after* Preline's own setup.
   // This resolves the race condition where the collection doesn't exist yet.
   setTimeout(() => {
     initializeTheme();
   }, 0);
  initializeCoreEventListeners();
  startAnimationWorkflow();
  document.body.classList.remove('js-cloak');

  // The global listener for on-hs-appearance-change is still needed for the background color!
  window.addEventListener('on-hs-appearance-change', () => {
    console.log('[Theme] Appearance change detected. Applying correct viewer background.');
    applySetting('viewer.backgroundColor');
  });

  // --- START: NEW IPC LISTENERS ---

  // 1. Listen for the simple file list update
  ipcRenderer.on('project-files-updated', async (event, { projectPath }) => {
    console.log('[Renderer] Received file list update event. Refreshing lists...');
    await populateFileList(projectPath, 'drawings', document.getElementById('accordion-drawings-content'));
    await populateFileList(projectPath, 'layouts', document.getElementById('layouts-list'));
    await populateFileList(projectPath, 'sheets', document.getElementById('sheets-list'));
    console.log('[Renderer] File lists refreshed.');
  });

  // 2. Listen for the IFC file update
  ipcRenderer.on('ifc-file-updated', async (event, { projectPath }) => {
    console.log('[Renderer] Received IFC update event. Reparsing assets...');
    // Reparse the IFC to get the latest asset map
    const newAssetMap = await parseAssetMap(projectPath);
    const newDrawingTargetViewMap = await parseDrawingTargetViews(projectPath);
    // Update the central state
    setDrawingToAssetMap(newAssetMap);
    setDrawingTargetViewMap(newDrawingTargetViewMap);
    console.log('[Renderer] Asset map state updated.');
    // NOW, refresh the file lists, which will use the new state.
    await populateFileList(projectPath, 'drawings', document.getElementById('accordion-drawings-content'));
    await populateFileList(projectPath, 'layouts', document.getElementById('layouts-list'));
    await populateFileList(projectPath, 'sheets', document.getElementById('sheets-list'));
    console.log('[Renderer] File lists refreshed with new asset data.');
  });

  // 3. Listen for the current file being changed on disk
  ipcRenderer.on('current-file-updated', async (event, { changedFilePath }) => {
    const currentSvg = getCurrentSvgElement();
    if (currentSvg && currentSvg.dataset.filePath === changedFilePath) {
      console.log(`[Renderer] Current file (${path.basename(changedFilePath)}) was modified externally. Reloading...`);
      await loadSvgFile(changedFilePath);
    }
  });

  // --- END: NEW IPC LISTENERS ---
});