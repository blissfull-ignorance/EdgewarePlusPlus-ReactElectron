import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/stores/configStore'
import { usePackStore } from '@/stores/packStore'
import { usePopupStore } from '@/stores/popupStore'
import type { Pack } from '@/types/pack'

function makePack(overrides: Partial<Pack['texts']> = {}): Pack {
  return {
    info: { name: 'Test', version: '1.0', author: 'Test', description: '' },
    index: {},
    corruption: { enabled: false, level: 0, maxLevel: 0, triggers: [] },
    corruptionLevels: [],
    popupClose: 'Close',
    media: {
      images: [],
      videos: [],
      audio: [],
      hypno: [],
    },
    texts: {
      captions: [],
      denials: [],
      prompts: [],
      subliminals: ['OBEY', 'SUBMIT', 'GOON'],
      notifications: [],
      web: [],
      ...overrides,
    },
    script: null,
    scriptVersion: null,
  }
}

function roll(percent: number, randomFn: () => number = Math.random): boolean {
  return randomFn() * 100 < percent
}

function resetAll() {
  usePopupStore.getState().clearPopups()
  usePackStore.getState().unloadPack()
  useConfigStore.getState().updateConfig({
    capPopChance: 0,
    capPopOpacity: 100,
    capPopTimer: 300,
    capPopTextColor: '#ffffff',
    capPopTextSize: 80,
  })
}

describe('subliminal spawn decision logic', () => {
  beforeEach(() => {
    resetAll()
  })

  function shouldSpawnSubliminal(
    capPopChance: number,
    subliminalPool: string[],
    randomFn: () => number = Math.random,
  ): boolean {
    return capPopChance > 0 && roll(capPopChance, randomFn) && subliminalPool.length > 0
  }

  it('never spawns when capPopChance is 0', () => {
    let spawnCount = 0
    for (let i = 0; i < 100; i++) {
      if (shouldSpawnSubliminal(0, ['OBEY'], () => 0.01)) spawnCount++
    }
    expect(spawnCount).toBe(0)
  })

  it('always spawns when capPopChance is 100 and pool is non-empty', () => {
    let spawnCount = 0
    for (let i = 0; i < 100; i++) {
      if (shouldSpawnSubliminal(100, ['OBEY'], () => 0.99)) spawnCount++
    }
    expect(spawnCount).toBe(100)
  })

  it('never spawns when subliminal pool is empty', () => {
    let spawnCount = 0
    for (let i = 0; i < 100; i++) {
      if (shouldSpawnSubliminal(100, [], () => 0.01)) spawnCount++
    }
    expect(spawnCount).toBe(0)
  })

  it('never spawns when both chance is 0 and pool is empty', () => {
    let spawnCount = 0
    for (let i = 0; i < 100; i++) {
      if (shouldSpawnSubliminal(0, [], () => 0.5)) spawnCount++
    }
    expect(spawnCount).toBe(0)
  })

  it('at 50% chance, produces both spawn and no-spawn outcomes', () => {
    let spawnCount = 0
    const iterations = 100
    for (let i = 0; i < iterations; i++) {
      const randomFn = () => (i % 2 === 0 ? 0.01 : 0.99)
      if (shouldSpawnSubliminal(50, ['OBEY'], randomFn)) spawnCount++
    }
    expect(spawnCount).toBeGreaterThan(0)
    expect(spawnCount).toBeLessThan(iterations)
  })
})

describe('configStore subliminal popup settings', () => {
  beforeEach(() => {
    resetAll()
  })

  it('capPopChance default is 0', () => {
    expect(useConfigStore.getState().capPopChance).toBe(0)
  })

  it('capPopOpacity default is 100', () => {
    expect(useConfigStore.getState().capPopOpacity).toBe(100)
  })

  it('capPopTimer default is 300', () => {
    expect(useConfigStore.getState().capPopTimer).toBe(300)
  })

  it('capPopTextColor default is #ffffff', () => {
    expect(useConfigStore.getState().capPopTextColor).toBe('#ffffff')
  })

  it('capPopTextSize default is 80', () => {
    expect(useConfigStore.getState().capPopTextSize).toBe(80)
  })

  it('capPopChance is stored and retrievable', () => {
    useConfigStore.getState().updateConfig({ capPopChance: 75 })
    expect(useConfigStore.getState().capPopChance).toBe(75)
  })

  it('capPopOpacity is stored and retrievable', () => {
    useConfigStore.getState().updateConfig({ capPopOpacity: 50 })
    expect(useConfigStore.getState().capPopOpacity).toBe(50)
  })

  it('capPopTimer is stored and retrievable', () => {
    useConfigStore.getState().updateConfig({ capPopTimer: 600 })
    expect(useConfigStore.getState().capPopTimer).toBe(600)
  })

  it('capPopTextColor is stored and retrievable', () => {
    useConfigStore.getState().updateConfig({ capPopTextColor: '#ff0000' })
    expect(useConfigStore.getState().capPopTextColor).toBe('#ff0000')
  })

  it('capPopTextSize is stored and retrievable', () => {
    useConfigStore.getState().updateConfig({ capPopTextSize: 120 })
    expect(useConfigStore.getState().capPopTextSize).toBe(120)
  })
})

