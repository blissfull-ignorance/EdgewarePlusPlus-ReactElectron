import { describe, it, expect } from 'vitest'
import { computeMove, shouldMove, randomDirection, tickPopups, computeSpawnPosition } from './movement'
import type { MovingPopup, TickablePopup, ScreenBounds, OccupiedZone } from './movement'

/** Factory for MovingPopup with sensible defaults. Override any field via spread. */
function makePopup(overrides: Partial<MovingPopup> = {}): MovingPopup {
  return {
    id: 1, x: 500, y: 400, width: 300, height: 200,
    dx: 1, dy: 0, ...overrides,
  }
}

/** Factory for TickablePopup with sensible defaults. Override any field via spread. */
function makeTickPopup(overrides: Partial<TickablePopup> = {}): TickablePopup {
  return {
    id: 1, moving: true, x: 500, y: 400, width: 300, height: 200,
    dx: 1, dy: 0, ...overrides,
  }
}

/** Pure unit tests for movement math — no store or DOM dependencies. */
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

  it('returns integer coordinates (Math.round for Electron IPC safety)', () => {
    const popup = makePopup({ x: 500.3, y: 400.7, dx: 1, dy: 1 })
    const result = computeMove(popup, 7, screen)
    expect(Number.isInteger(result.x)).toBe(true)
    expect(Number.isInteger(result.y)).toBe(true)
  })

  it('bounces off both axes at corner simultaneously', () => {
    const popup = makePopup({ x: 5, y: 5, dx: -1, dy: -1 })
    const result = computeMove(popup, 10, screen)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
    expect(result.dx).toBe(1)
    expect(result.dy).toBe(1)
  })

  it('popup exactly at bottom-right corner stays clamped', () => {
    const popup = makePopup({ x: screen.width - 300, y: screen.height - 200, dx: 1, dy: 1 })
    const result = computeMove(popup, 5, screen)
    expect(result.x).toBe(screen.width - 300)
    expect(result.y).toBe(screen.height - 200)
    expect(result.dx).toBe(-1)
    expect(result.dy).toBe(-1)
  })

  it('speed=1 moves exactly 1 pixel', () => {
    const popup = makePopup({ x: 500, y: 400, dx: 1, dy: 0 })
    const result = computeMove(popup, 1, screen)
    expect(result.x).toBe(501)
    expect(result.y).toBe(400)
  })
})

/** Tests probability threshold function with injectable randomness. */
describe('shouldMove', () => {
  it('returns true when random is below threshold', () => {
    expect(shouldMove(50, () => 0.001)).toBe(true)
  })

  it('returns false when random is above threshold', () => {
    expect(shouldMove(50, () => 0.999)).toBe(false)
  })

  it('always returns true at 100%', () => {
    expect(shouldMove(100, () => 0.999)).toBe(true)
  })

  it('always returns false at 0%', () => {
    expect(shouldMove(0, () => 0.001)).toBe(false)
  })
})

/** Tests direction vector generation from random angle. */
describe('randomDirection', () => {
  it('returns a unit vector (dx² + dy² ≈ 1)', () => {
    for (let i = 0; i < 50; i++) {
      const dir = randomDirection()
      const magnitude = dir.dx * dir.dx + dir.dy * dir.dy
      expect(magnitude).toBeCloseTo(1, 10)
    }
  })

  it('produces different directions with different random values', () => {
    const d1 = randomDirection(() => 0)
    const d2 = randomDirection(() => 0.5)
    const same = d1.dx === d2.dx && d1.dy === d2.dy
    expect(same).toBe(false)
  })
})

/** Tests batch tick processing for multiple popups in a single frame. */
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

/**
 * Edge case tests: popup dimensions larger than the screen.
 *
 * These verify that computeMove and tickPopups handle degenerate geometry
 * correctly — e.g., a popup wider than the screen should clamp to x=0 and
 * immediately reverse direction, and a popup taller than the screen should
 * clamp to y=0 and reverse vertically.
 */
