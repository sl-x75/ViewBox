// src/logic/codeEditor.js

import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { autocompletion, completionKeymap } from '@codemirror/autocomplete';
import { search, searchKeymap, findNext, findPrevious, replaceNext, replaceAll, closeSearchPanel, setSearchQuery, SearchQuery } from '@codemirror/search';
import { EditorState, StateEffect, Compartment } from '@codemirror/state';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { json } from '@codemirror/lang-json';
import { markdown } from '@codemirror/lang-markdown';
import { xml } from '@codemirror/lang-xml';
import { color } from '@uiw/codemirror-extensions-color';
import { githubDark, materialDark, materialLight, nord, tokyoNight, xcodeDark } from '@uiw/codemirror-themes-all';
import { readFileContent, writeFileContent } from '../utils/fileOperations.js';
import { loadSvgFile } from './svgLoader.js';
import { 
    getCurrentSvgElement, 
    getCurrentCssFile, 
    getCurrentPatternsFile, 
    getCurrentMarkersFile 
} from '../state.js';
import { getSetting } from '../logic/settings.js';


let editorView = null;
let currentFilePath = null;
let editorContentContainer = null;
let splitterContainer = null;
let themeChangeListener = null;
const themeCompartment = new Compartment();
const fontSizeCompartment = new Compartment();
const fontFamilyCompartment = new Compartment();
const wordWrapCompartment = new Compartment();

function getLanguageExtension(filePath) {
    const extension = filePath.split('.').pop().toLowerCase();
    switch (extension) {
        case 'js': return javascript();
        case 'css': return css();
        case 'html': return html();
        case 'json': return json();
        case 'md': return markdown();
        case 'svg': return xml();
        default: return [];
    }
}

// --- START: SEARCH LOGIC ---

// The single function to control the search panel's visibility and state
export function toggleSearchPanel(show) {
  if (!editorView) return;
  // --- CHANGE THIS ID ---
  const panel = document.getElementById('code-editor-search-controls');  
  // --- END CHANGE ---

  if (show) {
    panel.classList.remove('hidden');
    // ... rest of the function is unchanged
  } else {
    panel.classList.add('hidden');
    // ... rest of the function is unchanged
  }
}

export function updateSearchQuery() {
  if (!editorView) return;
  
  // Get the state of all UI elements
  const query = document.getElementById('search-input').value;
  const replace = document.getElementById('replace-input').value; // <-- FIX: Read the replace input
  const caseSensitive = document.getElementById('search-case-btn').dataset.active === 'true';
  const wholeWord = document.getElementById('search-word-btn').dataset.active === 'true';
  const regexp = document.getElementById('search-regexp-btn').dataset.active === 'true';

  console.log(`[Search] Updating state:`, { query, replace, caseSensitive, wholeWord, regexp });
  
  // Create the SearchQuery object with all options, including the replacement text
  const searchQuery = new SearchQuery({
    search: query,
    replace: replace, // <-- FIX: Add the replace text to the state object
    caseSensitive,
    wholeWord,
    regexp
  });
  
  // Dispatch the update to the editor state
  editorView.dispatch({
    effects: setSearchQuery.of(searchQuery)
  });
}

// Wrappers around the CM commands that now rely on the state
export function runFindNext() { if (editorView) findNext(editorView); }
export function runFindPrevious() { if (editorView) findPrevious(editorView); }

// FIX: This function no longer needs to pass the replace text manually.
// It triggers the command, which uses the text from the SearchQuery state.
export function runReplaceNext() { 
    if (editorView) {
        replaceNext(editorView);
    }
}

// FIX: This function is also simplified to use the state.
export function runReplaceAll() { 
    if (editorView) {
        replaceAll(editorView);
    }
}


