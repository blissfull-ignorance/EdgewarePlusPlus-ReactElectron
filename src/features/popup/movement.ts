export interface ScreenBounds {
  width: number
  height: number
}

export interface PopupRect {
  x: number
  y: number
  width: number
  height: number
}

export function computeMove(
  popup: PopupRect,
  speed: number,
  screen: ScreenBounds,
  randomFn: () => number = Math.random,
): { x: number; y: number } {
  const dx = Math.floor(randomFn() * (speed * 2 + 1)) - speed
  const dy = Math.floor(randomFn() * (speed * 2 + 1)) - speed
  const x = Math.max(0, Math.min(screen.width - popup.width, popup.x + dx))
  const y = Math.max(0, Math.min(screen.height - popup.height, popup.y + dy))
  return { x, y }
}

export function shouldMove(chance: number, randomFn: () => number = Math.random): boolean {
  return randomFn() * 100 < chance
}
