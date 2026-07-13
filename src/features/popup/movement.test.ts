import { describe, it, expect } from 'vitest'
import { computeMove, shouldMove, randomDirection } from './movement'
import type { MovingPopup, ScreenBounds } from './movement'

function makePopup(overrides: Partial<MovingPopup> = {}): MovingPopup {
  return {
    id: 1, x: 500, y: 400, width: 300, height: 200,
    dx: 1, dy: 0, ...overrides,
  }
}

describe('computeMove', () => {
  const screen: ScreenBounds = { width: 1920, height: 1080 }

  it('moves in the stated direction by speed pixels', () => {
    const popup = makePopup({ x: 500, y: 400, dx: 1, dy: 0 })
    const result = computeMove(popup, 10, screen)
    expect(result.x).toBe(510)
    expect(result.y).toBe(400)
  })

  it('moves in negative direction', () => {
    const popup = makePopup({ x: 500, y: 400, dx: -1, dy: 0 })
    const result = computeMove(popup, 10, screen)
    expect(result.x).toBe(490)
    expect(result.y).toBe(400)
  })

  it('bounces off the left edge and reverses dx', () => {
    const popup = makePopup({ x: 5, y: 400, dx: -1, dy: 0 })
    const result = computeMove(popup, 10, screen)
    expect(result.x).toBe(0)
    expect(result.dx).toBe(1)
  })

  it('bounces off the right edge and reverses dx', () => {
    const popup = makePopup({ x: screen.width - 300 - 5, y: 400, dx: 1, dy: 0 })
    const result = computeMove(popup, 10, screen)
    expect(result.x).toBe(screen.width - 300)
    expect(result.dx).toBe(-1)
  })

  it('bounces off the top edge and reverses dy', () => {
    const popup = makePopup({ x: 500, y: 5, dx: 0, dy: -1 })
    const result = computeMove(popup, 10, screen)
    expect(result.y).toBe(0)
    expect(result.dy).toBe(1)
  })

  it('bounces off the bottom edge and reverses dy', () => {
    const popup = makePopup({ x: 500, y: screen.height - 200 - 5, dx: 0, dy: 1 })
    const result = computeMove(popup, 10, screen)
    expect(result.y).toBe(screen.height - 200)
    expect(result.dy).toBe(-1)
  })

  it('does not move when speed is 0', () => {
    const popup = makePopup({ dx: 1, dy: 1 })
    const result = computeMove(popup, 0, screen)
    expect(result.x).toBe(popup.x)
    expect(result.y).toBe(popup.y)
    expect(result.dx).toBe(popup.dx)
    expect(result.dy).toBe(popup.dy)
  })

  it('does not change direction when not at a border', () => {
    const popup = makePopup({ x: 500, y: 400, dx: 1, dy: -1 })
    const result = computeMove(popup, 10, screen)
    expect(result.dx).toBe(1)
    expect(result.dy).toBe(-1)
  })

  it('handles diagonal movement', () => {
    const popup = makePopup({ x: 500, y: 400, dx: 1, dy: 1 })
    const result = computeMove(popup, 10, screen)
    expect(result.x).toBe(510)
    expect(result.y).toBe(410)
  })
})

describe('shouldMove', () => {
  it('returns true when random is below threshold', () => {
    expect(shouldMove(50, () => 0.001)).toBe(true)
  })

  it('returns false when random is above threshold', () => {
    expect(shouldMove(50, () => 0.999)).toBe(false)
  })

  it('always returns true at 100%', () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldMove(100)).toBe(true)
    }
  })

  it('always returns false at 0%', () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldMove(0)).toBe(false)
    }
  })
})

describe('randomDirection', () => {
  it('returns non-zero dx and dy', () => {
    for (let i = 0; i < 50; i++) {
      const dir = randomDirection()
      expect(dir.dx).not.toBe(0)
      expect(dir.dy).not.toBe(0)
    }
  })

  it('produces different directions with different random values', () => {
    const d1 = randomDirection(() => 0)
    const d2 = randomDirection(() => 0.5)
    const same = d1.dx === d2.dx && d1.dy === d2.dy
    expect(same).toBe(false)
  })
})

describe('batch movement — only moving popups move', () => {
  const screen: ScreenBounds = { width: 1920, height: 1080 }

  it('does not move popups where moving is false', () => {
    const popups: MovingPopup[] = [
      makePopup({ id: 1, x: 100, y: 100, dx: 1, dy: 0 }),
      makePopup({ id: 2, x: 200, y: 200, dx: -1, dy: 1 }),
      makePopup({ id: 3, x: 300, y: 300, dx: 0, dy: -1 }),
    ]
    const movingFlags = [true, false, false]

    const results = popups.map((popup, i) => {
      if (!movingFlags[i]) return { ...popup }
      return computeMove(popup, 10, screen)
    })

    expect(results[0].x).not.toBe(popups[0].x)
    expect(results[1].x).toBe(popups[1].x)
    expect(results[1].y).toBe(popups[1].y)
    expect(results[2].x).toBe(popups[2].x)
    expect(results[2].y).toBe(popups[2].y)
  })

  it('shouldMove gates which popups are assigned moving=true at creation', () => {
    const popups = Array.from({ length: 20 }, (_, i) => ({
      ...makePopup({ id: i }),
    }))

    let callIndex = 0
    const deterministicRandom = () => {
      const values = [0.1, 0.9, 0.3, 0.8, 0.5, 0.2, 0.7, 0.6, 0.4, 0.15,
        0.95, 0.05, 0.85, 0.35, 0.65, 0.25, 0.75, 0.45, 0.55, 0.01]
      return values[callIndex++ % values.length]
    }

    const results = popups.map(() => shouldMove(50, deterministicRandom))

    const movingCount = results.filter(Boolean).length
    const stationaryCount = results.filter((r) => !r).length

    expect(movingCount).toBeGreaterThan(0)
    expect(stationaryCount).toBeGreaterThan(0)
  })

  it('full tick simulation: only moving popups change position', () => {
    const popups: MovingPopup[] = [
      makePopup({ id: 1, x: 500, y: 400, dx: 1, dy: 0 }),
      makePopup({ id: 2, x: 500, y: 400, dx: 1, dy: 0 }),
      makePopup({ id: 3, x: 500, y: 400, dx: 1, dy: 0 }),
    ]
    const movingFlags = [true, false, true]

    const speed = 10
    const updated = popups.map((popup, i) => {
      if (!movingFlags[i]) return { ...popup }
      const result = computeMove(popup, speed, screen)
      return { ...popup, ...result }
    })

    expect(updated[0].x).toBe(510)
    expect(updated[1].x).toBe(500)
    expect(updated[2].x).toBe(510)
  })

  it('moving popup bounces and continues in new direction on next tick', () => {
    const speed = 20
    let popup = makePopup({ x: 5, y: 500, dx: -1, dy: 0 })

    const tick1 = computeMove(popup, speed, screen)
    popup = { ...popup, ...tick1 }
    expect(popup.x).toBe(0)
    expect(popup.dx).toBe(1)

    const tick2 = computeMove(popup, speed, screen)
    popup = { ...popup, ...tick2 }
    expect(popup.x).toBe(20)
    expect(popup.dx).toBe(1)
  })
})
