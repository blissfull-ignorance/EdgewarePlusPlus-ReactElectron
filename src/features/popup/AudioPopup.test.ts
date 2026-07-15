import { describe, it, expect, beforeEach } from 'vitest'
import { useConfigStore } from '@/stores/configStore'
import { usePopupStore } from '@/stores/popupStore'
import {
  audioToVolume,
  fadeVolume,
  canFadeIn,
  canFadeOut,
} from './AudioPopup'

function resetAll() {
  usePopupStore.getState().clearPopups()
  useConfigStore.getState().updateConfig({
    audioVolume: 100,
    maxAudio: 1,
    audioMod: 0,
    fadeInDuration: 0,
    fadeOutDuration: 0,
  })
}

describe('audioToVolume', () => {
  it('100 → 1.0', () => {
    expect(audioToVolume(100)).toBe(1.0)
  })

  it('0 → 0.0', () => {
    expect(audioToVolume(0)).toBe(0.0)
  })

  it('50 → 0.5', () => {
    expect(audioToVolume(50)).toBe(0.5)
  })

  it('25 → 0.25', () => {
    expect(audioToVolume(25)).toBe(0.25)
  })

  it('clamps values above 100 to 1.0', () => {
    expect(audioToVolume(150)).toBe(1.0)
  })

  it('clamps negative values to 0.0', () => {
    expect(audioToVolume(-10)).toBe(0.0)
  })
})

describe('fadeVolume', () => {
  it('returns 0 when elapsed is 0', () => {
    expect(fadeVolume(0, 1.0, 1000)).toBe(0)
  })

  it('returns target when elapsed >= duration', () => {
    expect(fadeVolume(1000, 1.0, 1000)).toBe(1.0)
    expect(fadeVolume(1500, 0.75, 1000)).toBe(0.75)
  })

  it('interpolates linearly at midpoint', () => {
    const result = fadeVolume(500, 1.0, 1000)
    expect(result).toBeCloseTo(0.5, 5)
  })

  it('interpolates at 25%', () => {
    const result = fadeVolume(250, 0.8, 1000)
    expect(result).toBeCloseTo(0.2, 5)
  })

  it('interpolates at 75%', () => {
    const result = fadeVolume(750, 1.0, 1000)
    expect(result).toBeCloseTo(0.75, 5)
  })

  it('returns 0 when duration is 0 (no fade)', () => {
    expect(fadeVolume(500, 1.0, 0)).toBe(0)
  })
})

describe('canFadeIn / canFadeOut', () => {
  it('canFadeIn returns true when duration > 0', () => {
    expect(canFadeIn(1000)).toBe(true)
  })

  it('canFadeIn returns false when duration is 0', () => {
    expect(canFadeIn(0)).toBe(false)
  })

  it('canFadeOut returns true when duration > 0', () => {
    expect(canFadeOut(1000)).toBe(true)
  })

  it('canFadeOut returns false when duration is 0', () => {
    expect(canFadeOut(0)).toBe(false)
  })
})

describe('maxAudio enforcement via popupStore', () => {
  beforeEach(() => {
    resetAll()
  })

  it('config default maxAudio is 1', () => {
    expect(useConfigStore.getState().maxAudio).toBe(1)
  })

  it('audio popup count tracked in store', () => {
    usePopupStore.getState().addPopup({
      id: 1, type: 'audio', mediaPath: '/audio/a.mp3',
      x: 0, y: 0, width: 0, height: 0,
      moving: false, dx: 0, dy: 0, spawnTime: 0, mitosisSpawned: false,
    })
    const audioCount = usePopupStore.getState().popups.filter(p => p.type === 'audio').length
    expect(audioCount).toBe(1)
  })

  it('spawn logic should block when audio count >= maxAudio', () => {
    const maxAudio = 1
    usePopupStore.getState().addPopup({
      id: 1, type: 'audio', mediaPath: '/audio/a.mp3',
      x: 0, y: 0, width: 0, height: 0,
      moving: false, dx: 0, dy: 0, spawnTime: 0, mitosisSpawned: false,
    })
    const currentAudio = usePopupStore.getState().popups.filter(p => p.type === 'audio').length
    const shouldSpawn = currentAudio < maxAudio
    expect(shouldSpawn).toBe(false)
  })

  it('spawn logic should allow when audio count < maxAudio', () => {
    const maxAudio = 2
    usePopupStore.getState().addPopup({
      id: 1, type: 'audio', mediaPath: '/audio/a.mp3',
      x: 0, y: 0, width: 0, height: 0,
      moving: false, dx: 0, dy: 0, spawnTime: 0, mitosisSpawned: false,
    })
    const currentAudio = usePopupStore.getState().popups.filter(p => p.type === 'audio').length
    const shouldSpawn = currentAudio < maxAudio
    expect(shouldSpawn).toBe(true)
  })
})

