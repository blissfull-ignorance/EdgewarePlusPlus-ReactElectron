import { describe, it, expect } from 'vitest'
import { shouldAutoClose, getExpiredPopupIds } from './timeout'
import type { TimeoutPopup } from './timeout'

describe('shouldAutoClose', () => {
  it('returns false when not enough time has elapsed', () => {
    expect(shouldAutoClose(1000, 5, 5000)).toBe(false)
  })

  it('returns true when exactly at the timeout', () => {
    expect(shouldAutoClose(1000, 5, 6000)).toBe(true)
  })

  it('returns true when past the timeout', () => {
    expect(shouldAutoClose(1000, 5, 10000)).toBe(true)
  })

  it('returns false when no time has elapsed', () => {
    expect(shouldAutoClose(5000, 10, 5000)).toBe(false)
  })

  it('handles 1-second timeout', () => {
    expect(shouldAutoClose(100, 1, 1100)).toBe(true)
    expect(shouldAutoClose(100, 1, 1099)).toBe(false)
  })

  it('handles 300-second (max) timeout', () => {
    const spawn = 0
    expect(shouldAutoClose(spawn, 300, 300000)).toBe(true)
    expect(shouldAutoClose(spawn, 300, 299999)).toBe(false)
  })

  it('handles large spawnTime values', () => {
    const spawn = 1700000000000
    expect(shouldAutoClose(spawn, 10, spawn + 10000)).toBe(true)
    expect(shouldAutoClose(spawn, 10, spawn + 9999)).toBe(false)
  })
})

describe('getExpiredPopupIds', () => {
  function makePopup(overrides: Partial<TimeoutPopup> = {}): TimeoutPopup {
    return {
      id: 1, type: 'image', spawnTime: 1000, ...overrides,
    }
  }

  it('returns empty array when no popups', () => {
    expect(getExpiredPopupIds([], 5, 10000)).toEqual([])
  })

  it('returns empty array when no popups are expired', () => {
    const popups = [
      makePopup({ id: 1, spawnTime: 9000, type: 'image' }),
      makePopup({ id: 2, spawnTime: 9500, type: 'video' }),
    ]
    expect(getExpiredPopupIds(popups, 5, 13000)).toEqual([])
  })

  it('returns expired image popup IDs', () => {
    const popups = [
      makePopup({ id: 1, spawnTime: 1000, type: 'image' }),
      makePopup({ id: 2, spawnTime: 9000, type: 'image' }),
    ]
    expect(getExpiredPopupIds(popups, 5, 10000)).toEqual([1])
  })

  it('returns expired video popup IDs', () => {
    const popups = [
      makePopup({ id: 1, spawnTime: 1000, type: 'video' }),
    ]
    expect(getExpiredPopupIds(popups, 5, 10000)).toEqual([1])
  })

  it('skips audio popups even when expired', () => {
    const popups = [
      makePopup({ id: 1, spawnTime: 1000, type: 'audio' }),
      makePopup({ id: 2, spawnTime: 2000, type: 'audio' }),
    ]
    expect(getExpiredPopupIds(popups, 5, 10000)).toEqual([])
  })

  it('mixes types: only image/video returned, audio excluded', () => {
    const popups = [
      makePopup({ id: 1, spawnTime: 1000, type: 'image' }),
      makePopup({ id: 2, spawnTime: 1000, type: 'audio' }),
      makePopup({ id: 3, spawnTime: 1000, type: 'video' }),
      makePopup({ id: 4, spawnTime: 1000, type: 'audio' }),
    ]
    expect(getExpiredPopupIds(popups, 5, 10000)).toEqual([1, 3])
  })

  it('returns multiple expired IDs in order', () => {
    const popups = [
      makePopup({ id: 5, spawnTime: 1000, type: 'image' }),
      makePopup({ id: 10, spawnTime: 2000, type: 'video' }),
      makePopup({ id: 15, spawnTime: 3000, type: 'image' }),
    ]
    expect(getExpiredPopupIds(popups, 5, 10000)).toEqual([5, 10, 15])
  })

  it('handles edge case: exactly at timeout boundary', () => {
    const popups = [
      makePopup({ id: 1, spawnTime: 5000, type: 'image' }),
    ]
    expect(getExpiredPopupIds(popups, 5, 10000)).toEqual([1])
    expect(getExpiredPopupIds(popups, 5, 9999)).toEqual([])
  })

  it('handles empty type list gracefully', () => {
    const popups = [
      makePopup({ id: 1, spawnTime: 0, type: 'audio' }),
      makePopup({ id: 2, spawnTime: 0, type: 'audio' }),
    ]
    expect(getExpiredPopupIds(popups, 1, 5000)).toEqual([])
  })
})