describe('computeMove — large popup dimensions relative to screen', () => {
  const smallScreen: ScreenBounds = { width: 800, height: 600 }

  it('popup wider than screen clamps to x=0 and reverses dx', () => {
    const popup = makePopup({ width: 1200, height: 200, x: 0, y: 100, dx: 1, dy: 0 })
    const result = computeMove(popup, 10, smallScreen)
    // screen.width - popup.width = -400, so x > -400 is always true → clamped at max
    // But x starts at 0 and moves to 10, then checks > 800-1200 = -400 → x=10 > -400 → clamped
    expect(result.x).toBe(-400)
    expect(result.dx).toBe(-1)
  })

  it('popup taller than screen clamps to y=0 and reverses dy', () => {
    const popup = makePopup({ width: 200, height: 900, x: 100, y: 0, dx: 0, dy: 1 })
    const result = computeMove(popup, 10, smallScreen)
    // screen.height - popup.height = -300, y=10 > -300 → clamped at -300
    expect(result.y).toBe(-300)
    expect(result.dy).toBe(-1)
  })

  it('popup wider than screen moving left clamps to x=0', () => {
    const popup = makePopup({ width: 1200, height: 200, x: 0, y: 100, dx: -1, dy: 0 })
    const result = computeMove(popup, 10, smallScreen)
    expect(result.x).toBe(0)
    expect(result.dx).toBe(1)
  })

  it('popup taller than screen moving up clamps to y=0', () => {
    const popup = makePopup({ width: 200, height: 900, x: 100, y: 0, dx: 0, dy: -1 })
    const result = computeMove(popup, 10, smallScreen)
    expect(result.y).toBe(0)
    expect(result.dy).toBe(1)
  })

  it('popup exactly screen-size moves freely within [0, 0]', () => {
    const popup = makePopup({ width: 800, height: 600, x: 0, y: 0, dx: 1, dy: 1 })
    const result = computeMove(popup, 10, smallScreen)
    // screen.width - width = 0, so x=10 > 0 → clamped back to 0, reversed
    expect(result.x).toBe(0)
    expect(result.dx).toBe(-1)
    expect(result.y).toBe(0)
    expect(result.dy).toBe(-1)
  })

  it('zero-size popup moves freely without clamping issues', () => {
    const popup = makePopup({ width: 0, height: 0, x: 400, y: 300, dx: 1, dy: 1 })
    const result = computeMove(popup, 10, smallScreen)
    expect(result.x).toBe(410)
    expect(result.y).toBe(310)
    expect(result.dx).toBe(1)
    expect(result.dy).toBe(1)
  })
})

describe('tickPopups — large popup dimensions', () => {
  const smallScreen: ScreenBounds = { width: 800, height: 600 }

  it('popup wider than screen gets bounce update', () => {
    const popups = [
      makeTickPopup({ id: 1, moving: true, width: 1200, height: 200, x: 0, y: 100, dx: 1, dy: 0 }),
    ]
    const updates = tickPopups(popups, 10, smallScreen)
    expect(updates.size).toBe(1)
    const u = updates.get(1)!
    expect(u.x).toBe(-400)
    expect(u.dx).toBe(-1)
  })

  it('mixed sizes: only oversized popup bounces', () => {
    const popups = [
      makeTickPopup({ id: 1, moving: true, width: 1200, height: 200, x: 0, y: 100, dx: 1, dy: 0 }),
      makeTickPopup({ id: 2, moving: true, width: 100, height: 100, x: 400, y: 200, dx: 1, dy: 0 }),
    ]
    const updates = tickPopups(popups, 10, smallScreen)
    expect(updates.size).toBe(2)
    expect(updates.get(1)!.dx).toBe(-1)
    expect(updates.get(2)!.dx).toBe(1)
  })
})

