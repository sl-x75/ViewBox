import interact from 'interactjs';
import { getIsLayoutFile, getCurrentSvgElement, setManipulationEnabled, setLayoutModified, getViewer } from './state.js';
import { recreateViewer } from './logic/guides.js';

window.interact = interact;

let svgElement = null;
let contexts = [];
let manipulationEnabled = true; // Default enabled


// Compute bounding box based on the original drawing data from the SVG
function computeGroupBBox(group) {
  // First, try to get data from data attributes or look for the original images
  const dataId = group.getAttribute('data-id');
  const drawing = group.getAttribute('data-drawing');
  
  console.log(`Computing bbox for group ${group.getAttribute('id')}: data-id=${dataId}, data-drawing=${drawing}`);
  
  // Look for all child elements (not just images, since they may have been processed)
  const allChildren = Array.from(group.children).filter(child => 
    !child.classList.contains('drag-handle') && 
    !child.classList.contains('bounding-box')
  );
  
  console.log(`Found ${allChildren.length} children:`, allChildren.map(child => ({
    tag: child.tagName,
    class: child.getAttribute('class'),
    id: child.getAttribute('id'),
    'data-type': child.getAttribute('data-type')
  })));
  
  if (allChildren.length === 0) {
    console.warn(`No children found in group ${group.getAttribute('id')}, using fallback dimensions`);
    return { x: 0, y: 0, width: 100, height: 100 };
  }
  
  // Try to get the bounding box of the entire group using SVG's getBBox
  try {
    // Temporarily remove transform to get the actual content bounds
    const originalTransform = group.getAttribute('transform');
    group.removeAttribute('transform');
    
    const bbox = group.getBBox();
    
    // Restore transform
    if (originalTransform) {
      group.setAttribute('transform', originalTransform);
    }
    
    console.log(`Group getBBox result:`, bbox);
    
    // Add some padding around the content
    const padding = 10;
    const result = {
      x: bbox.x - padding,
      y: bbox.y - padding,
      width: bbox.width + (padding * 2),
      height: bbox.height + (padding * 2)
    };
    
    console.log(`Final computed bbox:`, result);
    return result;
    
  } catch (e) {
    console.error(`Failed to get bbox for group ${group.getAttribute('id')}:`, e);
    
    // Fallback: try to compute bounds from all children
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let foundValidBounds = false;
    
    allChildren.forEach((child, index) => {
      try {
        const childBBox = child.getBBox();
        minX = Math.min(minX, childBBox.x);
        minY = Math.min(minY, childBBox.y);
        maxX = Math.max(maxX, childBBox.x + childBBox.width);
        maxY = Math.max(maxY, childBBox.y + childBBox.height);
        foundValidBounds = true;
        console.log(`Child ${index} bbox:`, childBBox);
      } catch (childError) {
        console.warn(`Could not get bbox for child ${index}:`, childError);
      }
    });
    
    if (foundValidBounds) {
      const padding = 10;
      return {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + (padding * 2),
        height: (maxY - minY) + (padding * 2)
      };
    }
    
    // Ultimate fallback
    return { x: 0, y: 0, width: 200, height: 200 };
  }
}

// Create transparent drag handle that covers the entire group
function ensureDragHandle(group) {
  const bbox = computeGroupBBox(group);
  let handle = group.querySelector('rect.drag-handle');
  
  if (!handle) {
    handle = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    handle.setAttribute('class', 'drag-handle');
    handle.setAttribute('fill', 'transparent');
    handle.setAttribute('stroke', 'none');
    handle.setAttribute('pointer-events', 'all');
    handle.style.cursor = 'move';
    // Insert as first child so it's behind content but still catches events
    group.insertBefore(handle, group.firstChild);
  }
  
  handle.setAttribute('x', bbox.x);
  handle.setAttribute('y', bbox.y);
  handle.setAttribute('width', bbox.width);
  handle.setAttribute('height', bbox.height);
  
  console.log(`Created drag handle for group:`, {
    x: bbox.x, y: bbox.y, 
    width: bbox.width, height: bbox.height
  });
  
  return handle;
}

