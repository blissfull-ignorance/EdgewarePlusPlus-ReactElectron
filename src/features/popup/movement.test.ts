import { describe, it, expect } from 'vitest'
import { computeMove, shouldMove, randomDirection, tickPopups } from './movement'
import type { MovingPopup, TickablePopup, ScreenBounds } from './movement'

function makePopup(overrides: Partial<MovingPopup> = {}): MovingPopup {
  return {
    id: 1, x: 500, y: 400, width: 300, height: 200,
    dx: 1, dy: 0, ...overrides,
  }
}

function makeTickPopup(overrides: Partial<TickablePopup> = {}): TickablePopup {
  return {
    id: 1, moving: true, x: 500, y: 400, width: 300, height: 200,
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

describe('tickPopups', () => {
  const screen: ScreenBounds = { width: 1920, height: 1080 }

  it('returns empty map when no popups', () => {
    const updates = tickPopups([], 10, screen)
    expect(updates.size).toBe(0)
  })

  it('skips popups where moving is false', () => {
    const popups = [
      makeTickPopup({ id: 1, moving: false, x: 100, y: 100, dx: 1, dy: 0 }),
      makeTickPopup({ id: 2, moving: false, x: 200, y: 200, dx: -1, dy: 1 }),
      makeTickPopup({ id: 3, moving: false, x: 300, y: 300, dx: 0, dy: -1 }),
    ]
    const updates = tickPopups(popups, 10, screen)
    expect(updates.size).toBe(0)
  })

  it('moves popups where moving is true', () => {
    const popups = [
      makeTickPopup({ id: 1, moving: true, x: 500, y: 400, dx: 1, dy: 0 }),
    ]
    const updates = tickPopups(popups, 10, screen)
    expect(updates.size).toBe(1)
    const u = updates.get(1)!
    expect(u.x).toBe(510)
    expect(u.y).toBe(400)
  })

  it('full tick simulation: only moving popups change position', () => {
    const popups = [
      makeTickPopup({ id: 1, moving: true, x: 500, y: 400, dx: 1, dy: 0 }),
      makeTickPopup({ id: 2, moving: false, x: 500, y: 400, dx: 1, dy: 0 }),
      makeTickPopup({ id: 3, moving: true, x: 500, y: 400, dx: 1, dy: 0 }),
    ]

    const updates = tickPopups(popups, 10, screen)

    expect(updates.size).toBe(2)
    expect(updates.has(1)).toBe(true)
    expect(updates.has(2)).toBe(false)
    expect(updates.has(3)).toBe(true)
    expect(updates.get(1)!.x).toBe(510)
    expect(updates.get(3)!.x).toBe(510)
  })

  it('moving popup bounces and continues in new direction on next tick', () => {
    const speed = 20
    let popups: TickablePopup[] = [
      makeTickPopup({ x: 5, y: 500, dx: -1, dy: 0 }),
    ]

    const tick1 = tickPopups(popups, speed, screen)
    const u1 = tick1.get(1)!
    popups = [{ ...popups[0], ...u1 }]
    expect(popups[0].x).toBe(0)
    expect(popups[0].dx).toBe(1)

    const tick2 = tickPopups(popups, speed, screen)
    const u2 = tick2.get(1)!
    popups = [{ ...popups[0], ...u2 }]
    expect(popups[0].x).toBe(20)
    expect(popups[0].dx).toBe(1)
  })

  it('speed=0 produces no updates', () => {
    const popups = [
      makeTickPopup({ id: 1, moving: true, x: 500, y: 400, dx: 1, dy: 0 }),
    ]
    const updates = tickPopups(popups, 0, screen)
    expect(updates.size).toBe(0)
  })

  it('all moving popups get updates at 100% chance', () => {
    const popups = Array.from({ length: 20 }, (_, i) =>
      makeTickPopup({ id: i, moving: true, x: 500 + i * 10, y: 400, dx: 1, dy: 0 }),
    )

    const updates = tickPopups(popups, 5, screen)

    expect(updates.size).toBe(20)
    for (const popup of popups) {
      const u = updates.get(popup.id)
      expect(u).toBeDefined()
      expect(u!.x).not.toBe(popup.x)
    }
  })

  it('multi-tick simulation: popups accumulate position changes', () => {
    const speed = 5
    let popups: TickablePopup[] = [
      makeTickPopup({ id: 1, moving: true, x: 500, y: 400, dx: 1, dy: 0 }),
    ]

    for (let tick = 0; tick < 10; tick++) {
      const updates = tickPopups(popups, speed, screen)
      popups = popups.map((p) => {
        const u = updates.get(p.id)
        return u ? { ...p, ...u } : p
      })
    }

    expect(popups[0].x).toBe(500 + 10 * speed)
    expect(popups[0].y).toBe(400)
    expect(popups[0].dx).toBe(1)
  })
})
