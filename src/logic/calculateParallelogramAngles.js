// src/logic/calculateParallelogramAngles.js

/**
 * Parses an SVG path data string and calculates the angles of each segment.
 * If the path appears to be a closed quadrilateral (potentially a parallelogram),
 * it returns only the angles of the first two segments.
 * @param {string} pathData The SVG path data string (the 'd' attribute value).
 * @returns {number[]} An array of angles in degrees. Returns angles for all segments if not a closed quadrilateral of 4 segments.
 */
export function calculateParallelogramAngles(pathData) {
  // --- ADD THIS LOG ---
  console.log('[Angle Calc] Received path data:', pathData);

  const angles = [];
  let currentX = 0;
  let currentY = 0;
  let startX = 0;
  let startY = 0;

  const commands = pathData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi);

  if (!commands) {
      console.error("[Angle Calc] Could not parse path data string.");
      return [];
  }

  const segments = [];
  for (const command of commands) {
      const type = command[0];
      const values = command.substring(1).trim().split(/[\s,]+/).map(parseFloat);
      segments.push({ type, values });
  }

  // Check if it's a closed quadrilateral (M...L...L...L...Z) - simple structural check
  const isClosedQuadrilateral = segments.length >= 4 &&
                                segments[0].type.toUpperCase() === 'M' &&
                                segments[segments.length - 1].type.toUpperCase() === 'Z';

  let calculatedAngles = [];

   for (const seg of segments) {
      const type = seg.type;
      const values = seg.values;

      let angle = null;

      switch (type.toUpperCase()) {
          case 'M': // MoveTo
              currentX = values[0];
              currentY = values[1];
              startX = currentX;
              startY = currentY;
              break;
          case 'L': // LineTo
              const xL = values[0];
              const yL = values[1];
              const deltaXL = xL - currentX;
              const deltaYL = yL - currentY;
              angle = Math.atan2(deltaYL, deltaXL) * 180 / Math.PI;
              currentX = xL;
              currentY = yL;
              break;
          case 'H': // Horizontal LineTo
              const xH = values[0];
              const deltaXH = xH - currentX;
              angle = deltaXH >= 0 ? 0 : 180;
              currentX = xH;
              break;
          case 'V': // Vertical LineTo
              const yV = values[0];
              const deltaYV = yV - currentY;
              angle = deltaYV >= 0 ? 90 : -90;
              currentY = yV;
              break;
           case 'C': // Cubic Bezier Curve
                const x1C = values[0];
                const y1C = values[1];
                const deltaXC1 = x1C - currentX;
                const deltaYC1 = y1C - currentY;
                angle = Math.atan2(deltaYC1, deltaXC1) * 180 / Math.PI;

                currentX = values[4];
                currentY = values[5];
                break;
            case 'S': // Smooth Cubic Bezier Curve
                 const x1S = values[0];
                 const y1S = values[1];
                 const deltaXS1 = x1S - currentX;
                 const deltaYS1 = y1S - currentY;
                 angle = Math.atan2(deltaYS1, deltaXS1) * 180 / Math.PI;

                 currentX = values[2];
                 currentY = values[3];
                 break;
            case 'Q': // Quadratic Bezier Curve
                const x1Q = values[0];
                const y1Q = values[1];
                const deltaXQ1 = x1Q - currentX;
                const deltaYQ1 = y1Q - currentY;
                angle = Math.atan2(deltaYQ1, deltaXQ1) * 180 / Math.PI;

                currentX = values[2];
                currentY = values[3];
                break;
            case 'T': // Smooth Quadratic Bezier Curve
                const xT = values[0];
                const yT = values[1];
                const deltaXT = xT - currentX;
                const deltaYT = yT - currentY;
                angle = Math.atan2(deltaYT, deltaXT) * 180 / Math.PI;

                currentX = xT;
                currentY = yT;
                break;
             case 'A': // Elliptical Arc Curve
                const xA = values[5];
                const yA = values[6];
                const deltaXA = xA - currentX;
                const deltaYA = yA - currentY;
                angle = Math.atan2(deltaYA, deltaXA) * 180 / Math.PI;

                currentX = xA;
                currentY = yA;
                break;
          case 'Z': // ClosePath
              const deltaXZ = startX - currentX;
              const deltaYZ = startY - currentY;
              if (deltaXZ !== 0 || deltaYZ !== 0) { // Avoid calculating angle for a zero-length segment
                angle = Math.atan2(deltaYZ, deltaXZ) * 180 / Math.PI;
              }
              currentX = startX;
              currentY = startY;
              break;
          default:
              console.warn('Unsupported path command:', type);
              break;
      }

      if (angle !== null) {
          calculatedAngles.push(angle);
      }
  }
  
  // --- ADD THIS LOG ---
  console.log('[Angle Calc] Raw calculated angles:', calculatedAngles);

  if (isClosedQuadrilateral && calculatedAngles.length >= 4) {
      // Assuming the first two segments define the adjacent sides of the parallelogram
      return calculatedAngles.slice(0, 2);
  } else {
      // If not a closed quadrilateral of 4 segments, return all angles
      return calculatedAngles;
  }
}