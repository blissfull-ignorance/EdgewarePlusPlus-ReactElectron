import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/stores/configStore'
import { usePackStore } from '@/stores/packStore'
import { usePopupStore } from '@/stores/popupStore'
import type { Pack } from '@/types/pack'

function makePack(overrides: Partial<Pack['media']> = {}): Pack {
  return {
    info: { name: 'Test', version: '1.0', author: 'Test', description: '' },
    index: {},
    corruption: { enabled: false, level: 0, maxLevel: 0, triggers: [] },
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

const STATIC_IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.bmp', '.webp'])

function extOf(filePath: string): string {
  const i = filePath.lastIndexOf('.')
  return i >= 0 ? filePath.slice(i).toLowerCase() : ''
}

function canHaveHypno(filePath: string): boolean {
  const ext = extOf(filePath)
  return STATIC_IMG_EXTS.has(ext)
}

describe('hypno overlay — spawn decision', () => {
  beforeEach(() => {
    resetAll()
  })

  it('subliminalsChance=0 → hypnoMediaPath should not be generated', () => {
    const cfg = useConfigStore.getState()
    const pack = makePack()
    usePackStore.getState().loadPack(pack)
    const hypnoPool = pack.media.hypno
    const shouldOverlay = cfg.subliminalsChance > 0 && hypnoPool.length > 0
    expect(shouldOverlay).toBe(false)
  })

  it('subliminalsChance=100 with hypno files → overlay eligible for static images', () => {
    useConfigStore.getState().updateConfig({ subliminalsChance: 100 })
    const cfg = useConfigStore.getState()
    const pack = makePack()
    usePackStore.getState().loadPack(pack)
    const hypnoPool = pack.media.hypno
    const shouldOverlay = cfg.subliminalsChance > 0 && hypnoPool.length > 0
    expect(shouldOverlay).toBe(true)
  })

  it('subliminalsChance=100 but empty hypno pool → no overlay', () => {
    useConfigStore.getState().updateConfig({ subliminalsChance: 100 })
    const cfg = useConfigStore.getState()
    const pack = makePack({ hypno: [] })
    usePackStore.getState().loadPack(pack)
    const hypnoPool = pack.media.hypno
    const shouldOverlay = cfg.subliminalsChance > 0 && hypnoPool.length > 0
    expect(shouldOverlay).toBe(false)
  })

  it('subliminalsAlpha controls opacity passed to popup', () => {
    useConfigStore.getState().updateConfig({ subliminalsAlpha: 50 })
    const cfg = useConfigStore.getState()
    const opacity = Math.min(100, Math.max(0, cfg.subliminalsAlpha)) / 100
    expect(opacity).toBe(0.5)
  })

  it('pack.media.hypno only contains gif after categorization', () => {
    const pack = makePack({
      images: ['/pack/img/a.png', '/pack/img/b.gif', '/pack/img/c.jpg'],
      videos: ['/pack/vid/d.mp4', '/pack/vid/e.webm'],
      hypno: ['/pack/hypno/swirl.gif'],
    })
    usePackStore.getState().loadPack(pack)
    const hypno = usePackStore.getState().getMedia('hypno')
    expect(hypno).toContain('/pack/hypno/swirl.gif')
    expect(hypno).toHaveLength(1)
  })

  it('getMedia("hypno") returns empty when pack has no gif files', () => {
    const pack = makePack({ hypno: [] })
    usePackStore.getState().loadPack(pack)
    const hypno = usePackStore.getState().getMedia('hypno')
    expect(hypno).toHaveLength(0)
  })

  it('static images (png, jpg, bmp, webp) can have hypno overlay', () => {
    expect(canHaveHypno('/pack/img/photo.png')).toBe(true)
    expect(canHaveHypno('/pack/img/photo.jpg')).toBe(true)
    expect(canHaveHypno('/pack/img/photo.jpeg')).toBe(true)
    expect(canHaveHypno('/pack/img/photo.bmp')).toBe(true)
    expect(canHaveHypno('/pack/img/photo.webp')).toBe(true)
  })

  it('gifs cannot have hypno overlay', () => {
    expect(canHaveHypno('/pack/img/animation.gif')).toBe(false)
  })

  it('videos cannot have hypno overlay', () => {
    expect(canHaveHypno('/pack/vid/clip.mp4')).toBe(false)
    expect(canHaveHypno('/pack/vid/clip.webm')).toBe(false)
    expect(canHaveHypno('/pack/vid/clip.mov')).toBe(false)
  })
})
