import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/stores/configStore'
import { usePackStore } from '@/stores/packStore'
import { usePopupStore } from '@/stores/popupStore'
import type { Pack } from '@/types/pack'

/**
 * Pack factory for hypno tests. Provides a fully populated Pack with sensible
 * defaults — override any media field via the overrides parameter.
 */
function makePack(overrides: Partial<Pack['media']> = {}): Pack {
  return {
    info: { name: 'Test', version: '1.0', author: 'Test', description: '' },
    index: {},
    corruption: { enabled: false, level: 0, maxLevel: 0, triggers: [] },
    popupClose: 'Close',
    media: {
      images: ['/pack/img/a.png', '/pack/img/b.gif'],
      videos: ['/pack/vid/c.mp4'],
      audio: [],
      hypno: ['/pack/hypno/swirl.gif'],
      ...overrides,
    },
    texts: {
      captions: [], denials: [], prompts: [], subliminals: [],
      notifications: [], web: [],
    },
    script: null,
    scriptVersion: null,
  }
}

/** Reset all stores to clean state between tests. */
function resetAll() {
  usePopupStore.getState().clearPopups()
  usePackStore.getState().unloadPack()
  useConfigStore.getState().updateConfig({
    subliminalsChance: 0,
    subliminalsAlpha: 20,
    denialChance: 0,
    movingChance: 0,
    buttonless: false,
    clickthroughPopups: false,
    maxVideos: 10,
    popupScale: 1,
  })
}

// --- Spawn decision logic mirrors App.tsx lines 298-303 ---
// These tests verify the hypno overlay eligibility rules WITHOUT rendering
// React components. The logic is replicated here to test the pure decision:
//   isStaticImage && roll(subliminalsChance) && hypnoPool.length > 0

const STATIC_IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.webp'])

function extOf(filePath: string): string {
  const i = filePath.lastIndexOf('.')
  return i >= 0 ? filePath.slice(i).toLowerCase() : ''
}

function roll(percent: number, randomFn: () => number = Math.random): boolean {
  return randomFn() * 100 < percent
}

/**
 * Encapsulates the exact hypno decision logic from App.tsx spawn tick.
 * Returns the hypno media path that would be assigned, or undefined.
 */
function decideHypno(
  mediaPath: string,
  subliminalsChance: number,
  hypnoPool: string[],
  randomFn: () => number = Math.random,
): string | undefined {
  const mediaExt = extOf(mediaPath)
  const isStaticImage = STATIC_IMG_EXTS.has(mediaExt)
  return isStaticImage && roll(subliminalsChance, randomFn) && hypnoPool.length > 0
    ? hypnoPool[0]
    : undefined
}