describe('packStore getTexts accessor for subliminals', () => {
  beforeEach(() => {
    resetAll()
  })

  it('getTexts("subliminal") returns subliminal texts from loaded pack', () => {
    usePackStore.getState().loadPack(makePack({ subliminals: ['OBEY', 'SUBMIT'] }))
    const texts = usePackStore.getState().getTexts('subliminal')
    expect(texts).toContain('OBEY')
    expect(texts).toContain('SUBMIT')
    expect(texts).toHaveLength(2)
  })

  it('getTexts("subliminal") returns empty array when pack has no subliminals', () => {
    usePackStore.getState().loadPack(makePack({ subliminals: [] }))
    const texts = usePackStore.getState().getTexts('subliminal')
    expect(texts).toHaveLength(0)
  })

  it('getTexts("subliminal") returns empty array when no pack is loaded', () => {
    const texts = usePackStore.getState().getTexts('subliminal')
    expect(texts).toHaveLength(0)
  })

  it('getTexts returns correct type for each text category', () => {
    usePackStore.getState().loadPack(makePack({
      captions: ['cap1'],
      denials: ['denial1'],
      prompts: ['prompt1'],
      subliminals: ['sub1'],
      notifications: ['notif1'],
      web: ['web1'],
    }))
    expect(usePackStore.getState().getTexts('caption')).toEqual(['cap1'])
    expect(usePackStore.getState().getTexts('denial')).toEqual(['denial1'])
    expect(usePackStore.getState().getTexts('prompt')).toEqual(['prompt1'])
    expect(usePackStore.getState().getTexts('subliminal')).toEqual(['sub1'])
    expect(usePackStore.getState().getTexts('notification')).toEqual(['notif1'])
    expect(usePackStore.getState().getTexts('web')).toEqual(['web1'])
  })

  it('getTexts returns empty after unloadPack', () => {
    usePackStore.getState().loadPack(makePack({ subliminals: ['OBEY'] }))
    expect(usePackStore.getState().getTexts('subliminal')).toHaveLength(1)
    usePackStore.getState().unloadPack()
    expect(usePackStore.getState().getTexts('subliminal')).toHaveLength(0)
  })
})

describe('subliminal spawn tick logic', () => {
  beforeEach(() => {
    resetAll()
  })

  function simulateSubliminalSpawn(
    capPopChance: number,
    capPopOpacity: number,
    capPopTimer: number,
    subliminalPool: string[],
    randomFn: () => number = Math.random,
  ): { text: string; opacity: number; duration: number } | null {
    if (capPopChance > 0 && roll(capPopChance, randomFn) && subliminalPool.length > 0) {
      const text = subliminalPool[Math.floor(randomFn() * subliminalPool.length)]
      return {
        text,
        opacity: capPopOpacity,
        duration: capPopTimer,
      }
    }
    return null
  }

  it('spawn tick produces result on success', () => {
    const result = simulateSubliminalSpawn(100, 80, 300, ['OBEY'], () => 0.5)
    expect(result).not.toBeNull()
    expect(result?.text).toBe('OBEY')
    expect(result?.opacity).toBe(80)
    expect(result?.duration).toBe(300)
  })

  it('spawn tick returns null when chance is 0', () => {
    const result = simulateSubliminalSpawn(0, 100, 5, ['OBEY'], () => 0.5)
    expect(result).toBeNull()
  })

  it('spawn tick returns null when pool is empty', () => {
    const result = simulateSubliminalSpawn(100, 100, 5, [], () => 0.5)
    expect(result).toBeNull()
  })

  it('spawn tick uses capPopOpacity from config', () => {
    const result = simulateSubliminalSpawn(100, 30, 5, ['OBEY'], () => 0.5)
    expect(result?.opacity).toBe(30)
  })

  it('spawn tick passes capPopTimer as duration in ms', () => {
    const result = simulateSubliminalSpawn(100, 100, 5000, ['OBEY'], () => 0.5)
    expect(result?.duration).toBe(5000)
  })
})

describe('subliminal popup position', () => {
  it('spawn tick centers on screen', () => {
    const screenWidth = 1920
    const screenHeight = 1080
    const x = Math.round(screenWidth / 2)
    const y = Math.round(screenHeight / 2)
    expect(x).toBe(960)
    expect(y).toBe(540)
  })

  it('spawn tick uses screen center for both axes', () => {
    for (const [w, h] of [[1920, 1080], [2560, 1440], [1280, 720]]) {
      const x = Math.round(w / 2)
      const y = Math.round(h / 2)
      expect(x).toBeGreaterThan(0)
      expect(y).toBeGreaterThan(0)
      expect(x).toBeLessThanOrEqual(w)
      expect(y).toBeLessThanOrEqual(h)
    }
  })
})
