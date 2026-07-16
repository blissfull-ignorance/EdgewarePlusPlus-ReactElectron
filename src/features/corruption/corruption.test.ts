import { describe, it, expect } from 'vitest'
import {
  computeCorruptionTick,
  nextCorruptionLevel,
  computeMoodChanges,
  resolveActiveMoods,
  computeFadeMoods,
  getConfigOverrides,
  computeCorruptionProgress,
  filterMediaByMood,
  CORRUPTION_BLOCK,
} from './corruption'
import type { CorruptionLevelData } from './corruption'

const makeLevel = (overrides: Partial<CorruptionLevelData> = {}): CorruptionLevelData => ({
  addedMoods: [], removedMoods: [], wallpaper: null, config: {}, ...overrides,
})

describe('computeCorruptionTick', () => {
  it('advances level when delta meets rate', () => {
    expect(computeCorruptionTick(0, 60000, 60000)).toBe(1)
  })

  it('does not advance when delta is below rate', () => {
    expect(computeCorruptionTick(0, 30000, 60000)).toBe(0)
  })

  it('advances by exactly one level', () => {
    expect(computeCorruptionTick(3, 120000, 60000)).toBe(4)
  })

  it('does not advance when rate is 0', () => {
    expect(computeCorruptionTick(5, 999999, 0)).toBe(5)
  })

  it('does not advance when delta is 0', () => {
    expect(computeCorruptionTick(2, 0, 60000)).toBe(2)
  })

  it('does not advance when delta is negative', () => {
    expect(computeCorruptionTick(2, -1000, 60000)).toBe(2)
  })
})

describe('nextCorruptionLevel', () => {
  it('increments in normal mode', () => {
    expect(nextCorruptionLevel(3, 10, false)).toBe(4)
  })

  it('clamps at maxLevel in normal mode', () => {
    expect(nextCorruptionLevel(10, 10, false)).toBe(10)
  })

  it('decrements in purity mode', () => {
    expect(nextCorruptionLevel(5, 10, true)).toBe(4)
  })

  it('clamps at 1 in purity mode', () => {
    expect(nextCorruptionLevel(1, 10, true)).toBe(1)
  })

  it('handles maxLevel of 1 in normal mode', () => {
    expect(nextCorruptionLevel(1, 1, false)).toBe(1)
  })

  it('handles maxLevel of 1 in purity mode', () => {
    expect(nextCorruptionLevel(1, 1, true)).toBe(1)
  })
})

describe('computeMoodChanges', () => {
  const levels: CorruptionLevelData[] = [
    makeLevel({ addedMoods: ['a', 'b'], removedMoods: [] }),
    makeLevel({ addedMoods: ['c'], removedMoods: ['a'] }),
    makeLevel({ addedMoods: ['d'], removedMoods: ['b', 'c'] }),
  ]

  it('returns empty for level 0', () => {
    const result = computeMoodChanges(levels, 0)
    expect(result.added).toEqual([])
    expect(result.removed).toEqual([])
  })

  it('returns only level 1 changes for level 1', () => {
    const result = computeMoodChanges(levels, 1)
    expect(result.added).toEqual(expect.arrayContaining(['a', 'b']))
    expect(result.removed).toEqual([])
  })

  it('accumulates changes across levels', () => {
    const result = computeMoodChanges(levels, 2)
    expect(result.added).toEqual(expect.arrayContaining(['a', 'b', 'c']))
    expect(result.removed).toEqual(expect.arrayContaining(['a']))
  })

  it('fully accumulates at level 3', () => {
    const result = computeMoodChanges(levels, 3)
    expect(result.added).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd']))
    expect(result.removed).toEqual(expect.arrayContaining(['a', 'b', 'c']))
  })

  it('handles level beyond array length', () => {
    const result = computeMoodChanges(levels, 99)
    expect(result.added).toEqual(expect.arrayContaining(['a', 'b', 'c', 'd']))
  })

  it('deduplicates moods', () => {
    const dupeLevels: CorruptionLevelData[] = [
      makeLevel({ addedMoods: ['x'], removedMoods: [] }),
      makeLevel({ addedMoods: ['x'], removedMoods: [] }),
    ]
    const result = computeMoodChanges(dupeLevels, 2)
    expect(result.added.filter((m) => m === 'x')).toHaveLength(1)
  })
})