describe('hypno overlay spawn decision logic', () => {
  beforeEach(() => {
    resetAll()
  })

  it('static image (.png) is eligible for hypno when chance > 0', () => {
    const hypno = decideHypno('/pack/img/photo.png', 100, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBe('/pack/hypno/swirl.gif')
  })

  it('static image (.jpg) is eligible for hypno', () => {
    const hypno = decideHypno('/pack/img/photo.jpg', 100, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBe('/pack/hypno/swirl.gif')
  })

  it('static image (.jpeg) is eligible for hypno', () => {
    const hypno = decideHypno('/pack/img/photo.jpeg', 100, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBe('/pack/hypno/swirl.gif')
  })

  it('static image (.bmp) is eligible for hypno', () => {
    const hypno = decideHypno('/pack/img/photo.bmp', 100, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBe('/pack/hypno/swirl.gif')
  })

  it('static image (.webp) is eligible for hypno', () => {
    const hypno = decideHypno('/pack/img/photo.webp', 100, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBe('/pack/hypno/swirl.gif')
  })

  it('gif is NOT eligible for hypno despite being in images array', () => {
    // GIFs appear in the images pool, but the spawn logic only applies hypno
    // to static images — animated GIFs should not get an overlay on top.
    const hypno = decideHypno('/pack/img/animation.gif', 100, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBeUndefined()
  })

  it('video (.mp4) is NOT eligible for hypno', () => {
    const hypno = decideHypno('/pack/vid/clip.mp4', 100, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBeUndefined()
  })

  it('video (.webm) is NOT eligible for hypno', () => {
    const hypno = decideHypno('/pack/vid/clip.webm', 100, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBeUndefined()
  })

  it('returns undefined when subliminalsChance is 0', () => {
    const hypno = decideHypno('/pack/img/photo.png', 0, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBeUndefined()
  })

  it('returns undefined when hypno pool is empty even with 100% chance', () => {
    const hypno = decideHypno('/pack/img/photo.png', 100, [])
    expect(hypno).toBeUndefined()
  })

  it('returns undefined when both chance is 0 and pool is empty', () => {
    const hypno = decideHypno('/pack/img/photo.png', 0, [])
    expect(hypno).toBeUndefined()
  })

  it('at 100% chance with valid pool, always returns hypno', () => {
    for (let i = 0; i < 20; i++) {
      const hypno = decideHypno('/pack/img/photo.png', 100, ['/pack/hypno/swirl.gif'])
      expect(hypno).toBe('/pack/hypno/swirl.gif')
    }
  })

  it('at 0% chance with valid pool, never returns hypno', () => {
    for (let i = 0; i < 20; i++) {
      const hypno = decideHypno('/pack/img/photo.png', 0, ['/pack/hypno/swirl.gif'])
      expect(hypno).toBeUndefined()
    }
  })

  it('at 50% chance, produces both hypno and no-hypno outcomes over many rolls', () => {
    let hypnoCount = 0
    const iterations = 100
    for (let i = 0; i < iterations; i++) {
      // Use a deterministic random that alternates to ensure both paths are hit
      const randomFn = () => (i % 2 === 0 ? 0.01 : 0.99)
      const hypno = decideHypno('/pack/img/photo.png', 50, ['/pack/hypno/swirl.gif'], randomFn)
      if (hypno) hypnoCount++
    }
    expect(hypnoCount).toBeGreaterThan(0)
    expect(hypnoCount).toBeLessThan(iterations)
  })

  it('case-insensitive extension matching for static images', () => {
    const hypno = decideHypno('/pack/img/PHOTO.PNG', 100, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBe('/pack/hypno/swirl.gif')
  })

  it('file with no extension is not eligible', () => {
    const hypno = decideHypno('/pack/img/noext', 100, ['/pack/hypno/swirl.gif'])
    expect(hypno).toBeUndefined()
  })
})

describe('packStore getMedia accessor', () => {
  beforeEach(() => {
    resetAll()
  })

  it('getMedia("hypno") returns hypno files from loaded pack', () => {
    const pack = makePack({
      hypno: ['/pack/hypno/swirl.gif'],
    })
    usePackStore.getState().loadPack(pack)
    const hypno = usePackStore.getState().getMedia('hypno')
    expect(hypno).toContain('/pack/hypno/swirl.gif')
    expect(hypno).toHaveLength(1)
  })

  it('getMedia("hypno") returns empty array when pack has no hypno files', () => {
    const pack = makePack({ hypno: [] })
    usePackStore.getState().loadPack(pack)
    const hypno = usePackStore.getState().getMedia('hypno')
    expect(hypno).toHaveLength(0)
  })

  it('getMedia("hypno") returns empty array when no pack is loaded', () => {
    const hypno = usePackStore.getState().getMedia('hypno')
    expect(hypno).toHaveLength(0)
  })

  it('getMedia returns correct type for each media category', () => {
    const pack = makePack({
      images: ['/pack/img/a.png'],
      videos: ['/pack/vid/b.mp4'],
      audio: ['/pack/audio/c.mp3'],
      hypno: ['/pack/hypno/d.gif'],
    })
    usePackStore.getState().loadPack(pack)
    expect(usePackStore.getState().getMedia('image')).toHaveLength(1)
    expect(usePackStore.getState().getMedia('video')).toHaveLength(1)
    expect(usePackStore.getState().getMedia('audio')).toHaveLength(1)
    expect(usePackStore.getState().getMedia('hypno')).toHaveLength(1)
  })

  it('getMedia returns empty after unloadPack', () => {
    usePackStore.getState().loadPack(makePack())
    expect(usePackStore.getState().getMedia('hypno')).toHaveLength(1)
    usePackStore.getState().unloadPack()
    expect(usePackStore.getState().getMedia('hypno')).toHaveLength(0)
  })
})

describe('configStore hypno-related settings', () => {
  beforeEach(() => {
    resetAll()
  })

  it('subliminalsAlpha is stored and retrievable', () => {
    useConfigStore.getState().updateConfig({ subliminalsAlpha: 50 })
    expect(useConfigStore.getState().subliminalsAlpha).toBe(50)
  })

  it('subliminalsChance is stored and retrievable', () => {
    useConfigStore.getState().updateConfig({ subliminalsChance: 75 })
    expect(useConfigStore.getState().subliminalsChance).toBe(75)
  })

  it('config defaults match expected values', () => {
    const cfg = useConfigStore.getState()
    expect(cfg.subliminalsChance).toBe(0)
    expect(cfg.subliminalsAlpha).toBe(20)
  })
})

describe('popupStore lifecycle', () => {
  beforeEach(() => {
    resetAll()
  })

  it('addPopup increments count and appends popup', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'image', x: 100, y: 100, width: 300, height: 200,
      moving: false, dx: 0, dy: 0, mitosisSpawned: false,
    })
    const state = usePopupStore.getState()
    expect(state.popups).toHaveLength(1)
    expect(state.popupCount).toBe(1)
  })

  it('removePopup decrements count and removes popup', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'image', x: 100, y: 100, width: 300, height: 200,
      moving: false, dx: 0, dy: 0, mitosisSpawned: false,
    })
    usePopupStore.getState().removePopup(1)
    const state = usePopupStore.getState()
    expect(state.popups).toHaveLength(0)
    expect(state.popupCount).toBe(0)
  })

  it('removePopup with non-existent id does not break', () => {
    usePopupStore.getState().removePopup(999)
    expect(usePopupStore.getState().popups).toHaveLength(0)
  })

  it('clearPopups resets both popups array and count', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'image', x: 100, y: 100, width: 300, height: 200,
      moving: true, dx: 1, dy: 0, mitosisSpawned: false,
    })
    usePopupStore.getState().addPopup({
      id: 2, type: 'video', x: 200, y: 200, width: 400, height: 300,
      moving: false, dx: 0, dy: 0, mitosisSpawned: false,
    })
    usePopupStore.getState().clearPopups()
    const state = usePopupStore.getState()
    expect(state.popups).toHaveLength(0)
    expect(state.popupCount).toBe(0)
  })

  it('updatePopup only modifies specified fields', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'image', x: 100, y: 200, width: 300, height: 200,
      moving: true, dx: 1, dy: 0, mitosisSpawned: false,
    })
    usePopupStore.getState().updatePopup(1, { x: 500 })
    const popup = usePopupStore.getState().popups[0]
    expect(popup.x).toBe(500)
    expect(popup.y).toBe(200)
    expect(popup.dx).toBe(1)
  })
})