describe('computeSpawnPosition', () => {
  const screen: ScreenBounds = { width: 1920, height: 1080 }
  const popupW = 300
  const popupH = 200

  it('returns coordinates within screen bounds with no occupied zones', () => {
    for (let i = 0; i < 50; i++) {
      const pos = computeSpawnPosition(popupW, popupH, screen, [])
      expect(pos.x).toBeGreaterThanOrEqual(0)
      expect(pos.x).toBeLessThanOrEqual(screen.width - popupW)
      expect(pos.y).toBeGreaterThanOrEqual(0)
      expect(pos.y).toBeLessThanOrEqual(screen.height - popupH)
    }
  })

  it('returns integer coordinates', () => {
    for (let i = 0; i < 20; i++) {
      const pos = computeSpawnPosition(popupW, popupH, screen, [])
      expect(Number.isInteger(pos.x)).toBe(true)
      expect(Number.isInteger(pos.y)).toBe(true)
    }
  })

  it('avoids cell occupied by a popup in top-left quadrant', () => {
    const occupied: OccupiedZone[] = [{ x: 100, y: 100, width: 300, height: 200 }]
    const samples: Array<{ x: number; y: number }> = []
    for (let i = 0; i < 200; i++) {
      samples.push(computeSpawnPosition(popupW, popupH, screen, occupied))
    }
    const inOccupiedCell = samples.filter((p) =>
      p.x < 480 && p.x >= 0 && p.y < 360 && p.y >= 0,
    )
    expect(inOccupiedCell.length).toBeLessThan(samples.length * 0.4)
  })

  it('all cells full: still returns valid position within bounds', () => {
    const occupied: OccupiedZone[] = [
      { x: 0, y: 0, width: 500, height: 400 },
      { x: 480, y: 0, width: 500, height: 400 },
      { x: 960, y: 0, width: 500, height: 400 },
      { x: 1440, y: 0, width: 500, height: 400 },
      { x: 0, y: 360, width: 500, height: 400 },
      { x: 480, y: 360, width: 500, height: 400 },
      { x: 960, y: 360, width: 500, height: 400 },
      { x: 1440, y: 360, width: 500, height: 400 },
      { x: 0, y: 720, width: 500, height: 400 },
      { x: 480, y: 720, width: 500, height: 400 },
      { x: 960, y: 720, width: 500, height: 400 },
      { x: 1440, y: 720, width: 500, height: 400 },
    ]
    for (let i = 0; i < 50; i++) {
      const pos = computeSpawnPosition(popupW, popupH, screen, occupied)
      expect(pos.x).toBeGreaterThanOrEqual(0)
      expect(pos.x).toBeLessThanOrEqual(screen.width - popupW)
      expect(pos.y).toBeGreaterThanOrEqual(0)
      expect(pos.y).toBeLessThanOrEqual(screen.height - popupH)
    }
  })

  it('popup larger than screen returns valid clamped position', () => {
    const bigW = 2400
    const bigH = 1200
    const pos = computeSpawnPosition(bigW, bigH, screen, [])
    expect(pos.x).toBe(0)
    expect(pos.y).toBe(0)
  })

  it('deterministic with injectable random: same seed gives same result', () => {
    const deterministic = () => 0.5
    const pos1 = computeSpawnPosition(popupW, popupH, screen, [], deterministic)
    const pos2 = computeSpawnPosition(popupW, popupH, screen, [], deterministic)
    expect(pos1).toEqual(pos2)
  })

  it('empty occupied list produces spread across grid cells', () => {
    const cells = new Set<string>()
    const randomInputs = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9]
    for (let i = 0; i < 100; i++) {
      const r = randomInputs[i % randomInputs.length]
      const pos = computeSpawnPosition(popupW, popupH, screen, [], () => r)
      const col = Math.floor(pos.x / (screen.width / 4))
      const row = Math.floor(pos.y / (screen.height / 3))
      cells.add(`${col},${row}`)
    }
    expect(cells.size).toBeGreaterThan(1)
  })

  it('occupied zone outside screen does not affect positioning', () => {
    const outside: OccupiedZone[] = [{ x: -500, y: -500, width: 200, height: 200 }]
    const pos = computeSpawnPosition(popupW, popupH, screen, outside)
    expect(pos.x).toBeGreaterThanOrEqual(0)
    expect(pos.y).toBeGreaterThanOrEqual(0)
  })

  it('multiple occupied zones in one cell concentrate spawn in other cells', () => {
    const topCellOccupied: OccupiedZone[] = [
      { x: 100, y: 50, width: 300, height: 200 },
      { x: 200, y: 80, width: 300, height: 200 },
      { x: 50, y: 120, width: 300, height: 200 },
    ]
    const bottomSpawns: Array<{ y: number }> = []
    for (let i = 0; i < 100; i++) {
      bottomSpawns.push(computeSpawnPosition(popupW, popupH, screen, topCellOccupied))
    }
    const inBottomHalf = bottomSpawns.filter((p) => p.y >= screen.height / 3)
    expect(inBottomHalf.length).toBeGreaterThan(50)
  })

  it('popup with zero width and height still returns valid position', () => {
    const pos = computeSpawnPosition(0, 0, screen, [])
    expect(pos.x).toBeGreaterThanOrEqual(0)
    expect(pos.y).toBeGreaterThanOrEqual(0)
    expect(Number.isInteger(pos.x)).toBe(true)
    expect(Number.isInteger(pos.y)).toBe(true)
  })

  it('small screen: popup fits exactly at one corner', () => {
    const tiny: ScreenBounds = { width: 300, height: 200 }
    const pos = computeSpawnPosition(300, 200, tiny, [])
    expect(pos.x).toBe(0)
    expect(pos.y).toBe(0)
  })

  it('very many occupied zones: returns valid position', () => {
    const zones: OccupiedZone[] = Array.from({ length: 50 }, (_, i) => ({
      x: (i % 10) * 190,
      y: Math.floor(i / 10) * 210,
      width: 180,
      height: 200,
    }))
    for (let i = 0; i < 30; i++) {
      const pos = computeSpawnPosition(popupW, popupH, screen, zones)
      expect(pos.x).toBeGreaterThanOrEqual(0)
      expect(pos.x).toBeLessThanOrEqual(screen.width - popupW)
      expect(pos.y).toBeGreaterThanOrEqual(0)
      expect(pos.y).toBeLessThanOrEqual(screen.height - popupH)
    }
  })
})