describe('resolveActiveMoods', () => {
  const levels: CorruptionLevelData[] = [
    makeLevel({ addedMoods: ['a', 'b'], removedMoods: [] }),
    makeLevel({ addedMoods: ['c'], removedMoods: ['a'] }),
  ]

  it('returns base moods at level 0', () => {
    const result = resolveActiveMoods(['base1', 'base2'], levels, 0)
    expect(result).toEqual(expect.arrayContaining(['base1', 'base2']))
  })

  it('adds level 1 moods to base', () => {
    const result = resolveActiveMoods(['base1'], levels, 1)
    expect(result).toEqual(expect.arrayContaining(['base1', 'a', 'b']))
  })

  it('applies removals from level 2', () => {
    const result = resolveActiveMoods(['base1', 'a'], levels, 2)
    expect(result).toContain('base1')
    expect(result).toContain('c')
    expect(result).not.toContain('a')
  })

  it('handles empty base moods', () => {
    const result = resolveActiveMoods([], levels, 1)
    expect(result).toEqual(expect.arrayContaining(['a', 'b']))
  })

  it('handles empty levels array', () => {
    const result = resolveActiveMoods(['base'], [], 5)
    expect(result).toEqual(['base'])
  })
})

describe('computeFadeMoods', () => {
  const currentMoods = ['a', 'b']
  const nextLevel: CorruptionLevelData = makeLevel({
    addedMoods: ['c'], removedMoods: ['a'],
  })

  it('returns current moods for Abrupt fade', () => {
    const result = computeFadeMoods('Abrupt', currentMoods, nextLevel)
    expect(result).toEqual(['a', 'b'])
  })

  it('merges next-level moods for Normal fade', () => {
    const result = computeFadeMoods('Normal', currentMoods, nextLevel)
    expect(result).toContain('b')
    expect(result).toContain('c')
    expect(result).not.toContain('a')
  })

  it('returns current moods when nextLevel is null', () => {
    const result = computeFadeMoods('Normal', currentMoods, null)
    expect(result).toEqual(['a', 'b'])
  })

  it('returns current moods for unknown fade type', () => {
    const result = computeFadeMoods('Glitch', currentMoods, nextLevel)
    expect(result).toEqual(['a', 'b'])
  })
})

describe('getConfigOverrides', () => {
  const levels: CorruptionLevelData[] = [
    makeLevel({ config: { promptMod: 0 } }),
    makeLevel({ config: { promptMod: 5, denialChance: 20 } }),
    makeLevel({ config: { promptMod: 10, packPath: '/evil' } }),
  ]

  it('returns empty at level 0', () => {
    expect(getConfigOverrides(levels, 0)).toEqual({})
  })

  it('returns level 1 config at level 1', () => {
    const result = getConfigOverrides(levels, 1)
    expect(result.promptMod).toBe(0)
  })

  it('accumulates config from multiple levels', () => {
    const result = getConfigOverrides(levels, 2)
    expect(result.promptMod).toBe(5)
    expect(result.denialChance).toBe(20)
  })

  it('later levels overwrite earlier ones', () => {
    const result = getConfigOverrides(levels, 3)
    expect(result.promptMod).toBe(10)
  })

  it('blocks CORRUPTION_BLOCK keys', () => {
    const result = getConfigOverrides(levels, 3)
    expect(result.packPath).toBeUndefined()
  })

  it('handles empty levels', () => {
    expect(getConfigOverrides([], 5)).toEqual({})
  })
})

