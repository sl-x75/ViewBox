// src/logic/textEditor.js

import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import Paragraph from '@editorjs/paragraph';
import Quote from '@editorjs/quote';
import CodeTool from '@editorjs/code';
import InlineCode from '@editorjs/inline-code';
import Marker from '@editorjs/marker';
import SimpleImage from '@editorjs/simple-image';
import Table from '@editorjs/table';
import Delimiter from '@editorjs/delimiter';
import Warning from '@editorjs/warning';
import interact from 'interactjs';

import { 
  getCurrentSvgElement, 
  getViewer, 
  isTextEditorActive, 
  setTextEditorActive,
  setLayoutModified,
  isManipulating
} from '../state.js';
import { initializeManipulation, destroyManipulation } from '../manipulation.js';
import { enableAutoFit, disableAutoFit } from './svgLoader.js';

// --- DOM Elements & State ---
let svg, canvasWrap, toggleEditorBtn, saveBtn, editorPanel, editorHolder, editorHandle;
let editor = null;

function getAvailableTools() {
  return {
    paragraph: { class: Paragraph, inlineToolbar: true },
    header: { class: Header, config: { placeholder: 'Enter a header', levels: [2, 3, 4], defaultLevel: 3 } },
    quote: { class: Quote, inlineToolbar: true, shortcut: 'CMD+SHIFT+O', config: { quotePlaceholder: 'Enter a quote', captionPlaceholder: "Quote's author" } },
    list: { class: List, inlineToolbar: true, config: { defaultStyle: 'unordered' } },
    code: { class: CodeTool },
    inlineCode: { class: InlineCode },
    marker: { class: Marker },
    delimiter: { class: Delimiter },
    image: { class: SimpleImage },
    table: { class: Table },
    warning: { class: Warning, inlineToolbar: true },
  };
}

function centerAndShowEditorPanel() {
  // Reset panel size and make it visible to measure it
  editorPanel.style.width = '360px'; // A consistent default width
  editorPanel.style.height = 'auto';
  editorPanel.style.display = 'block';
  
  const panelRect = editorPanel.getBoundingClientRect();
  const containerRect = canvasWrap.getBoundingClientRect();

  const top = (containerRect.height - panelRect.height) / 2;
  const left = (containerRect.width - panelRect.width) / 2;

  editorPanel.style.top = `${Math.max(20, top)}px`; // Ensure it's not off-screen
  editorPanel.style.left = `${Math.max(20, left)}px`;
}

async function createEditor(initialData) {
  if (editor) {
    try {
      await editor.destroy();
    } catch (e) {
      console.error("Error destroying editor:", e);
    }
    editor = null;
  }
  // Clear the holder and ensure it's ready
  editorHolder.innerHTML = '';
  
  // Ensure the holder is visible and has dimensions
  if (editorPanel.style.display === 'none') {
    console.error("Editor holder is not visible");
    return;
  }

  const tools = getAvailableTools();
  const editorConfig = {
    holder: editorHolder,
    tools: tools,
    data: initialData || { blocks: [{ type: 'paragraph', data: { text: '' } }] },
    defaultBlock: 'paragraph',
    minHeight: 30,
    autofocus: true,
    onReady: () => {
        const editorContainer = editorHolder.querySelector('.codex-editor');
        if (editorContainer) {
            editorContainer.classList.add('editor-style');
        }
    },
  };

  try {
    editor = new EditorJS(editorConfig);
    await editor.isReady;
    console.log("Editor initialized successfully");
  } catch (error) {
    console.error("Error creating editor:", error);
    editor = null;
    alert("Failed to initialize editor. Please refresh the page and try again.");
  }
}

export function openEditorForNew() {
  setTextEditorActive(true);
  disableAutoFit();
  
  const viewer = getViewer();
  if (viewer) {
    // We don't need to reset zoom/scroll anymore, as the panel is centered
    viewer.options.useMouseDrag = false;
    viewer.options.useWheelScroll = false;
    viewer.options.usePinch = false;
  }
  destroyManipulation();

  centerAndShowEditorPanel();
  delete editorPanel.dataset.editingG;

  setTimeout(async () => {
    await createEditor(null);
  }, 50);
}

async function openEditorForExisting(g, data) {
    setTextEditorActive(true);
    disableAutoFit();

    const viewer = getViewer();
    if (viewer) {
      viewer.options.useMouseDrag = false;
      viewer.options.useWheelScroll = false;
      viewer.options.usePinch = false;
    }
    destroyManipulation();

    centerAndShowEditorPanel();
    editorPanel.dataset.editingG = g.dataset.foId;

    setTimeout(async () => {
      await createEditor(data);
    }, 50);
}


