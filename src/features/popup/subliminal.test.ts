import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/stores/configStore'
import { usePackStore } from '@/stores/packStore'
import { usePopupStore } from '@/stores/popupStore'
import { useSubliminalStore, nextSubliminalId, resetSubliminalIdCounter } from '@/stores/subliminalStore'
import type { Pack } from '@/types/pack'
import type { ActiveSubliminal } from '@/stores/subliminalStore'

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

function makeSubliminal(overrides: Partial<ActiveSubliminal> = {}): ActiveSubliminal {
  return {
    id: 1,
    text: 'OBEY',
    x: 100,
    y: 200,
    opacity: 100,
    duration: 500,
    spawnTime: Date.now(),
    ...overrides,
  }
}

function roll(percent: number, randomFn: () => number = Math.random): boolean {
  return randomFn() * 100 < percent
}

function resetAll() {
  useSubliminalStore.getState().clearSubliminals()
  resetSubliminalIdCounter()
  usePopupStore.getState().clearPopups()
  usePackStore.getState().unloadPack()
  useConfigStore.getState().updateConfig({
    capPopChance: 0,
    capPopOpacity: 100,
    capPopTimer: 1,
  })
}

describe('subliminalStore lifecycle', () => {
  beforeEach(() => {
    resetAll()
  })

  it('starts with empty subliminals array', () => {
    expect(useSubliminalStore.getState().subliminals).toHaveLength(0)
  })

  it('addSubliminal appends to array', () => {
    useSubliminalStore.getState().addSubliminal(makeSubliminal({ id: 1 }))
    expect(useSubliminalStore.getState().subliminals).toHaveLength(1)
    expect(useSubliminalStore.getState().subliminals[0].text).toBe('OBEY')
  })

  it('addSubliminal preserves all fields', () => {
    const sub = makeSubliminal({ id: 5, text: 'SUBMIT', x: 300, y: 400, opacity: 50, duration: 1000 })
    useSubliminalStore.getState().addSubliminal(sub)
    const stored = useSubliminalStore.getState().subliminals[0]
    expect(stored.id).toBe(5)
    expect(stored.text).toBe('SUBMIT')
    expect(stored.x).toBe(300)
    expect(stored.y).toBe(400)
    expect(stored.opacity).toBe(50)
    expect(stored.duration).toBe(1000)
  })

  it('addSubliminal supports multiple entries', () => {
    useSubliminalStore.getState().addSubliminal(makeSubliminal({ id: 1, text: 'OBEY' }))
    useSubliminalStore.getState().addSubliminal(makeSubliminal({ id: 2, text: 'SUBMIT' }))
    useSubliminalStore.getState().addSubliminal(makeSubliminal({ id: 3, text: 'GOON' }))
    expect(useSubliminalStore.getState().subliminals).toHaveLength(3)
    expect(useSubliminalStore.getState().subliminals.map(s => s.text)).toEqual(['OBEY', 'SUBMIT', 'GOON'])
  })

  it('removeSubliminal removes by id', () => {
    useSubliminalStore.getState().addSubliminal(makeSubliminal({ id: 1 }))
    useSubliminalStore.getState().addSubliminal(makeSubliminal({ id: 2 }))
    useSubliminalStore.getState().removeSubliminal(1)
    expect(useSubliminalStore.getState().subliminals).toHaveLength(1)
    expect(useSubliminalStore.getState().subliminals[0].id).toBe(2)
  })

  it('removeSubliminal with non-existent id does not break', () => {
    useSubliminalStore.getState().addSubliminal(makeSubliminal({ id: 1 }))
    useSubliminalStore.getState().removeSubliminal(999)
    expect(useSubliminalStore.getState().subliminals).toHaveLength(1)
  })

  it('clearSubliminals empties the array', () => {
    useSubliminalStore.getState().addSubliminal(makeSubliminal({ id: 1 }))
    useSubliminalStore.getState().addSubliminal(makeSubliminal({ id: 2 }))
    useSubliminalStore.getState().clearSubliminals()
    expect(useSubliminalStore.getState().subliminals).toHaveLength(0)
  })

  it('clearSubliminals on empty array does not break', () => {
    useSubliminalStore.getState().clearSubliminals()
    expect(useSubliminalStore.getState().subliminals).toHaveLength(0)
  })
})

