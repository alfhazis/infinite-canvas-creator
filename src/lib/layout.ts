export interface NodeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Finds a free position for a new node that doesn't overlap existing nodes.
 * Starts checking from startX, startY and moves in steps.
 */
export function findFreePosition(
  existingNodes: NodeBounds[],
  width: number,
  height: number,
  startX: number,
  startY: number,
  padding = 40,
  step = 40
): { x: number; y: number } {
  let x = startX;
  let y = startY;
  
  // Simple heuristic: if there's an overlap, move down. 
  // If we've moved too far down (e.g. 1500px), move right and reset y.
  
  let found = false;
  let attempts = 0;
  const maxAttempts = 500;
  const maxVerticalOffset = 1500;

  while (!found && attempts < maxAttempts) {
    const overlapping = existingNodes.some(node => {
      const nodeX = node.x;
      const nodeY = node.y;
      const nodeW = node.width || 360;
      const nodeH = node.height || 300;
      
      return (
        x < nodeX + nodeW + padding &&
        x + width + padding > nodeX &&
        y < nodeY + nodeH + padding &&
        y + height + padding > nodeY
      );
    });

    if (!overlapping) {
      found = true;
    } else {
      y += step;
      attempts++;
      
      // If we move down too much, move right and try again from startY
      if (y - startY > maxVerticalOffset) {
        x += width + padding;
        y = startY;
      }
    }
  }

  return { x, y };
}

/**
 * Organizes a list of new nodes in a grid starting from a preferred position
 */
export function gridLayout(
  existingNodes: NodeBounds[],
  nodesToPlace: { width: number; height: number }[],
  startX: number,
  startY: number,
  cols = 3,
  padding = 60
): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  const currentNodes = [...existingNodes];

  for (const nodeToPlace of nodesToPlace) {
    const pos = findFreePosition(
      currentNodes,
      nodeToPlace.width,
      nodeToPlace.height,
      startX,
      startY,
      padding
    );
    positions.push(pos);
    currentNodes.push({ ...pos, ...nodeToPlace });
  }

  return positions;
}
