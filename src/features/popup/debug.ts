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

export function getMovementLog(): readonly MovementEvent[] {
  return log
}

export function clearMovementLog(): void {
  log.length = 0
}

export function logMovementEvent(event: MovementEvent): void {
  if (enabled) {
    log.push(event)
    const { ts, type, ...rest } = event
    console.log(`[movement:${type}]`, JSON.stringify(rest))
  }
}
