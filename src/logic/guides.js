// src/logic/guides.js

import Guides from '@scena/guides';
import InfiniteViewer from 'infinite-viewer';
import { setViewer, getViewer, getSvgGuidePositions, setSvgGuidePositions } from '../state';

let horizontalGuides;
let verticalGuides;

// --- START: NEW ---
// A dedicated ResizeObserver for the guides to ensure they always redraw correctly.
let guidesResizeObserver = null;
// --- END: NEW ---

// --- No changes to onResize ---
function onResize() {
    if (horizontalGuides) {
        horizontalGuides.resize();
    }
    if (verticalGuides) {
        verticalGuides.resize();
    }
}

function recreateViewer(options = {}) {
  return new Promise((resolve) => {
    const viewerElement = document.getElementById("svg-wrapper");
    const viewportElement = document.getElementById("viewport");
    const horizontalRuler = document.getElementById("h-guides");
    const verticalRuler = document.getElementById("v-guides");

    // Clear previous rulers content
    if (horizontalRuler) horizontalRuler.innerHTML = "";
    if (verticalRuler) verticalRuler.innerHTML = "";

    // Clean up previous instances
    let oldViewer = getViewer();
    if (oldViewer) oldViewer.destroy();
    if (horizontalGuides) horizontalGuides.destroy();
    if (verticalGuides) verticalGuides.destroy();

    // --- START: MODIFIED CLEANUP ---
    // Disconnect the old observer if it exists to prevent memory leaks.
    if (guidesResizeObserver) {
      guidesResizeObserver.disconnect();
      guidesResizeObserver = null;
    }
    // Remove the old, less reliable window event listener.
    window.removeEventListener("resize", onResize);
    // --- END: MODIFIED CLEANUP --
    
    const initialGuides = getSvgGuidePositions();

    const viewer = new InfiniteViewer(viewerElement, viewportElement, {
      useWheelScroll: true,
      useWheelPinch: true,
      wheelPinchKey: "ctrl",
      usePinch: true,
      useAutoZoom: true,
      // maxPinchWheel: 10,
      zoomRange: [0.4,  228],
      displayHorizontalScroll: false,
      displayVerticalScroll: false,
      rangeX: [-Infinity, Infinity],
      rangeY: [-Infinity, Infinity],
      margin: 100,
      threshold: 100,
      ...options, // Spread the options, allowing useMouseDrag to be overridden
    });

    // requestAnimationFrame(() => {
    //     viewer.scrollCenter();
    // });

    // Initialize Horizontal Guides
    horizontalGuides = new Guides(horizontalRuler, {
      type: "horizontal",
      longLineSize: 7,
      shortLineSize: 4,
      textOffset: [0, 9],
      unit: 50,
      negativeRuler: true,
      displayDragPos: true,
      dragPosFormat: v => `${v.toFixed(0)} px`,
      backgroundColor: "#f0f0f0",
      lineColor: "#cccccc",
      textColor: "#6B7283",
    });

    // Initialize Vertical Guides
    verticalGuides = new Guides(verticalRuler, {
      type: "vertical",
      longLineSize: 7,
      shortLineSize: 4,
      textOffset: [9, 0],
      unit: 50,
      negativeRuler: true,
      displayDragPos: true,
      dragPosFormat: v => `${v.toFixed(0)} px`,
      backgroundColor: "#f0f0f0",
      lineColor: "#cccccc",
      textColor: "#6B7283",
    });

    // Synchronize guides when viewer scrolls
    viewer.on("scroll", ({ scrollLeft, scrollTop }) => {
      horizontalGuides.scroll(scrollLeft);
      verticalGuides.scroll(scrollTop);
      horizontalGuides.scrollGuides(scrollTop);
      verticalGuides.scrollGuides(scrollLeft);
    });

    // Synchronize guides when viewer zoom changes
    viewer.on("pinch", ({ zoom }) => {
      horizontalGuides.zoom = zoom;
      verticalGuides.zoom = zoom;
    });

    viewer.on("zoom", ({ zoom }) => {
      horizontalGuides.zoom = zoom;
      verticalGuides.zoom = zoom;
    });

    setViewer(viewer);
    // --- START: THIS IS THE FIX ---
    // Instead of a window event, we now observe the viewer's container element directly.
    // This is much more reliable and will catch all resize events, including dev tools.
    guidesResizeObserver = new ResizeObserver(() => {
      // When the container resizes, we call our existing onResize function.
      onResize();
    });
    guidesResizeObserver.observe(viewerElement);
    // --- END: THIS IS THE FIX ---
    
    resolve(viewer);
  });
}

async function setupViewerAndGuides() {
  // Initial creation with default settings (mouse drag enabled)
  await recreateViewer({ useMouseDrag: true });
}

export { setupViewerAndGuides, recreateViewer };