export async function closeEditor() {
  editorPanel.style.display = 'none';
  if (editor) {
    try {
      await editor.destroy();
    } catch (e) {
      console.error("Error destroying editor on close:", e);
    }
    editor = null;
  }
  
  setTextEditorActive(false);
  delete editorPanel.dataset.editingG;

  const viewer = getViewer();
  if (viewer) {
    viewer.options.useMouseDrag = true;
    viewer.options.useWheelScroll = true;
    viewer.options.usePinch = true;
  }
  
  enableAutoFit();
  
  if (isManipulating()) {
    initializeManipulation(getCurrentSvgElement());
  }
}

async function saveEditorContent() {
  console.log("Attempting to save editor content...");
  if (!editor) {
    alert("Editor is not active.");
    return;
  }

  const svgElement = getCurrentSvgElement();
  if (!svgElement) {
    alert("Cannot save, no SVG is loaded.");
    return;
  }

  try {
    await editor.isReady;
    const saved = await editor.save();
    const html = renderEditorDataToHTML(saved);
    const isEditing = !!editorPanel.dataset.editingG;
    const viewer = getViewer();

    if (isEditing) {
      const id = editorPanel.dataset.editingG;
      const g = svgElement.querySelector(`[data-fo-id="${id}"]`);
      if (!g) {
        console.error("Could not find element to update.");
        await closeEditor();
        return;
      }
      const fo = g.querySelector("foreignObject");
      const rect = g.querySelector("rect");
      const contentDiv = fo.querySelector('.fo-content');
      
      // Set content and data
      contentDiv.innerHTML = html;
      g.dataset.editorData = JSON.stringify(saved);

      // Force a browser reflow to get the correct scrollHeight
      fo.style.height = '1px'; // Temporarily shrink to ensure scrollHeight is recalculated
      void(fo.offsetHeight); // This is the magic line that forces the reflow

      // Measure and apply new height
      const newHeight = contentDiv.scrollHeight;
      fo.style.height = ''; // Clear the temporary style
      fo.setAttribute('height', newHeight);
      rect.setAttribute('height', newHeight);

    } else {
      const panelRect = editorPanel.getBoundingClientRect();
      const svgRect = svgElement.getBoundingClientRect();
      
      const x = (panelRect.left - svgRect.left + viewer.scrollLeft) / viewer.zoom;
      const y = (panelRect.top - svgRect.top + viewer.scrollTop) / viewer.zoom;
      const w = panelRect.width / viewer.zoom;

      // Height is now determined by content, so we don't need the panel height
      insertForeignObject(x, y, w, html, saved);
    }
    
    setLayoutModified(true);
    await closeEditor();
  } catch (error) {
    console.error("Error saving editor data:", error);
    alert("Error saving content. Please check the console for details.");
  }
}

function setupPanelDragging() {
  let draggingEditor = false, edStartX = 0, edStartY = 0, edOrigLeft = 0, edOrigTop = 0;
  editorHandle.addEventListener("pointerdown", (e) => {
    // If the target is the save button, don't start dragging.
    if (e.target.id === 'editor-save-btn') {
      return;
    }
    draggingEditor = true;
    edStartX = e.clientX;
    edStartY = e.clientY;
    edOrigLeft = editorPanel.offsetLeft;
    edOrigTop = editorPanel.offsetTop;
    editorHandle.setPointerCapture(e.pointerId);
  });
  window.addEventListener("pointermove", (e) => {
    if (!draggingEditor) return;
    editorPanel.style.left = edOrigLeft + (e.clientX - edStartX) + "px";
    editorPanel.style.top = edOrigTop + (e.clientY - edStartY) + "px";
  });
  window.addEventListener("pointerup", (e) => {
    if (draggingEditor) {
      draggingEditor = false;
      try {
        editorHandle.releasePointerCapture(e.pointerId);
      } catch (e) {}
    }
  });
}