// Get center point of a group's bounding box in screen coordinates
function getGroupCenter(group, svg) {
  const bbox = computeGroupBBox(group);
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  
  // Apply the group's current transform to get the actual center position
  const transform = group.getAttribute('transform') || '';
  const state = parseTransform(transform);
  
  return {
    x: centerX + state.dx,
    y: centerY + state.dy
  };
}

// Create or update bounding box for a drawing group
function drawBoundingBox(group, svg) {
  const bbox = computeGroupBBox(group);
  const id = group.getAttribute('id');
  
  // Remove any existing bounding box for this group to prevent duplicates
  svg.querySelectorAll(`rect.bounding-box[data-for="${id}"]`).forEach(el => el.remove());
  
  // Create new bounding box
  const box = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  box.setAttribute('class', 'bounding-box');
  box.setAttribute('stroke', '#007acc');
  box.setAttribute('stroke-width', '1');
  box.setAttribute('fill', 'rgba(0, 122, 204, 0.1)'); // Light blue fill for better visibility
  box.setAttribute('stroke-dasharray', '3,2');
  box.setAttribute('data-for', id);
  box.setAttribute('pointer-events', 'none');
  
  // Apply the same transform as the group to keep the box aligned
  const groupTransform = group.getAttribute('transform') || '';
  box.setAttribute('transform', groupTransform);
  
  // Set bounding box position and size based on the computed bbox
  box.setAttribute('x', bbox.x);
  box.setAttribute('y', bbox.y);
  box.setAttribute('width', bbox.width);
  box.setAttribute('height', bbox.height);
  
  // Insert the bounding box right after the group in the DOM
  if (group.nextSibling) {
    group.parentNode.insertBefore(box, group.nextSibling);
  } else {
    group.parentNode.appendChild(box);
  }
  
  console.log(`Created bounding box for ${id}:`, {
    x: bbox.x, y: bbox.y, 
    width: bbox.width, height: bbox.height,
    transform: groupTransform
  });
}

// Create rotation handle only
function createControlHandles(group, bbox, svg) {
  const id = group.getAttribute('id');
  const handleSize = 0;
  const rotateHandleDistance = 0;
  
  // Remove existing handles
  svg.querySelectorAll(`[data-handle-for="${id}"]`).forEach(el => el.remove());
  
  const handles = [];
  
  // Rotation handle (top center with extended line)
  const rotateX = bbox.x + bbox.width / 2;
  const rotateY = bbox.y - rotateHandleDistance;
  
  // Rotation line
  const rotateLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  rotateLine.setAttribute('class', 'control-handle rotate-line');
  rotateLine.setAttribute('data-handle-for', id);
  rotateLine.setAttribute('x1', bbox.x + bbox.width / 2);
  rotateLine.setAttribute('y1', bbox.y);
  rotateLine.setAttribute('x2', rotateX);
  rotateLine.setAttribute('y2', rotateY);
  rotateLine.setAttribute('stroke', '#007acc');
  rotateLine.setAttribute('stroke-width', '0');
  rotateLine.setAttribute('pointer-events', 'none');
  
  const groupTransform = group.getAttribute('transform') || '';
  rotateLine.setAttribute('transform', groupTransform);
  handles.push(rotateLine);
  svg.appendChild(rotateLine);
  
  // Rotation handle
  const rotateHandle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
  rotateHandle.setAttribute('class', 'control-handle rotate-handle');
  rotateHandle.setAttribute('data-handle-for', id);
  rotateHandle.setAttribute('data-handle-type', 'rotate');
  rotateHandle.setAttribute('cx', rotateX);
  rotateHandle.setAttribute('cy', rotateY);
  rotateHandle.setAttribute('r', handleSize / 2);
  rotateHandle.setAttribute('fill', '#ff6b35');
  rotateHandle.setAttribute('stroke', '#ffffff');
  rotateHandle.setAttribute('stroke-width', '2');
  rotateHandle.style.cursor = 'crosshair';
  rotateHandle.setAttribute('pointer-events', 'all');
  rotateHandle.setAttribute('transform', groupTransform);
  
  handles.push(rotateHandle);
  svg.appendChild(rotateHandle);
  
  return handles;
}

