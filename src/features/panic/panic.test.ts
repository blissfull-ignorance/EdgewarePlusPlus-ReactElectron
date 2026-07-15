import { describe, it, expect } from 'vitest'
import {
  computeLockoutEndTime,
  isLockoutActive,
  getRemainingMs,
  validateSafeword,
  levenshtein,
  shouldBlockPanic,
} from './panic'

describe('computeLockoutEndTime', () => {
  it('returns a timestamp in the future', () => {
    const before = Date.now()
    const result = computeLockoutEndTime(1)
    const after = Date.now()
    expect(result).toBeGreaterThan(before)
    expect(result).toBeGreaterThan(after)
  })

  it('scales with lockoutMinutes', () => {
    const short = computeLockoutEndTime(1)
    const long = computeLockoutEndTime(10)
    const diff = long - short
    expect(diff).toBeGreaterThan(0)
    expect(diff).toBeCloseTo(9 * 60 * 1000, -2)
  })

  it('clamps lockoutMinutes < 1 to 1 minute', () => {
    const result = computeLockoutEndTime(0)
    const expected = Date.now() + 1 * 60 * 1000
    expect(result).toBeGreaterThanOrEqual(expected - 100)
    expect(result).toBeLessThanOrEqual(expected + 100)
  })

  it('handles negative lockoutMinutes by clamping to 1', () => {
    const result = computeLockoutEndTime(-5)
    const expected = Date.now() + 1 * 60 * 1000
    expect(result).toBeGreaterThanOrEqual(expected - 100)
    expect(result).toBeLessThanOrEqual(expected + 100)
  })
})

describe('isLockoutActive', () => {
  it('returns false when lockoutEndTime is null', () => {
    expect(isLockoutActive(null)).toBe(false)
  })

  it('returns true when lockoutEndTime is in the future', () => {
    expect(isLockoutActive(Date.now() + 60000)).toBe(true)
  })

  it('returns false when lockoutEndTime is in the past', () => {
    expect(isLockoutActive(Date.now() - 1000)).toBe(false)
  })

  it('returns false when lockoutEndTime is exactly now', () => {
    expect(isLockoutActive(Date.now())).toBe(false)
  })
})

describe('getRemainingMs', () => {
  it('returns positive value for future end time', () => {
    const end = Date.now() + 5000
    const remaining = getRemainingMs(end)
    expect(remaining).toBeGreaterThan(0)
    expect(remaining).toBeLessThanOrEqual(5000)
  })

  it('returns 0 for past end time', () => {
    expect(getRemainingMs(Date.now() - 1000)).toBe(0)
  })

  it('returns 0 for end time exactly now', () => {
    expect(getRemainingMs(Date.now())).toBe(0)
  })

  it('decreases over time', () => {
    const end = Date.now() + 10000
    const r1 = getRemainingMs(end)
    const r2 = getRemainingMs(end)
    expect(r2).toBeLessThanOrEqual(r1)
  })
})

describe('validateSafeword', () => {
  it('returns true for exact match', () => {
    expect(validateSafeword('hello', 'hello')).toBe(true)
  })

  it('returns false for wrong input', () => {
    expect(validateSafeword('wrong', 'hello')).toBe(false)
  })

  it('is case-sensitive', () => {
    expect(validateSafeword('Hello', 'hello')).toBe(false)
  })

  it('returns true when safeword is empty', () => {
    expect(validateSafeword('anything', '')).toBe(true)
  })

  it('returns true for empty input matching empty safeword', () => {
    expect(validateSafeword('', '')).toBe(true)
  })

  it('returns false for empty input against non-empty safeword', () => {
    expect(validateSafeword('', 'hello')).toBe(false)
  })
})

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('hello', 'hello')).toBe(0)
  })

  it('returns 1 for single character substitution', () => {
    expect(levenshtein('hello', 'hallo')).toBe(1)
  })

  it('returns length of other string for empty first string', () => {
    expect(levenshtein('', 'abc')).toBe(3)
  })

  it('returns length of first string for empty second string', () => {
    expect(levenshtein('abc', '')).toBe(3)
  })

  it('returns 0 for both empty', () => {
    expect(levenshtein('', '')).toBe(0)
  })

  it('computes distance for insertion', () => {
    expect(levenshtein('cat', 'cats')).toBe(1)
  })

  it('computes distance for deletion', () => {
    expect(levenshtein('cats', 'cat')).toBe(1)
  })

  it('is symmetric', () => {
    expect(levenshtein('abc', 'xyz')).toBe(levenshtein('xyz', 'abc'))
  })

  it('handles single character strings', () => {
    expect(levenshtein('a', 'b')).toBe(1)
    expect(levenshtein('a', 'a')).toBe(0)
  })
})

describe('shouldBlockPanic', () => {
  it('returns false when already in panic mode', () => {
    expect(shouldBlockPanic(true, Date.now() + 60000)).toBe(false)
  })

  it('returns true when lockout is active and not in panic mode', () => {
    expect(shouldBlockPanic(false, Date.now() + 60000)).toBe(true)
  })

  it('returns false when lockout is not active', () => {
    expect(shouldBlockPanic(false, null)).toBe(false)
  })

  it('returns false when lockout has expired', () => {
    expect(shouldBlockPanic(false, Date.now() - 1000)).toBe(false)
  })

  it('returns false when in panic mode and lockout is active', () => {
    expect(shouldBlockPanic(true, Date.now() + 60000)).toBe(false)
  })
})