describe('audioMod probability in spawn selection', () => {
  beforeEach(() => {
    resetAll()
  })

  function roll(percent: number, randomFn: () => number = Math.random): boolean {
    return randomFn() * 100 < percent
  }

  function shouldSpawnAudio(
    audioMod: number,
    hasNonAudio: boolean,
    randomFn: () => number = Math.random,
  ): boolean {
    if (audioMod <= 0) return false
    if (!hasNonAudio) return true
    return roll(audioMod, randomFn)
  }

  it('audioMod=0 never selects audio when visual media exists', () => {
    let audioCount = 0
    for (let i = 0; i < 100; i++) {
      if (shouldSpawnAudio(0, true, () => 0.5)) audioCount++
    }
    expect(audioCount).toBe(0)
  })

  it('audioMod=100 always selects audio when visual media exists', () => {
    let audioCount = 0
    for (let i = 0; i < 100; i++) {
      if (shouldSpawnAudio(100, true, () => 0.5)) audioCount++
    }
    expect(audioCount).toBe(100)
  })

  it('audioMod=50 selects audio ~50% when visual media exists', () => {
    let audioCount = 0
    const iterations = 200
    for (let i = 0; i < iterations; i++) {
      const rng = () => (i % 2 === 0 ? 0.01 : 0.99)
      if (shouldSpawnAudio(50, true, rng)) audioCount++
    }
    expect(audioCount).toBe(iterations / 2)
  })

  it('audio always spawns when no visual media exists (audioMod>0)', () => {
    let audioCount = 0
    for (let i = 0; i < 100; i++) {
      if (shouldSpawnAudio(50, false, () => 0.99)) audioCount++
    }
    expect(audioCount).toBe(100)
  })

  it('audio never spawns when no visual media and audioMod=0', () => {
    let audioCount = 0
    for (let i = 0; i < 100; i++) {
      if (shouldSpawnAudio(0, false, () => 0.5)) audioCount++
    }
    expect(audioCount).toBe(0)
  })
})

describe('audio volume config integration', () => {
  beforeEach(() => {
    resetAll()
  })

  it('audioVolume default is 100', () => {
    expect(useConfigStore.getState().audioVolume).toBe(100)
  })

  it('audioVolume can be updated', () => {
    useConfigStore.getState().updateConfig({ audioVolume: 50 })
    expect(useConfigStore.getState().audioVolume).toBe(50)
  })

  it('audioVolume 50 converts to 0.5 volume float', () => {
    useConfigStore.getState().updateConfig({ audioVolume: 50 })
    const vol = audioToVolume(useConfigStore.getState().audioVolume)
    expect(vol).toBe(0.5)
  })

  it('audioVolume 0 converts to 0.0 volume float', () => {
    useConfigStore.getState().updateConfig({ audioVolume: 0 })
    const vol = audioToVolume(useConfigStore.getState().audioVolume)
    expect(vol).toBe(0.0)
  })
})

describe('fade config integration', () => {
  beforeEach(() => {
    resetAll()
  })

  it('fadeInDuration default is 0', () => {
    expect(useConfigStore.getState().fadeInDuration).toBe(0)
  })

  it('fadeOutDuration default is 0', () => {
    expect(useConfigStore.getState().fadeOutDuration).toBe(0)
  })

  it('fadeInDuration can be updated', () => {
    useConfigStore.getState().updateConfig({ fadeInDuration: 2000 })
    expect(useConfigStore.getState().fadeInDuration).toBe(2000)
  })

  it('fadeOutDuration can be updated', () => {
    useConfigStore.getState().updateConfig({ fadeOutDuration: 3000 })
    expect(useConfigStore.getState().fadeOutDuration).toBe(3000)
  })
})