// Parse transform to extract translation and rotation values
function parseTransform(transformStr) {
  let dx = 0, dy = 0, rotation = 0;
  
  if (!transformStr) return { dx, dy, rotation };
  
  // Parse translate
  const translateMatch = transformStr.match(/translate\s*\(\s*([^,\s]+)(?:\s*,\s*([^)]+))?\s*\)/);
  if (translateMatch) {
    dx = parseFloat(translateMatch[1]) || 0;
    dy = parseFloat(translateMatch[2]) || 0;
  }
  
  // Parse rotate (with optional center point)
  const rotateMatch = transformStr.match(/rotate\s*\(\s*([^,\s)]+)(?:\s*,\s*([^,\s)]+)\s*,\s*([^)]+))?\s*\)/);
  if (rotateMatch) {
    rotation = parseFloat(rotateMatch[1]) || 0;
  }
  
  return { dx, dy, rotation };
}

// Apply combined transform (translate and rotate around center)
function updateTransform(group, { dx, dy, rotation }) {
  const transforms = [];
  
  if (dx !== 0 || dy !== 0) {
    transforms.push(`translate(${dx}, ${dy})`);
  }
  
  if (rotation !== 0) {
    // Get the center of the group's content for rotation
    const bbox = computeGroupBBox(group);
    const centerX = bbox.x + bbox.width / 2;
    const centerY = bbox.y + bbox.height / 2;
    transforms.push(`rotate(${rotation}, ${centerX}, ${centerY})`);
  }
  
  group.setAttribute('transform', transforms.join(' '));
}

// Disable pointer events on all child elements (since images may be processed into other elements)
function disableChildPointerEvents(group) {
  // Disable pointer events on ALL child elements except drag handles
  const allChildren = group.querySelectorAll('*:not(.drag-handle)');
  allChildren.forEach(child => {
    child.setAttribute('pointer-events', 'none');
  });
}

// Snap angle to common angles (0, 45, 90, 135, 180, etc.) when shift is held
function snapAngle(angle, snapEnabled = false) {
  if (!snapEnabled) return angle;
  
  const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315];
  const tolerance = 10; // degrees
  
  for (const snapAngle of snapAngles) {
    if (Math.abs(angle - snapAngle) <= tolerance) {
      return snapAngle;
    }
  }
  
  // Also check for negative equivalents
  const normalizedAngle = ((angle % 360) + 360) % 360;
  for (const snapAngle of snapAngles) {
    if (Math.abs(normalizedAngle - snapAngle) <= tolerance) {
      return snapAngle;
    }
  }
  
  return angle;
}

// Setup rotation interaction for a specific handle
function setupRotationInteraction(rotateHandle, group, svg) {
  const id = group.getAttribute('id');
  
  interact(rotateHandle).draggable({
    listeners: {
      start(event) {
        const ctx = contexts.find(c => c.group === group);
        if (!ctx) return;
        
        // Get the center of the drawing content (not transformed center)
        const bbox = computeGroupBBox(group);
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        
        // Apply current translation to get actual center position
        const actualCenterX = centerX + ctx.state.dx;
        const actualCenterY = centerY + ctx.state.dy;
        
        // Convert SVG coordinates to screen coordinates
        const rect = svg.getBoundingClientRect();
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = actualCenterX;
        svgPoint.y = actualCenterY;
        const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
        
        // Calculate initial angle from center to mouse
        ctx.initialAngle = Math.atan2(
          event.clientY - screenPoint.y,
          event.clientX - screenPoint.x
        ) * 180 / Math.PI;
        ctx.initialRotation = ctx.state.rotation;
        
        // Visual feedback for rotation mode
        const box = svg.querySelector(`rect.bounding-box[data-for="${id}"]`);
        if (box) {
          box.setAttribute('stroke', '#ff6b35');
          box.setAttribute('stroke-width', '3');
        }
      },
      move(event) {
        const ctx = contexts.find(c => c.group === group);
        if (!ctx) return;
        
        // Get the center of the drawing content
        const bbox = computeGroupBBox(group);
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        
        // Apply current translation to get actual center position
        const actualCenterX = centerX + ctx.state.dx;
        const actualCenterY = centerY + ctx.state.dy;
        
        // Convert SVG coordinates to screen coordinates
        const svgPoint = svg.createSVGPoint();
        svgPoint.x = actualCenterX;
        svgPoint.y = actualCenterY;
        const screenPoint = svgPoint.matrixTransform(svg.getScreenCTM());
        
        // Calculate current angle from center to mouse
        const currentAngle = Math.atan2(
          event.clientY - screenPoint.y,
          event.clientX - screenPoint.x
        ) * 180 / Math.PI;
        
        let deltaAngle = currentAngle - ctx.initialAngle;
        let newRotation = ctx.initialRotation + deltaAngle;
        
        // Apply snapping if Shift key is held
        setLayoutModified(true);
        if (event.shiftKey) {
          newRotation = snapAngle(newRotation, true);
        }
        
        ctx.state.rotation = newRotation;
        
        // Update the group transform
        updateTransform(group, ctx.state);
        
        // Update visual elements WITHOUT recreating interaction handlers
        updateVisualElements(group, svg);
      },
      end(event) {
        // Remove active styling
        const box = svg.querySelector(`rect.bounding-box[data-for="${id}"]`);
        if (box) {
          box.setAttribute('stroke', '#007acc');
          box.setAttribute('stroke-width', '2');
        }
      }
    }
  });
}