function insertForeignObject(x, y, w, html, savedData) {
  const svgElement = getCurrentSvgElement();
  if (!svgElement) {
    console.error("Cannot insert foreignObject, no SVG element found.");
    return;
  }

  const id = "fo-" + Date.now();
  const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.setAttribute("transform", `translate(${x},${y})`);
  g.setAttribute("data-fo-id", id);
  g.dataset.editorData = JSON.stringify(savedData);

  // Create the foreignObject first to measure its content
  const fo = document.createElementNS("http://www.w3.org/2000/svg", "foreignObject");
  fo.setAttribute("width", w);
  // Set a temporary height to allow scrollHeight to be calculated correctly
  fo.setAttribute("height", 1); 
  const contentDiv = document.createElementNS('http://www.w3.org/1999/xhtml', 'div');
  contentDiv.className = 'fo-content';
  contentDiv.innerHTML = html;
  fo.appendChild(contentDiv);
  
  // Add to DOM temporarily to measure
  svgElement.appendChild(g);
  g.appendChild(fo);

  // Now measure the actual content height
  const h = contentDiv.scrollHeight;

  // Apply the measured height
  fo.setAttribute("height", h);

  // Create the background rect with the correct dimensions
  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("width", w);
  bg.setAttribute("height", h);
  bg.setAttribute("rx", 6);
  bg.setAttribute("fill", "transparent");
  bg.setAttribute("stroke", "transparent");
  
  // Insert background rect before the foreignObject
  g.insertBefore(bg, fo);

  addBehaviorsToForeignObject(g);
}

function addBehaviorsToForeignObject(g) {
  // Standard click for selection, gives us better control over propagation
  g.addEventListener('click', (event) => {
    if (isTextEditorActive()) return;

    const isSelected = g.classList.contains('fo-selected');
    
    // Deselect all other elements first
    document.querySelectorAll('[data-fo-id].fo-selected').forEach(el => {
      if (el !== g) el.classList.remove('fo-selected');
    });

    // Toggle selection for the current element
    g.classList.toggle('fo-selected');

    // This is the crucial part to stop the event from reaching the canvasWrap listener
    event.stopPropagation(); 
  });

  interact(g)
    .draggable({
      listeners: {
        start(event) {
          if (isTextEditorActive()) return;
          if (!g.classList.contains('fo-selected')) {
            document.querySelectorAll('[data-fo-id].fo-selected').forEach(el => el.classList.remove('fo-selected'));
            g.classList.add("fo-selected");
          }
        },
        move(event) {
          if (isTextEditorActive()) return;
          const target = event.target;
          const viewer = getViewer();
          if (!viewer) return;

          const dx = event.dx / viewer.zoom;
          const dy = event.dy / viewer.zoom;

          const currentTransform = target.transform.baseVal.consolidate().matrix;
          const newX = currentTransform.e + dx;
          const newY = currentTransform.f + dy;

          target.setAttribute('transform', `translate(${newX}, ${newY})`);
          setLayoutModified(true);
        },
      },
      modifiers: [
        interact.modifiers.restrictRect({
          restriction: 'parent',
          endOnly: true
        })
      ]
    })
    .resizable({
      // Only allow resizing from left and right edges
      edges: { left: true, right: true, bottom: false, top: false },
      listeners: {
        move(event) {
          if (isTextEditorActive()) return;
          const target = event.target;
          const viewer = getViewer();
          if (!viewer) return;

          const rect = target.querySelector('rect');
          const fo = target.querySelector('foreignObject');
          const contentDiv = fo.querySelector('.fo-content');

          const currentTransform = target.transform.baseVal.consolidate().matrix;
          let currentX = currentTransform.e;
          let currentY = currentTransform.f;

          // Get new width from the event
          const newWidth = event.rect.width / viewer.zoom;

          // Apply the new width
          rect.setAttribute('width', newWidth);
          fo.setAttribute('width', newWidth);

          // --- Start of the fix ---
          // Force a browser reflow to get the correct scrollHeight
          fo.style.height = '1px'; // Temporarily shrink to ensure scrollHeight is recalculated
          void(fo.offsetHeight); // This is the magic line that forces the reflow

          // Measure and apply new height
          const newHeight = contentDiv.scrollHeight;
          fo.style.height = ''; // Clear the temporary style
          // --- End of the fix ---

          rect.setAttribute('height', newHeight);
          fo.setAttribute('height', newHeight);
          
          // Adjust translation for resizing from the left edge
          currentX += event.deltaRect.left / viewer.zoom;

          target.setAttribute('transform', `translate(${currentX}, ${currentY})`);
          setLayoutModified(true);
        }
      },
      modifiers: [
        interact.modifiers.restrictEdges({
          outer: 'parent'
        }),
        interact.modifiers.restrictSize({
          min: { width: 100 } // Only restrict width now
        })
      ],
      inertia: false
    });

  g.addEventListener("dblclick", async (event) => {
    event.stopPropagation();
    if (isTextEditorActive()) return;
    const data = JSON.parse(g.dataset.editorData || "{}");
    await openEditorForExisting(g, data);
  });
}