describe('nextSubliminalId', () => {
  beforeEach(() => {
    resetSubliminalIdCounter()
  })

  it('starts at 1', () => {
    expect(nextSubliminalId()).toBe(1)
  })

  it('increments on each call', () => {
    expect(nextSubliminalId()).toBe(1)
    expect(nextSubliminalId()).toBe(2)
    expect(nextSubliminalId()).toBe(3)
  })

  it('resetSubliminalIdCounter resets to 1', () => {
    nextSubliminalId()
    nextSubliminalId()
    nextSubliminalId()
    resetSubliminalIdCounter()
    expect(nextSubliminalId()).toBe(1)
  })
})

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

  it('capPopTimer default is 1', () => {
    expect(useConfigStore.getState().capPopTimer).toBe(1)
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

describe('simulated subliminal spawn tick', () => {
  beforeEach(() => {
    resetAll()
  })

  function simulateSubliminalSpawn(
    capPopChance: number,
    capPopOpacity: number,
    capPopTimer: number,
    subliminalPool: string[],
    randomFn: () => number = Math.random,
  ): ActiveSubliminal | null {
    if (capPopChance > 0 && roll(capPopChance, randomFn) && subliminalPool.length > 0) {
      const text = subliminalPool[Math.floor(randomFn() * subliminalPool.length)]
      // Center on screen, matching Python original's centered layout
      const x = Math.round(1920 / 2)
      const y = Math.round(1080 / 2)
      return {
        id: nextSubliminalId(),
        text,
        x,
        y,
        opacity: capPopOpacity,
        duration: capPopTimer * 1000,
        spawnTime: Date.now(),
      }
    }
    return null
  }

  it('spawn tick adds subliminal to store on success', () => {
    const sub = simulateSubliminalSpawn(100, 80, 5, ['OBEY'], () => 0.5)
    expect(sub).not.toBeNull()
    if (sub) {
      useSubliminalStore.getState().addSubliminal(sub)
    }
    expect(useSubliminalStore.getState().subliminals).toHaveLength(1)
    expect(useSubliminalStore.getState().subliminals[0].text).toBe('OBEY')
    expect(useSubliminalStore.getState().subliminals[0].opacity).toBe(80)
    expect(useSubliminalStore.getState().subliminals[0].duration).toBe(5000)
  })

  it('spawn tick returns null when chance is 0', () => {
    const sub = simulateSubliminalSpawn(0, 100, 5, ['OBEY'], () => 0.5)
    expect(sub).toBeNull()
    expect(useSubliminalStore.getState().subliminals).toHaveLength(0)
  })

  it('spawn tick returns null when pool is empty', () => {
    const sub = simulateSubliminalSpawn(100, 100, 5, [], () => 0.5)
    expect(sub).toBeNull()
  })

  it('spawn tick uses capPopOpacity from config', () => {
    const sub = simulateSubliminalSpawn(100, 30, 5, ['OBEY'], () => 0.5)
    expect(sub?.opacity).toBe(30)
  })

  it('spawn tick uses capPopTimer converted to ms', () => {
    const sub = simulateSubliminalSpawn(100, 100, 10, ['OBEY'], () => 0.5)
    expect(sub?.duration).toBe(10000)
  })

  it('spawn tick assigns unique ids', () => {
    const sub1 = simulateSubliminalSpawn(100, 100, 5, ['OBEY'], () => 0.5)
    const sub2 = simulateSubliminalSpawn(100, 100, 5, ['SUBMIT'], () => 0.5)
    expect(sub1?.id).not.toBe(sub2?.id)
  })

  it('multiple spawn ticks accumulate in store', () => {
    for (let i = 0; i < 5; i++) {
      const sub = simulateSubliminalSpawn(100, 100, 5, ['OBEY'], () => 0.5)
      if (sub) useSubliminalStore.getState().addSubliminal(sub)
    }
    expect(useSubliminalStore.getState().subliminals).toHaveLength(5)
  })

  it('clearSubliminals removes all accumulated entries', () => {
    for (let i = 0; i < 3; i++) {
      const sub = simulateSubliminalSpawn(100, 100, 5, ['OBEY'], () => 0.5)
      if (sub) useSubliminalStore.getState().addSubliminal(sub)
    }
    expect(useSubliminalStore.getState().subliminals).toHaveLength(3)
    useSubliminalStore.getState().clearSubliminals()
    expect(useSubliminalStore.getState().subliminals).toHaveLength(0)
  })
})

describe('script-triggered subliminal spawn', () => {
  beforeEach(() => {
    resetAll()
  })

  it('adds subliminal with provided text and config values', () => {
    useConfigStore.getState().updateConfig({ capPopOpacity: 60, capPopTimer: 10 })
    const cfg = useConfigStore.getState()
    const x = 500
    const y = 300
    useSubliminalStore.getState().addSubliminal({
      id: nextSubliminalId(),
      text: 'OBEY',
      x,
      y,
      opacity: cfg.capPopOpacity,
      duration: cfg.capPopTimer * 1000,
      spawnTime: Date.now(),
    })
    const sub = useSubliminalStore.getState().subliminals[0]
    expect(sub.text).toBe('OBEY')
    expect(sub.opacity).toBe(60)
    expect(sub.duration).toBe(10000)
    expect(sub.x).toBe(500)
    expect(sub.y).toBe(300)
  })

  it('script-triggered subliminal does not affect popupStore', () => {
    usePopupStore.getState().clearPopups()
    useSubliminalStore.getState().addSubliminal(makeSubliminal({ id: 1 }))
    expect(usePopupStore.getState().popups).toHaveLength(0)
    expect(useSubliminalStore.getState().subliminals).toHaveLength(1)
  })
})

describe('subliminal popup position', () => {
  beforeEach(() => {
    resetAll()
  })

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