// Update visual elements (bounding box and handles) without recreating interactions
function updateVisualElements(group, svg) {
  const id = group.getAttribute('id');
  const bbox = computeGroupBBox(group);
  const groupTransform = group.getAttribute('transform') || '';
  
  // Update bounding box
  const existingBox = svg.querySelector(`rect.bounding-box[data-for="${id}"]`);
  if (existingBox) {
    existingBox.setAttribute('transform', groupTransform);
    existingBox.setAttribute('x', bbox.x);
    existingBox.setAttribute('y', bbox.y);
    existingBox.setAttribute('width', bbox.width);
    existingBox.setAttribute('height', bbox.height);
  }
  
  // Update control handles positions and transforms
  const rotateHandleDistance = 30;
  const rotateX = bbox.x + bbox.width / 2;
  const rotateY = bbox.y - rotateHandleDistance;
  
  // Update rotation line
  const rotateLine = svg.querySelector(`line.rotate-line[data-handle-for="${id}"]`);
  if (rotateLine) {
    rotateLine.setAttribute('transform', groupTransform);
    rotateLine.setAttribute('x1', bbox.x + bbox.width / 2);
    rotateLine.setAttribute('y1', bbox.y);
    rotateLine.setAttribute('x2', rotateX);
    rotateLine.setAttribute('y2', rotateY);
  }
  
  // Update rotation handle
  const rotateHandle = svg.querySelector(`circle.rotate-handle[data-handle-for="${id}"]`);
  if (rotateHandle) {
    rotateHandle.setAttribute('transform', groupTransform);
    rotateHandle.setAttribute('cx', rotateX);
    rotateHandle.setAttribute('cy', rotateY);
  }
}

