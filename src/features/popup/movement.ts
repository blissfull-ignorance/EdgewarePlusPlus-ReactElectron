/**
 * Pure movement functions for popup windows.
 *
 * This module contains ZERO side effects — all functions are pure and testable
 * in isolation. The movement system uses a "persistent directional vector" model:
 * each popup gets a unit vector {dx, dy} at spawn time that only reverses when
 * the popup bounces off a screen edge.
 *
 * FUTUREWORK: Consider adding acceleration/curve movement modes (e.g., circular
 * orbit, figure-8) as alternatives to straight-line + bounce. The current
 * architecture supports this by adding new movement functions alongside
 * computeMove.
 *
 * FUTUREWORK: Add support for multi-monitor layouts. Currently screen bounds
 * represent a single virtual display. For multi-monitor, the popup could
 * transition between screens by expanding the bounds to cover the full
 * virtual desktop rectangle.
 */

export interface ScreenBounds {
  /** Total virtual desktop width in CSS pixels (covers all monitors if extended). */
  width: number
  /** Total virtual desktop height in CSS pixels. */
  height: number
}

export interface MovingPopup {
  id: number
  x: number
  y: number
  width: number
  height: number
  /** Directional vector X component (unit length, may be negative). */
  dx: number
  /** Directional vector Y component (unit length, may be negative). */
  dy: number
}

/**
 * Computes the next position for a popup, applying speed and bounce logic.
 *
 * Returns integer coordinates (Math.round) to prevent Electron IPC float
 * serialization errors that cause "conversion failure" crashes.
 *
 * @returns New position and possibly reversed direction vector.
 */
export function computeMove(
  popup: MovingPopup,
  speed: number,
  screen: ScreenBounds,
): { x: number; y: number; dx: number; dy: number } {
  let { x, y, dx, dy } = popup
  x = Math.round(x + dx * speed)
  y = Math.round(y + dy * speed)

  // Bounce: clamp to screen bounds and reverse direction on collision
  if (x < 0) { x = 0; dx = -dx }
  else if (x > screen.width - popup.width) { x = screen.width - popup.width; dx = -dx }

  if (y < 0) { y = 0; dy = -dy }
  else if (y > screen.height - popup.height) { y = screen.height - popup.height; dy = -dy }

  return { x, y, dx, dy }
}

/**
 * Generates a random unit direction vector from a random angle [0, 2π).
 * The random function is injectable for deterministic testing.
 *
 * DISCUSSION: The direction is truly random (uniform distribution across all
 * angles). A bias toward horizontal or vertical movement could be added via
 * angle weighting, but is not currently needed.
 */
export function randomDirection(randomFn: () => number = Math.random): { dx: number; dy: number } {
  const angle = randomFn() * Math.PI * 2
  return { dx: Math.cos(angle), dy: Math.sin(angle) }
}

/** Returns true with `chance` percent probability (0–100). Injectable for testing. */
export function shouldMove(chance: number, randomFn: () => number = Math.random): boolean {
  return randomFn() * 100 < chance
}

/** Minimal popup shape needed for movement computation. */
export interface TickablePopup {
  id: number
  moving: boolean
  x: number
  y: number
  width: number
  height: number
  dx: number
  dy: number
}

export interface PositionUpdate {
  x: number
  y: number
  dx: number
  dy: number
}

/**
 * Computes position updates for all moving popups in a single tick.
 *
 * Only returns entries for popups that actually moved or bounced (position or
 * direction changed). This avoids unnecessary IPC calls and store updates
 * for stationary popups.
 *
 * @returns Map from popup ID to its new position and direction.
 */
export function tickPopups(
  popups: TickablePopup[],
  speed: number,
  screen: ScreenBounds,
): Map<number, PositionUpdate> {
  const updates = new Map<number, PositionUpdate>()
  for (const popup of popups) {
    if (!popup.moving) continue
    const result = computeMove(popup, speed, screen)
    if (result.x !== popup.x || result.y !== popup.y || result.dx !== popup.dx || result.dy !== popup.dy) {
      updates.set(popup.id, result)
    }
  }
  return updates
}
