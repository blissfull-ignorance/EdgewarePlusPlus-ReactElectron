export interface ScreenBounds {
  width: number
  height: number
}

export interface MovingPopup {
  id: number
  x: number
  y: number
  width: number
  height: number
  dx: number
  dy: number
}

export function computeMove(
  popup: MovingPopup,
  speed: number,
  screen: ScreenBounds,
): { x: number; y: number; dx: number; dy: number } {
  let { x, y, dx, dy } = popup
  x += dx * speed
  y += dy * speed

  if (x < 0) { x = 0; dx = -dx }
  else if (x > screen.width - popup.width) { x = screen.width - popup.width; dx = -dx }

  if (y < 0) { y = 0; dy = -dy }
  else if (y > screen.height - popup.height) { y = screen.height - popup.height; dy = -dy }

  return { x, y, dx, dy }
}

export function randomDirection(randomFn: () => number = Math.random): { dx: number; dy: number } {
  const angle = randomFn() * Math.PI * 2
  return { dx: Math.cos(angle), dy: Math.sin(angle) }
}

export function shouldMove(chance: number, randomFn: () => number = Math.random): boolean {
  return randomFn() * 100 < chance
}