export async function initializeManipulation(svg) {
  svgElement = svg;
  if (!manipulationEnabled) {
    return; // Exit early if manipulation is disabled
  }

  // --- Start of new logic ---
  const oldViewer = getViewer();
  let zoom, scrollLeft, scrollTop;

  if (oldViewer) {
    zoom = oldViewer.getZoom();
    scrollLeft = oldViewer.getScrollLeft();
    scrollTop = oldViewer.getScrollTop();
  }

  // Recreate viewer with mouse drag disabled
  const newViewer = await recreateViewer({ useMouseDrag: false });

  if (newViewer && zoom !== undefined) {
    newViewer.zoom = zoom;
    newViewer.scrollTo(scrollLeft, scrollTop);
  }
  // --- End of new logic ---

  contexts = [];

  // Clear any existing bounding boxes and drag handles
  svg.querySelectorAll('rect.bounding-box, rect.drag-handle').forEach(el => el.remove());

  // Only select direct child groups with data-type="drawing" from the SVG root
  const drawingGroups = Array.from(svg.children).filter(child => 
    child.tagName === 'g' && 
    child.getAttribute('data-type') === 'drawing'
  );
  
  console.log(`Found ${drawingGroups.length} drawing groups`);

  // Wait a frame to ensure all content is rendered
  requestAnimationFrame(() => {
    drawingGroups.forEach(group => {
      let id = group.getAttribute('id');
      if (!id) {
        id = `drawing-${Math.random().toString(36).substr(2, 9)}`;
        group.setAttribute('id', id);
      }

      // Parse existing transform
      const currentTransform = group.getAttribute('transform') || '';
      const state = parseTransform(currentTransform);
      
      // Store context
      contexts.push({ group, state });

      // Disable pointer events on child images so they don't interfere with dragging
      disableChildPointerEvents(group);

      // Create drag handle
      const handle = ensureDragHandle(group);
      
      // Draw bounding box
      drawBoundingBox(group, svg);
      
      // Create rotation handle
      createControlHandles(group, computeGroupBBox(group), svg);

      // Make the main drag handle draggable
      interact(handle).draggable({
        listeners: {
          start(event) {
            // Add active class for visual feedback
            const box = svg.querySelector(`rect.bounding-box[data-for="${id}"]`);
            if (box) {
              box.setAttribute('stroke', '#ff6b35');
              box.setAttribute('stroke-width', '3');
            }
          },
          move(event) {
            const ctx = contexts.find(c => c.group === group);
            if (!ctx) return;

            const viewer = getViewer();
            if (!viewer) return;
            
            // Update position
            setLayoutModified(true);
            ctx.state.dx += event.dx / viewer.zoom;
            ctx.state.dy += event.dy / viewer.zoom;
            
            // Apply transform to group
            updateTransform(group, ctx.state);
            
            // Update visual elements without recreating interactions
            updateVisualElements(group, svg);
          },
          end(event) {
            // Remove active styling
            const box = svg.querySelector(`rect.bounding-box[data-for="${id}"]`);
            if (box) {
              box.setAttribute('stroke', '#007acc');
              box.setAttribute('stroke-width', '2');
            }
          }
        }
      });

      // Setup rotation handle interaction
      const rotateHandle = svg.querySelector(`circle.rotate-handle[data-handle-for="${id}"]`);
      if (rotateHandle) {
        setupRotationInteraction(rotateHandle, group, svg);
      }
    });
    
    console.log('🟢 Manipulation mode enabled for', drawingGroups.length, 'drawing groups');
  });
}

export async function destroyManipulation() {
  // --- Start of new logic ---
  const oldViewer = getViewer();
  let zoom, scrollLeft, scrollTop;

  if (oldViewer) {
    zoom = oldViewer.getZoom();
    scrollLeft = oldViewer.getScrollLeft();
    scrollTop = oldViewer.getScrollTop();
  }

  // Recreate viewer with mouse drag enabled
  const newViewer = await recreateViewer({ useMouseDrag: true });

  if (newViewer && zoom !== undefined) {
    newViewer.zoom = zoom;
    newViewer.scrollTo(scrollLeft, scrollTop);
  }
  // --- End of new logic ---

  if (!svgElement) return;

  // Clean up interact.js instances
  contexts.forEach(ctx => {
    const handle = ctx.group.querySelector('rect.drag-handle');
    if (handle) {
      interact(handle).unset();
    }
    
    // Clean up control handles (only rotation handles now)
    const id = ctx.group.getAttribute('id');
    const controlHandles = svgElement.querySelectorAll(`[data-handle-for="${id}"]`);
    controlHandles.forEach(controlHandle => {
      if (controlHandle.classList.contains('rotate-handle')) {
        interact(controlHandle).unset();
      }
    });
    
    // Re-enable pointer events on all child elements
    const allChildren = ctx.group.querySelectorAll('*:not(.drag-handle)');
    allChildren.forEach(child => {
      child.removeAttribute('pointer-events');
    });
  });

  // Remove all bounding boxes, drag handles, and control handles
  svgElement.querySelectorAll('rect.bounding-box, rect.drag-handle, .control-handle').forEach(el => el.remove());
  
  // Clear contexts
  contexts = [];
  svgElement = null;

  console.log('🔴 Manipulation mode disabled');
}

export async function toggleManipulation(enabled) {
  manipulationEnabled = enabled;
  setManipulationEnabled(enabled);
  const svg = getCurrentSvgElement();

  if (getIsLayoutFile() && svg) {
    if (enabled) {
      // Re-enable your existing manipulation logic
      await initializeManipulation(svg);
    } else {
      // Disable by calling your existing cleanup
      await destroyManipulation();
    }
  }
}