describe('CORRUPTION_BLOCK', () => {
  it('contains packPath', () => {
    expect(CORRUPTION_BLOCK.has('packPath')).toBe(true)
  })

  it('contains corruptionMode', () => {
    expect(CORRUPTION_BLOCK.has('corruptionMode')).toBe(true)
  })

  it('does not contain promptMod', () => {
    expect(CORRUPTION_BLOCK.has('promptMod')).toBe(false)
  })

  it('does not contain denialChance', () => {
    expect(CORRUPTION_BLOCK.has('denialChance')).toBe(false)
  })
})

describe('computeCorruptionProgress', () => {
  it('computes timed progress correctly', () => {
    const progress = computeCorruptionProgress(
      'Timed', 30000, 0, 60000, 0, 0, 0, 0, 1,
    )
    expect(progress).toBeCloseTo(0.5, 5)
  })

  it('computes popup progress correctly', () => {
    const progress = computeCorruptionProgress(
      'Popup', 0, 0, 0, 3, 10, 0, 0, 1,
    )
    expect(progress).toBeCloseTo(0.3, 5)
  })

  it('computes launch progress correctly', () => {
    const progress = computeCorruptionProgress(
      'Launch', 0, 0, 0, 0, 0, 3, 10, 1,
    )
    expect(progress).toBeCloseTo(0.3, 5) // 3 / (10 * max(1,1)) = 3/10 = 0.3
  })

  it('returns 0 for Script trigger', () => {
    const progress = computeCorruptionProgress(
      'Script', 0, 0, 0, 0, 0, 0, 0, 1,
    )
    expect(progress).toBe(0)
  })

  it('clamps to 0 minimum', () => {
    const progress = computeCorruptionProgress(
      'Timed', 0, 60000, 60000, 0, 0, 0, 0, 1,
    )
    expect(progress).toBe(0)
  })

  it('clamps to 1.0 maximum', () => {
    const progress = computeCorruptionProgress(
      'Timed', 120000, 0, 60000, 0, 0, 0, 0, 1,
    )
    expect(progress).toBe(1)
  })

  it('handles zero thresholds gracefully', () => {
    expect(computeCorruptionProgress('Popup', 0, 0, 0, 5, 0, 0, 0, 1)).toBe(0)
    expect(computeCorruptionProgress('Timed', 5000, 0, 0, 0, 0, 0, 0, 1)).toBe(0)
    expect(computeCorruptionProgress('Launch', 0, 0, 0, 0, 0, 5, 0, 1)).toBe(0)
  })
})

describe('filterMediaByMood', () => {
  const media = ['/a.png', '/b.mp3', '/c.jpg', '/d.ogg', '/e.webm']
  const lookup = new Map([
    ['/a.png', 'furry'],
    ['/b.mp3', 'goon'],
    ['/c.jpg', 'scare'],
    ['/d.ogg', 'denial'],
  ])

  it('returns all media when activeMoods is empty', () => {
    expect(filterMediaByMood(media, [], lookup)).toEqual(media)
  })

  it('filters to matching moods only (includes untagged)', () => {
    const result = filterMediaByMood(media, ['furry', 'goon'], lookup)
    expect(result).toEqual(['/a.png', '/b.mp3', '/e.webm'])
  })

  it('includes media with no mood tag', () => {
    const result = filterMediaByMood(media, ['hypno'], lookup)
    expect(result).toEqual(['/e.webm'])
  })

  it('includes untagged media when mood matches', () => {
    const result = filterMediaByMood(media, ['furry'], lookup)
    expect(result).toContain('/a.png')
    expect(result).toContain('/e.webm')
  })

  it('returns empty when no moods match', () => {
    const result = filterMediaByMood(media, ['nonexistent'], lookup)
    expect(result).toEqual(['/e.webm'])
  })

  it('returns empty for empty media array', () => {
    expect(filterMediaByMood([], ['furry'], lookup)).toEqual([])
  })

  it('includes all media when lookup is empty (all untagged)', () => {
    expect(filterMediaByMood(media, ['furry'], new Map())).toEqual(media)
  })
})
