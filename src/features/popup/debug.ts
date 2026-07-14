/**
 * Structured movement event logger for debugging popup movement.
 *
 * Provides a ring-buffer log of movement events with toggle-able console output.
 * Events are tagged with [movement:tick], [movement:move], [movement:skip],
 * [movement:spawn] for easy filtering in DevTools console.
 *
 * REMOVABLE: This entire module can be removed in production builds if console
 * noise is a concern. The performance overhead is minimal (JSON.stringify per
 * event) but the log array grows unbounded. Call clearMovementLog() periodically
 * if memory is a concern.
 *
 * FUTUREWORK: Add log rotation (keep last N events) and a "verbose" mode that
 * includes additional metadata like screen bounds and popup count.
 */

export interface MovementEvent {
  ts: number
  type: 'tick' | 'move' | 'skip' | 'spawn'
  popupId?: number
  x?: number
  y?: number
  dx?: number
  dy?: number
  speed?: number
  moving?: boolean
  total?: number
  movingCount?: number
}

let enabled = true
const log: MovementEvent[] = []

export function enableMovementDebug(): void {
  enabled = true
  log.length = 0
}

export function disableMovementDebug(): void {
  enabled = false
}

/** Returns the full event log as a read-only array. */
export function getMovementLog(): readonly MovementEvent[] {
  return log
}

export function clearMovementLog(): void {
  log.length = 0
}

/**
 * Logs a movement event to both the in-memory log array and the console.
 * No-ops when disabled. The event is JSON-serialized for structured output.
 */
export function logMovementEvent(event: MovementEvent): void {
  if (enabled) {
    log.push(event)
    const { ts, type, ...rest } = event
    console.log(`[movement:${type}]`, JSON.stringify(rest))
  }
}
