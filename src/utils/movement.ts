/**
 * Popup movement logic — ported from legacy features/popup.py try_move().
 *
 * Popup moves diagonally across screen at configurable speed,
 * bouncing off screen boundaries.
 */

export interface Position {
  x: number;
  y: number;
}

export interface Direction {
  dx: number;
  dy: number;
}

/**
 * Compute the next position given current position, direction, speed,
 * popup dimensions, and screen bounds. Bounces off edges.
 */
export function computeNextPosition(
  pos: Position,
  dir: Direction,
  speed: number,
  popupWidth: number,
  popupHeight: number,
  screenWidth: number,
  screenHeight: number
): { position: Position; direction: Direction } {
  const moveAmount = speed;
  // When the popup is at least as big as the screen/bounds there is no travel
  // range: pin it at the origin instead of oscillating into negative offsets
  // (which would push the content out of the visible area entirely).
  const maxX = Math.max(0, screenWidth - popupWidth);
  const maxY = Math.max(0, screenHeight - popupHeight);

  let newX = pos.x + dir.dx * moveAmount;
  let newY = pos.y + dir.dy * moveAmount;
  let newDx = dir.dx;
  let newDy = dir.dy;

  if (newX < 0) {
    newX = 0;
    newDx = Math.abs(dir.dx);
  } else if (newX > maxX) {
    newX = maxX;
    newDx = -Math.abs(dir.dx);
  }

  if (newY < 0) {
    newY = 0;
    newDy = Math.abs(dir.dy);
  } else if (newY > maxY) {
    newY = maxY;
    newDy = -Math.abs(dir.dy);
  }

  return {
    position: { x: newX, y: newY },
    direction: { dx: newDx, dy: newDy },
  };
}

/**
 * Simulate movement over a number of steps. Used for testing.
 */
export function simulatePopupMovement(
  startPos: Position,
  startDir: Direction,
  popupWidth: number,
  popupHeight: number,
  screenWidth: number,
  screenHeight: number,
  speed: number,
  steps: number
): Position[] {
  const positions: Position[] = [];
  let pos = { ...startPos };
  let dir = { ...startDir };

  for (let i = 0; i < steps; i++) {
    positions.push({ ...pos });
    const result = computeNextPosition(pos, dir, speed, popupWidth, popupHeight, screenWidth, screenHeight);
    pos = result.position;
    dir = result.direction;
  }

  return positions;
}
