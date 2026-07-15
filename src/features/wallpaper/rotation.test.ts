import { describe, it, expect } from 'vitest'
import {
  nextWallpaperIndex,
  computeInterval,
  shouldRotate,
  computeRotation,
} from './rotation'

describe('nextWallpaperIndex', () => {
  it('increments index by 1', () => {
    expect(nextWallpaperIndex(0, 5)).toBe(1)
    expect(nextWallpaperIndex(2, 5)).toBe(3)
  })

  it('wraps around to 0 at end of list', () => {
    expect(nextWallpaperIndex(4, 5)).toBe(0)
    expect(nextWallpaperIndex(9, 10)).toBe(0)
  })

  it('returns 0 for single wallpaper', () => {
    expect(nextWallpaperIndex(0, 1)).toBe(0)
  })

  it('returns 0 for empty list', () => {
    expect(nextWallpaperIndex(0, 0)).toBe(0)
  })

  it('returns 0 for negative list length', () => {
    expect(nextWallpaperIndex(0, -5)).toBe(0)
  })
})

describe('computeInterval', () => {
  it('returns base interval in ms when variance is 0', () => {
    expect(computeInterval(30, 0)).toBe(30000)
    expect(computeInterval(60, 0)).toBe(60000)
  })

  it('result is within ±variance of base interval', () => {
    const base = 60
    const variance = 6
    for (let i = 0; i < 100; i++) {
      const result = computeInterval(base, variance)
      expect(result).toBeGreaterThanOrEqual(Math.round((base - variance) * 1000))
      expect(result).toBeLessThanOrEqual(Math.round((base + variance) * 1000))
    }
  })

  it('clamps to minimum 1000ms', () => {
    expect(computeInterval(0, 0)).toBe(1000)
    expect(computeInterval(-10, 0)).toBe(1000)
  })

  it('ignores negative variance', () => {
    const result = computeInterval(30, -5)
    expect(result).toBe(30000)
  })
})

describe('shouldRotate', () => {
  it('returns true when enabled and multiple wallpapers', () => {
    expect(shouldRotate(true, 2)).toBe(true)
    expect(shouldRotate(true, 10)).toBe(true)
  })

  it('returns false when disabled', () => {
    expect(shouldRotate(false, 5)).toBe(false)
  })

  it('returns false with single wallpaper even if enabled', () => {
    expect(shouldRotate(true, 1)).toBe(false)
  })

  it('returns false with empty list', () => {
    expect(shouldRotate(true, 0)).toBe(false)
  })
})

describe('computeRotation', () => {
  it('returns next index and interval when enabled with multiple wallpapers', () => {
    const result = computeRotation(
      { currentIndex: 0, enabled: true, interval: 30, variance: 0 },
      5,
    )
    expect(result).not.toBeNull()
    expect(result!.nextIndex).toBe(1)
    expect(result!.intervalMs).toBe(30000)
  })

  it('returns null when rotation is disabled', () => {
    const result = computeRotation(
      { currentIndex: 0, enabled: false, interval: 30, variance: 0 },
      5,
    )
    expect(result).toBeNull()
  })

  it('returns null with single wallpaper', () => {
    const result = computeRotation(
      { currentIndex: 0, enabled: true, interval: 30, variance: 0 },
      1,
    )
    expect(result).toBeNull()
  })

  it('returns null with empty list', () => {
    const result = computeRotation(
      { currentIndex: 0, enabled: true, interval: 30, variance: 0 },
      0,
    )
    expect(result).toBeNull()
  })

  it('wraps index at end of list', () => {
    const result = computeRotation(
      { currentIndex: 4, enabled: true, interval: 60, variance: 0 },
      5,
    )
    expect(result).not.toBeNull()
    expect(result!.nextIndex).toBe(0)
  })

  it('applies variance to interval', () => {
    const results = Array.from({ length: 100 }, () =>
      computeRotation(
        { currentIndex: 0, enabled: true, interval: 60, variance: 6 },
        5,
      ),
    )
    const intervals = results.map((r) => r!.intervalMs)
    const min = Math.min(...intervals)
    const max = Math.max(...intervals)
    expect(min).toBeGreaterThanOrEqual(54000)
    expect(max).toBeLessThanOrEqual(66000)
  })
})
