/**
 * @file lowkeyPosition — Legacy lowkey popup placement.
 *
 * With lowkey mode on, popups hug the corner chosen by `lkCorner`:
 * 0 top-right, 1 top-left, 2 bottom-left, 3 bottom-right, 4 random.
 */

export interface PopupBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function lowkeyPosition(
  corner: number,
  bounds: PopupBounds,
  winWidth: number,
  winHeight: number,
  rand: () => number = Math.random
): { x: number; y: number } | null {
  let c = Math.floor(corner);
  if (c < 0 || c > 4) return null;
  if (c === 4) c = Math.floor(rand() * 4);
  const right = c === 0 || c === 3;
  const bottom = c === 2 || c === 3;
  return {
    x: bounds.x + (right ? bounds.width - winWidth : 0),
    y: bounds.y + (bottom ? bounds.height - winHeight : 0),
  };
}
