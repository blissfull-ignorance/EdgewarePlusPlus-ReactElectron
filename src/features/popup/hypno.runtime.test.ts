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
