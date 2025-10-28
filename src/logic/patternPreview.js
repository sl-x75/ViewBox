// src/logic/patternPreview.js

import { getPatternDefs } from '../state.js';

const patternPreviewCache = new Map();

/**
 * Creates a self-contained, styled HTML string for a pattern using the LIVE CSS
 * from the main viewer's <style> tag. This is the most accurate way to generate a snapshot.
 * @param {string} patternId The ID of the pattern to process.
 * @returns {string|null} The self-contained HTML string, or null if an error occurs.
 */
function generateStyledPatternHTML(patternId) {
    const patternDefs = getPatternDefs();
    const originalHTML = patternDefs[patternId];
    const mainSvg = document.querySelector('#svg-viewer-content svg');
    const liveStyleTag = mainSvg ? mainSvg.querySelector('style:not([id])') : null;
    const liveCssContent = liveStyleTag ? liveStyleTag.textContent : '';

    if (!originalHTML) return null;

    try {
        const tempContainer = document.createElement('div');
        tempContainer.style.visibility = 'hidden';
        tempContainer.style.position = 'absolute';
        const tempSvgString = `<svg id="temp-preview-svg" xmlns="http://www.w3.org/2000/svg"><defs><style>${liveCssContent}</style>${originalHTML}</defs></svg>`;
        tempContainer.innerHTML = tempSvgString;
        document.body.appendChild(tempContainer);
        
        const patternElement = tempContainer.querySelector(`#${patternId}`);
        if (!patternElement) {
            document.body.removeChild(tempContainer);
            return originalHTML;
        }

        const shapeTypes = ['path', 'line', 'rect', 'circle'];
        for (const shapeType of shapeTypes) {
            const elements = patternElement.querySelectorAll(shapeType);
            elements.forEach(el => {
                const computedStyle = window.getComputedStyle(el);
                const styleProps = ['fill', 'stroke', 'stroke-width', 'fill-opacity', 'stroke-opacity'];
                let inlineStyle = '';
                for (const prop of styleProps) {
                    const value = computedStyle.getPropertyValue(prop);
                    if (value) inlineStyle += `${prop}: ${value}; `;
                }
                const existingStyle = el.getAttribute('style') || '';
                el.setAttribute('style', `${inlineStyle}${existingStyle}`);
            });
        }
        
        const finalHTML = patternElement.outerHTML;
        document.body.removeChild(tempContainer);
        return finalHTML;
    } catch (error) {
        console.error("Error generating styled pattern HTML:", error);
        return originalHTML;
    }
}

/**
 * Ensures the preview SVG has a <defs> element.
 * @param {SVGSVGElement} svg - The preview SVG.
 * @returns {SVGDefsElement} The defs element.
 */
function ensureDefs(svg) {
    let defs = svg.querySelector('defs');
    if (!defs) {
        defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        svg.insertBefore(defs, svg.firstChild);
    }
    return defs;
}

/**
 * Generates a unique preview ID to prevent collisions.
 * @param {string} originalId - The real pattern ID.
 * @returns {string} A modified ID for the preview.
 */
function makePreviewId(originalId) {
  return `${originalId}-preview`;
}

/**
 * Retrieves cached preview markup or generates it if missing.
 * @param {string} originalId - The real pattern ID.
 * @returns {{ html: string, previewId: string }|null}
 */
function getOrGeneratePreviewMarkup(originalId) {
    if (patternPreviewCache.has(originalId)) {
        return { html: patternPreviewCache.get(originalId), previewId: makePreviewId(originalId) };
    }
    const styledHTML = generateStyledPatternHTML(originalId);
    if (!styledHTML) return null;
    const previewId = makePreviewId(originalId);
    const idRegex = new RegExp(`id=(["'])${originalId}\\1`);
    const finalHTML = styledHTML.replace(idRegex, `id=$1${previewId}$1`);
    patternPreviewCache.set(originalId, finalHTML);
    return { html: finalHTML, previewId };
}

/**
 * Renders the preview inside the target SVG.
 * @param {SVGSVGElement} svg - The preview SVG.
 * @param {string|null} patternId - The real pattern ID, or null to clear.
 */
function renderPatternPreview(svg, patternId) {
    const rect = svg.querySelector('rect');
    const defs = ensureDefs(svg);
    if (!patternId) {
        rect.setAttribute('fill', 'transparent');
        defs.innerHTML = '';
        return;
    }
    const markup = getOrGeneratePreviewMarkup(patternId);
    if (!markup) {
        rect.setAttribute('fill', 'transparent');
        defs.innerHTML = '';
        return;
    }
    defs.innerHTML = markup.html;
    rect.setAttribute('fill', `url(#${markup.previewId})`);
}

/**
 * Public API: Updates the pattern preview SVG.
 * @param {string|null} selectedPatternUrl - A "url(#...)" string or null to clear.
 */
export function updatePatternPreview(selectedPatternUrl) {
    const patternPreview = document.getElementById('pattern-preview');
    const patternId = extractPatternId(selectedPatternUrl);
    renderPatternPreview(patternPreview, patternId);
}

// Helper function, as extractPatternId is also needed here.
function extractPatternId(url) {
    if (!url) return null;
    const match = url.match(/url\(#([\w-]+)\)/);
    return match ? match[1] : null;
}
