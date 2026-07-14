import { describe, it, expect } from 'vitest'
import {
  hibernateDelay,
  planActivity,
  isHibernating,
  shouldResetWallpaper,
} from './hibernate'

describe('hibernateDelay', () => {
  it('returns a value within [min, max] range in milliseconds', () => {
    const min = 240
    const max = 300
    for (let i = 0; i < 50; i++) {
      const result = hibernateDelay(min, max)
      expect(result).toBeGreaterThanOrEqual(min * 1000)
      expect(result).toBeLessThanOrEqual(max * 1000)
    }
  })

  it('returns 0 when min and max are 0', () => {
    expect(hibernateDelay(0, 0)).toBe(0)
  })

  it('handles min > max by clamping', () => {
    const result = hibernateDelay(300, 100)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(300 * 1000)
  })

  it('handles negative min by clamping to 0', () => {
    const result = hibernateDelay(-100, 50)
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(50 * 1000)
  })

  it('returns multiples of 1000 (seconds to ms)', () => {
    const result = hibernateDelay(100, 200)
    expect(result % 1000).toBe(0)
  })
})

describe('planActivity', () => {
  describe('Original type', () => {
    it('returns ActivityTick[] with delays in [0, 3000] and count=1', () => {
      const ticks = planActivity('Original', 15, 20)
      expect(ticks.length).toBeGreaterThanOrEqual(1)
      for (const tick of ticks) {
        expect(tick.delay).toBeGreaterThanOrEqual(0)
        expect(tick.delay).toBeLessThanOrEqual(3000)
        expect(tick.count).toBe(1)
      }
    })

    it('respects wakeupActivity range for total spawns', () => {
      const ticks = planActivity('Original', 15, 10)
      expect(ticks.length).toBeGreaterThanOrEqual(1)
      expect(ticks.length).toBeLessThanOrEqual(10)
    })

    it('handles wakeupActivity=1', () => {
      const ticks = planActivity('Original', 15, 1)
      expect(ticks.length).toBe(1)
    })

    it('handles wakeupActivity=0 with floor of 1', () => {
      const ticks = planActivity('Original', 15, 0)
      expect(ticks.length).toBe(1)
    })
  })

  describe('Spaced type', () => {
    it('returns exactly wakeupActivity ticks', () => {
      const ticks = planActivity('Spaced', 15, 20)
      expect(ticks.length).toBe(20)
    })

    it('has delays in ascending order', () => {
      const ticks = planActivity('Spaced', 15, 10)
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i].delay).toBeGreaterThanOrEqual(ticks[i - 1].delay)
      }
    })

    it('has count=1 for all ticks', () => {
      const ticks = planActivity('Spaced', 15, 5)
      for (const tick of ticks) {
        expect(tick.count).toBe(1)
      }
    })

    it('first tick delay is 0', () => {
      const ticks = planActivity('Spaced', 15, 10)
      expect(ticks[0].delay).toBe(0)
    })

    it('handles wakeupActivity=1', () => {
      const ticks = planActivity('Spaced', 15, 1)
      expect(ticks.length).toBe(1)
      expect(ticks[0].delay).toBe(0)
    })

    it('handles hibernateLength=0 (minimum interval of 50ms)', () => {
      const ticks = planActivity('Spaced', 0, 5)
      expect(ticks.length).toBe(5)
      for (const tick of ticks) {
        expect(tick.delay).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('Glitch type', () => {
    it('returns ActivityTick[] with count=1', () => {
      const ticks = planActivity('Glitch', 15, 20)
      expect(ticks.length).toBeGreaterThanOrEqual(1)
      for (const tick of ticks) {
        expect(tick.count).toBe(1)
        expect(tick.delay).toBeGreaterThanOrEqual(0)
      }
    })

    it('caps at wakeupActivity * 2 ticks', () => {
      const ticks = planActivity('Glitch', 15, 10)
      expect(ticks.length).toBeLessThanOrEqual(20)
    })

    it('handles hibernateLength=0', () => {
      const ticks = planActivity('Glitch', 0, 10)
      expect(ticks.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Ramp type', () => {
    it('returns exactly wakeupActivity ticks', () => {
      const ticks = planActivity('Ramp', 15, 20)
      expect(ticks.length).toBe(20)
    })

    it('has delays in ascending order (ramping up)', () => {
      const ticks = planActivity('Ramp', 15, 10)
      for (let i = 1; i < ticks.length; i++) {
        expect(ticks[i].delay).toBeGreaterThanOrEqual(ticks[i - 1].delay)
      }
    })

    it('first tick is at delay 0', () => {
      const ticks = planActivity('Ramp', 15, 10)
      expect(ticks[0].delay).toBe(0)
    })

    it('last tick is at max delay (hibernateLength * 1000)', () => {
      const ticks = planActivity('Ramp', 15, 10)
      expect(ticks[ticks.length - 1].delay).toBe(15000)
    })

    it('has count=1 for all ticks', () => {
      const ticks = planActivity('Ramp', 15, 5)
      for (const tick of ticks) {
        expect(tick.count).toBe(1)
      }
    })

    it('handles wakeupActivity=1', () => {
      const ticks = planActivity('Ramp', 15, 1)
      expect(ticks.length).toBe(1)
      expect(ticks[0].delay).toBe(0)
    })

    it('handles hibernateLength=0', () => {
      const ticks = planActivity('Ramp', 0, 5)
      expect(ticks.length).toBe(5)
      for (const tick of ticks) {
        expect(tick.delay).toBe(0)
      }
    })
  })

  describe('Pump-Scare type', () => {
    it('returns a single tick at delay 0 with count 1', () => {
      const ticks = planActivity('Pump-Scare', 15, 20)
      expect(ticks.length).toBe(1)
      expect(ticks[0].delay).toBe(0)
      expect(ticks[0].count).toBe(1)
    })

    it('ignores hibernateLength and wakeupActivity', () => {
      const ticks = planActivity('Pump-Scare', 0, 0)
      expect(ticks.length).toBe(1)
      expect(ticks[0].delay).toBe(0)
    })
  })

  describe('Chaos type', () => {
    it('delegates to one of the other 5 types', () => {
      const validResults = new Set<string>()

      for (let i = 0; i < 100; i++) {
        const ticks = planActivity('Chaos', 15, 20)
        expect(ticks.length).toBeGreaterThanOrEqual(1)

        if (ticks.length === 1 && ticks[0].delay === 0) {
          validResults.add('Pump-Scare')
        } else if (ticks.length === 20 && ticks[0].delay === 0) {
          validResults.add('Spaced-or-Ramp')
        } else if (ticks.every((t) => t.delay <= 3000 && t.count === 1)) {
          validResults.add('Original')
        } else {
          validResults.add('Glitch-or-Other')
        }
      }
      expect(validResults.size).toBeGreaterThan(1)
    })
  })
})

describe('isHibernating', () => {
  it('returns true when hibernateMode is true', () => {
    expect(isHibernating(true)).toBe(true)
  })

  it('returns false when hibernateMode is false', () => {
    expect(isHibernating(false)).toBe(false)
  })
})

describe('shouldResetWallpaper', () => {
  it('returns true when all conditions met', () => {
    expect(shouldResetWallpaper(true, 0, false)).toBe(true)
  })

  it('returns false when fixWallpaper is off', () => {
    expect(shouldResetWallpaper(false, 0, false)).toBe(false)
  })

  it('returns false when popups are active', () => {
    expect(shouldResetWallpaper(true, 3, false)).toBe(false)
  })

  it('returns false when hibernate is active', () => {
    expect(shouldResetWallpaper(true, 0, true)).toBe(false)
  })

  it('returns false when all不利 conditions met', () => {
    expect(shouldResetWallpaper(false, 5, true)).toBe(false)
  })

  it('returns false when only fixWallpaper is off but other conditions are met', () => {
    expect(shouldResetWallpaper(false, 0, false)).toBe(false)
  })

  it('returns false when fixWallpaper is on but popups active and hibernate active', () => {
    expect(shouldResetWallpaper(true, 1, true)).toBe(false)
  })

  it('returns true when fixWallpaper on, popups=0, hibernate not active', () => {
    expect(shouldResetWallpaper(true, 0, false)).toBe(true)
  })
})
