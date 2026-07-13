import { describe, it, expect } from 'vitest'
import { computeMove, shouldMove } from './movement'
import type { PopupRect, ScreenBounds } from './movement'

describe('computeMove', () => {
  const screen: ScreenBounds = { width: 1920, height: 1080 }
  const popup: PopupRect = { x: 500, y: 400, width: 300, height: 200 }

  it('returns a position within screen bounds', () => {
    for (let i = 0; i < 200; i++) {
      const result = computeMove(popup, 50, screen)
      expect(result.x).toBeGreaterThanOrEqual(0)
      expect(result.x).toBeLessThanOrEqual(screen.width - popup.width)
      expect(result.y).toBeGreaterThanOrEqual(0)
      expect(result.y).toBeLessThanOrEqual(screen.height - popup.height)
    }
  })

  it('clamps to top-left corner when at origin', () => {
    const atOrigin: PopupRect = { x: 0, y: 0, width: 300, height: 200 }
    const result = computeMove(atOrigin, 10, screen)
    expect(result.x).toBeGreaterThanOrEqual(0)
    expect(result.y).toBeGreaterThanOrEqual(0)
  })

  it('clamps to bottom-right corner when at edge', () => {
    const atEdge: PopupRect = {
      x: screen.width - popup.width,
      y: screen.height - popup.height,
      width: popup.width,
      height: popup.height,
    }
    const result = computeMove(atEdge, 10, screen)
    expect(result.x).toBeLessThanOrEqual(screen.width - popup.width)
    expect(result.y).toBeLessThanOrEqual(screen.height - popup.height)
  })

  it('does not move when speed is 0', () => {
    const result = computeMove(popup, 0, screen)
    expect(result.x).toBe(popup.x)
    expect(result.y).toBe(popup.y)
  })

  it('moves within ±speed pixels', () => {
    const speed = 10
    for (let i = 0; i < 200; i++) {
      const result = computeMove(popup, speed, screen)
      const dx = Math.abs(result.x - popup.x)
      const dy = Math.abs(result.y - popup.y)
      expect(dx).toBeLessThanOrEqual(speed)
      expect(dy).toBeLessThanOrEqual(speed)
    }
  })

  it('produces varied positions with deterministic random', () => {
    const alwaysZero = () => 0
    const alwaysOne = () => 1
    const r1 = computeMove(popup, 5, screen, alwaysZero)
    const r2 = computeMove(popup, 5, screen, alwaysOne)
    expect(r1).not.toEqual(r2)
  })

  it('handles popup larger than screen gracefully', () => {
    const hugePopup: PopupRect = { x: 0, y: 0, width: 3000, height: 2000 }
    const result = computeMove(hugePopup, 10, screen)
    expect(result.x).toBe(0)
    expect(result.y).toBe(0)
  })
})

describe('shouldMove', () => {
  it('always moves at 100% chance', () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldMove(100)).toBe(true)
    }
  })

  it('never moves at 0% chance', () => {
    for (let i = 0; i < 100; i++) {
      expect(shouldMove(0)).toBe(false)
    }
  })

  it('moves when random value is below threshold', () => {
    const alwaysLow = () => 0.001
    expect(shouldMove(50, alwaysLow)).toBe(true)
  })

  it('does not move when random value is above threshold', () => {
    const alwaysHigh = () => 0.999
    expect(shouldMove(50, alwaysHigh)).toBe(false)
  })
})