describe('hypno spawn eligibility with pack + config interaction', () => {
  beforeEach(() => {
    resetAll()
  })

  it('pack with hypno + 100% chance → eligible (static image)', () => {
    usePackStore.getState().loadPack(makePack({ hypno: ['/pack/hypno/swirl.gif'] }))
    useConfigStore.getState().updateConfig({ subliminalsChance: 100 })
    const pack = usePackStore.getState().pack!
    const cfg = useConfigStore.getState()
    const mediaPath = '/pack/img/photo.png'
    const mediaExt = extOf(mediaPath)
    const isStaticImage = STATIC_IMG_EXTS.has(mediaExt)
    expect(isStaticImage).toBe(true)
    expect(pack.media.hypno.length).toBeGreaterThan(0)
    expect(cfg.subliminalsChance).toBe(100)
    const hypno = isStaticImage && roll(cfg.subliminalsChance) && pack.media.hypno.length > 0
      ? pack.media.hypno[0]
      : undefined
    expect(hypno).toBe('/pack/hypno/swirl.gif')
  })

  it('pack with no hypno + 100% chance → not eligible', () => {
    usePackStore.getState().loadPack(makePack({ hypno: [] }))
    useConfigStore.getState().updateConfig({ subliminalsChance: 100 })
    const pack = usePackStore.getState().pack!
    const mediaPath = '/pack/img/photo.png'
    const mediaExt = extOf(mediaPath)
    const isStaticImage = STATIC_IMG_EXTS.has(mediaExt)
    expect(isStaticImage).toBe(true)
    expect(pack.media.hypno.length).toBe(0)
    const hypno = isStaticImage && roll(100) && pack.media.hypno.length > 0
      ? pack.media.hypno[0]
      : undefined
    expect(hypno).toBeUndefined()
  })

  it('pack with hypno + 0% chance → not eligible', () => {
    usePackStore.getState().loadPack(makePack({ hypno: ['/pack/hypno/swirl.gif'] }))
    useConfigStore.getState().updateConfig({ subliminalsChance: 0 })
    const cfg = useConfigStore.getState()
    const isStaticImage = STATIC_IMG_EXTS.has(extOf('/pack/img/photo.png'))
    expect(isStaticImage).toBe(true)
    expect(cfg.subliminalsChance).toBe(0)
    const hypno = isStaticImage && roll(cfg.subliminalsChance) && true
      ? 'would assign'
      : undefined
    expect(hypno).toBeUndefined()
  })

  it('gif image → not eligible regardless of chance or pool', () => {
    usePackStore.getState().loadPack(makePack({ hypno: ['/pack/hypno/swirl.gif'] }))
    useConfigStore.getState().updateConfig({ subliminalsChance: 100 })
    const mediaPath = '/pack/img/animation.gif'
    const isStaticImage = STATIC_IMG_EXTS.has(extOf(mediaPath))
    expect(isStaticImage).toBe(false)
  })

  it('video → not eligible regardless of chance or pool', () => {
    usePackStore.getState().loadPack(makePack({ hypno: ['/pack/hypno/swirl.gif'] }))
    useConfigStore.getState().updateConfig({ subliminalsChance: 100 })
    const mediaPath = '/pack/vid/clip.mp4'
    const isStaticImage = STATIC_IMG_EXTS.has(extOf(mediaPath))
    expect(isStaticImage).toBe(false)
  })
})
