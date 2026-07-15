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

export interface OccupiedZone {
  x: number
  y: number
  width: number
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

const GRID_COLS = 4
const GRID_ROWS = 3
const OVERLAP_MARGIN = 20

function cellOccupancy(
  cellX: number, cellY: number, cellW: number, cellH: number,
  occupied: OccupiedZone[],
): number {
  let count = 0
  for (const z of occupied) {
    if (
      z.x - OVERLAP_MARGIN < cellX + cellW &&
      z.x + z.width + OVERLAP_MARGIN > cellX &&
      z.y - OVERLAP_MARGIN < cellY + cellH &&
      z.y + z.height + OVERLAP_MARGIN > cellY
    ) {
      count++
    }
  }
  return count
}

function weightedPickIndex(weights: number[], randomFn: () => number): number {
  const total = weights.reduce((s, w) => s + w, 0)
  if (total <= 0) return Math.floor(randomFn() * weights.length)
  let roll = randomFn() * total
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return i
  }
  return weights.length - 1
}

/**
 * Computes a spawn position for a new popup using grid-based weighted
 * positioning to minimize overlap with existing popups.
 *
 * The screen is divided into a GRID_COLS × GRID_ROWS grid. Each cell's
 * weight is `1 / (1 + occupancy)`, so empty cells are strongly preferred
 * and heavily occupied cells are rarely chosen. A margin around existing
 * popups prevents edge-touching.
 *
 * FUTUREWORK: Consider making grid dimensions configurable or adapting
 * them to screen aspect ratio.
 */
export function computeSpawnPosition(
  popupW: number,
  popupH: number,
  screen: ScreenBounds,
  occupied: OccupiedZone[],
  randomFn: () => number = Math.random,
): { x: number; y: number } {
  if (popupW >= screen.width && popupH >= screen.height) {
    return { x: 0, y: 0 }
  }

  const cellW = screen.width / GRID_COLS
  const cellH = screen.height / GRID_ROWS

  const weights: number[] = []
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const occ = cellOccupancy(col * cellW, row * cellH, cellW, cellH, occupied)
      weights.push(1 / (1 + occ))
    }
  }

  const idx = weightedPickIndex(weights, randomFn)
  const col = idx % GRID_COLS
  const row = Math.floor(idx / GRID_COLS)

  const minX = Math.max(0, Math.floor(col * cellW))
  const maxX = popupW >= screen.width
    ? 0
    : Math.min(screen.width - popupW, Math.floor((col + 1) * cellW - popupW))
  const minY = Math.max(0, Math.floor(row * cellH))
  const maxY = popupH >= screen.height
    ? 0
    : Math.min(screen.height - popupH, Math.floor((row + 1) * cellH - popupH))

  const x = Math.round(minX + randomFn() * Math.max(0, maxX - minX))
  const y = Math.round(minY + randomFn() * Math.max(0, maxY - minY))

  return { x, y }
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