function sanitize(str) {
  if (!str) return "";
  const temp = document.createElement('div');
  temp.textContent = str;
  return temp.innerHTML;
}

function renderEditorDataToHTML(data) {
  if (!data || !data.blocks) return "";
  return data.blocks.map((block) => {
    switch (block.type) {
      case "paragraph":
        return `<p>${block.data.text}</p>`; // HTML content from Editor.js
      case "header":
        return `<h${block.data.level}>${block.data.text}</h${block.data.level}>`; // HTML content
      case "quote":
        const caption = block.data.caption ? `<cite>${sanitize(block.data.caption)}</cite>` : ""; // Caption is plain text
        return `<blockquote>${block.data.text}${caption}</blockquote>`; // Text is HTML
      case "list": {
        const listStyle = block.data.style || 'unordered';
        const tag = listStyle === 'ordered' ? 'ol' : 'ul';

        const renderItems = (items) => {
          return items.map(item => {
            // Handle potential nested structure where item is an object
            if (typeof item === 'object' && item !== null && item.content) {
              const nestedList = (item.items && item.items.length > 0)
                ? `<${tag}>${renderItems(item.items)}</${tag}>`
                : '';
              return `<li>${item.content}${nestedList}</li>`;
            }
            // Handle simple string item (which can contain HTML for inline tools)
            return `<li>${item}</li>`;
          }).join('');
        };

        return `<${tag}>${renderItems(block.data.items)}</${tag}>`;
      }
      case "table":
        // Table content is plain text
        const headRows = (block.data.withHeadings && block.data.content.length > 0) 
          ? `<thead><tr>${block.data.content[0].map(c => `<th>${sanitize(c)}</th>`).join('')}</tr></thead>` 
          : '';
        const bodyRows = (block.data.withHeadings ? block.data.content.slice(1) : block.data.content || [])
          .map(r => `<tr>${r.map(c => `<td>${sanitize(c)}</td>`).join('')}</tr>`)
          .join('');
        return `<table>${headRows}<tbody>${bodyRows}</tbody></table>`;
      case "code":
        return `<pre><code>${sanitize(block.data.code)}</code></pre>`; // Code is plain text
      case "warning":
        const title = block.data.title ? `<strong>${sanitize(block.data.title)}</strong><br>` : ''; // Title is plain text
        return `<div class="admonition warning">${title}${block.data.message}</div>`; // Message is HTML
      case "delimiter":
        return `<hr>`;
      case "image":
        const imgCaption = block.data.caption ? `<figcaption>${sanitize(block.data.caption)}</figcaption>` : ''; // Caption is plain text
        return `<figure><img src="${block.data.url}" alt="${sanitize(block.data.caption || 'Image')}">${imgCaption}</figure>`;
      default:
        const text = block.data.text || '';
        return `<p>${text}</p>`; // Default to assuming HTML content
    }
  }).join("");
}

export function initializeTextEditor() {
  svg = document.getElementById('svg-viewer-content');
  canvasWrap = document.getElementById('viewer-container');
  toggleEditorBtn = document.getElementById('text-editor-toggle-btn');
  saveBtn = document.getElementById('editor-save-btn');
  editorPanel = document.getElementById('editor-panel');
  editorHolder = document.getElementById('editor-holder');
  editorHandle = document.getElementById('editor-handle');

  if (!toggleEditorBtn || !saveBtn || !editorPanel) {
      console.error("Text editor UI elements not found. Aborting initialization.");
      return;
  }

  toggleEditorBtn.addEventListener('click', openEditorForNew);
  saveBtn.addEventListener('click', saveEditorContent);
  
  setupPanelDragging();

  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isTextEditorActive()) {
      closeEditor();
    }
  });

  // Smarter "click outside" to deselect all text blocks
  canvasWrap.addEventListener('click', (event) => {
    // If the click is on a text block itself, do nothing.
    if (event.target.closest('[data-fo-id]')) {
      return;
    }
    // Otherwise, deselect all.
    document.querySelectorAll('[data-fo-id].fo-selected').forEach(el => {
      el.classList.remove('fo-selected');
    });
  }, true); // Use capture phase to ensure this runs before other click listeners

  // Listen for the custom event dispatched by svgLoader
  window.addEventListener('svg-loaded', (event) => {
    const svgElement = event.detail.svgElement;
    if (svgElement) {
      const foreignObjectGroups = svgElement.querySelectorAll('g[data-fo-id]');
      foreignObjectGroups.forEach(g => {
        addBehaviorsToForeignObject(g);
      });
    }
  });

  console.log('🖋️ Text Editor Initialized');
}