export function initializeCodeEditor(container, initialContent = '', filePath = '') {
    if (editorView) {
        destroyCodeEditor();
    }

    currentFilePath = filePath;
    editorContentContainer = container;
    
    const filenameDisplay = document.getElementById('code-editor-filename');
    if (filenameDisplay) {
        filenameDisplay.textContent = filePath.split(/[\\/]/).pop();
    }

    const languageExtension = getLanguageExtension(filePath);

    const isDarkMode = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    const initialTheme = isDarkMode ? xcodeDark : materialLight;

    // --- THIS IS THE FIX ---
    // Read the user's saved settings before creating the editor state.
    const userFontSize = getSetting('codeEditor.fontSize') || 14;
    const userFontFamily = getSetting('codeEditor.fontFamily') || 'monospace';
    const userWordWrap = getSetting('codeEditor.wordWrap') || false;

    const customFontSize = (size) => EditorView.theme({ '&': { fontSize: `${size}px` } });
    const customFontFamily = (family) => EditorView.theme({ '.cm-scroller': { fontFamily: family } });
    const wordWrap = () => EditorView.lineWrapping;
    
    const startState = EditorState.create({
        doc: initialContent,
        extensions: [
            basicSetup,
            languageExtension,
            autocompletion(),
            color,
            themeCompartment.of(initialTheme),
            
            // Use the settings we just read instead of hardcoded defaults.
            fontSizeCompartment.of(customFontSize(userFontSize)),
            fontFamilyCompartment.of(customFontFamily(userFontFamily)),
            wordWrapCompartment.of(userWordWrap ? wordWrap() : []),

            keymap.of(completionKeymap),
            search({
              createPanel: (view) => {
                toggleSearchPanel(true);
                const dummy = document.createElement('div');
                return {
                  dom: dummy,
                  update(update) { /* Can be empty */ } 
                };
              }
            }),
            keymap.of(searchKeymap),
        ],
    });

    editorView = new EditorView({
        state: startState,
        parent: editorContentContainer,
    });

    themeChangeListener = event => {
        const newTheme = event.matches ? nord : materialLight;
        if (editorView) {
            editorView.dispatch({
                effects: themeCompartment.reconfigure(newTheme)
            });
        }
    };
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChangeListener);

    console.log(`CodeMirror editor initialized for: ${filePath}`);
}

// --- START: ADD NEW EXPORTED FUNCTIONS ---
export function setEditorFontSize(size) {
  if (!editorView) return;
  const customFontSize = (s) => EditorView.theme({ '&': { fontSize: `${s}px` } });
  editorView.dispatch({
    effects: fontSizeCompartment.reconfigure(customFontSize(size))
  });
}

export function setEditorFontFamily(family) {
  if (!editorView) return;
  const customFontFamily = (f) => EditorView.theme({ '.cm-scroller': { fontFamily: f } });
  editorView.dispatch({
    effects: fontFamilyCompartment.reconfigure(customFontFamily(family))
  });
}

export function setEditorWordWrap(isEnabled) {
  if (!editorView) return;
  const wordWrap = () => EditorView.lineWrapping;
  editorView.dispatch({
    effects: wordWrapCompartment.reconfigure(isEnabled ? wordWrap() : [])
  });
}
// --- END: ADD NEW EXPORTED FUNCTIONS ---

// --- The rest of the file is unchanged ---
export function getCodeEditorContent() { return editorView ? editorView.state.doc.toString() : ''; }
export function destroyCodeEditor() {
    if (editorView) {
        editorView.destroy();
        editorView = null;
        currentFilePath = null;
        console.log('CodeMirror editor destroyed.');
    }
    if (themeChangeListener) {
        window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', themeChangeListener);
        themeChangeListener = null;
    }
}
export async function openFileInEditor(filePath) {
    if (!splitterContainer) {
        splitterContainer = document.getElementById('code-editor-splitter-container');
    }
    if (!editorContentContainer) {
        editorContentContainer = document.getElementById('code-editor-content');
    }
    if (!splitterContainer || !editorContentContainer) {
        console.error('Code editor splitter or content container not found in DOM.');
        return;
    }
    destroyCodeEditor();
    try {
        const content = await readFileContent(filePath);
        splitterContainer.classList.remove('hidden');
        initializeCodeEditor(editorContentContainer, content, filePath);
    } catch (error) {
        console.error(`Error opening file ${filePath} in editor:`, error);
        alert(`Failed to open file: ${filePath}. Error: ${error.message}`);
        closeCodeEditor();
    }
}
export function closeCodeEditor() {
    destroyCodeEditor();
    if (splitterContainer) {
        splitterContainer.classList.add('hidden');
    }
    console.log('Code editor closed.');
}
export async function saveCodeEditorContent() {
    if (!editorView || !currentFilePath) {
        console.warn('No file open in editor to save.');
        return;
    }
    const content = getCodeEditorContent();
    try {
        await writeFileContent(currentFilePath, content);
        console.log(`File ${currentFilePath} saved successfully.`);
        const currentSvgElement = getCurrentSvgElement();
        if (currentSvgElement) {
            const currentSvgPath = currentSvgElement.dataset.filePath;
            const currentAssets = [
                getCurrentCssFile(),
                getCurrentPatternsFile(),
                getCurrentMarkersFile()
            ];
            if (currentAssets.includes(currentFilePath) && currentSvgPath) {
                console.log(`Asset file '${currentFilePath}' was saved. Reloading SVG view...`);
                await loadSvgFile(currentSvgPath);
            }
        }
    } catch (error) {
        console.error(`Error saving file ${currentFilePath}:`, error);
        alert(`Failed to save file: ${currentFilePath}. Error: ${error.message}`);
    }
}