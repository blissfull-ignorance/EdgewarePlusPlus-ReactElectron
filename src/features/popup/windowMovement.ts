/**
 * @file windowMovement — Legacy popup window motion (features/popup.py
 * try_move): the popup window itself drifts across the monitor with a random
 * velocity of up to ±speed px per tick, bouncing off the display edges.
 */

export interface MoveState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface MoveBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

const randInt = (lo: number, hi: number, rand: () => number): number =>
  lo + Math.floor(rand() * (hi - lo + 1));

/** Random velocity in [-speed, speed], never fully stationary (legacy loop). */
export function initialMoveState(
  x: number,
  y: number,
  speed: number,
  rand: () => number = Math.random
): MoveState {
  const s = Math.max(1, Math.round(speed));
  let vx = randInt(-s, s, rand);
  let vy = randInt(-s, s, rand);
  while (vx === 0 && vy === 0) {
    vx = randInt(-s, s, rand);
    vy = randInt(-s, s, rand);
  }
  return { x, y, vx, vy };
}

/** Advance one tick and bounce off the display edges. */
export function stepMove(
  state: MoveState,
  bounds: MoveBounds,
  winWidth: number,
  winHeight: number
): MoveState {
  let { x, y, vx, vy } = state;
  x += vx;
  y += vy;

  const minX = bounds.x;
  const minY = bounds.y;
  const maxX = Math.max(minX, bounds.x + bounds.width - winWidth);
  const maxY = Math.max(minY, bounds.y + bounds.height - winHeight);

  if (x <= minX) {
    x = minX;
    vx = Math.abs(vx);
  } else if (x >= maxX) {
    x = maxX;
    vx = -Math.abs(vx);
  }
  if (y <= minY) {
    y = minY;
    vy = Math.abs(vy);
  } else if (y >= maxY) {
    y = maxY;
    vy = -Math.abs(vy);
  }

  return { x, y, vx, vy };
}
