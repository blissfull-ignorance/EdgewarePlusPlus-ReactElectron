import { describe, it, expect } from 'vitest'
import { roll, computeSpawnPools } from './spawn'
import type { SpawnPoolInput } from './spawn'

function makeInput(overrides: Partial<SpawnPoolInput> = {}): SpawnPoolInput {
  return {
    images: ['img1.png', 'img2.jpg', 'img3.bmp'],
    videos: ['vid1.mp4', 'vid2.webm'],
    audio: ['aud1.mp3', 'aud2.wav'],
    popupMod: 100,
    vidMod: 100,
    audioMod: 0,
    ...overrides,
  }
}

function always(fn: () => number = () => 0.5): () => number {
  return fn
}

function never(): () => number {
  return () => 0.99
}

describe('roll', () => {
  it('returns true when random is below percent threshold', () => {
    expect(roll(50, () => 0.3)).toBe(true)
  })

  it('returns false when random is at or above percent threshold', () => {
    expect(roll(50, () => 0.5)).toBe(false)
    expect(roll(50, () => 0.99)).toBe(false)
  })

  it('returns true when percent is 100', () => {
    expect(roll(100, () => 0.99)).toBe(true)
  })

  it('returns false when percent is 0', () => {
    expect(roll(0, () => 0.0)).toBe(false)
  })
})

describe('computeSpawnPools', () => {
  it('popupMod = 0 → no images eligible', () => {
    const result = computeSpawnPools(makeInput({ popupMod: 0 }))
    expect(result.eligibleImages).toEqual([])
    expect(result.eligibleVideos).toHaveLength(2)
    expect(result.hasVisual).toBe(true)
  })

  it('vidMod = 0 → no videos eligible', () => {
    const result = computeSpawnPools(makeInput({ vidMod: 0 }))
    expect(result.eligibleImages).toHaveLength(3)
    expect(result.eligibleVideos).toEqual([])
    expect(result.hasVisual).toBe(true)
  })

  it('both popupMod and vidMod = 0 → no visual popups', () => {
    const result = computeSpawnPools(makeInput({ popupMod: 0, vidMod: 0 }))
    expect(result.eligibleImages).toEqual([])
    expect(result.eligibleVideos).toEqual([])
    expect(result.hasVisual).toBe(false)
  })

  it('both > 0 → images and videos eligible (roll succeeds)', () => {
    const result = computeSpawnPools(makeInput({ popupMod: 100, vidMod: 100 }))
    expect(result.eligibleImages).toHaveLength(3)
    expect(result.eligibleVideos).toHaveLength(2)
    expect(result.hasVisual).toBe(true)
  })

  it('popupMod > 0 with failing roll → no images eligible', () => {
    const result = computeSpawnPools(
      makeInput({ popupMod: 50 }),
      never(),
    )
    expect(result.eligibleImages).toEqual([])
  })

  it('vidMod > 0 with failing roll → no videos eligible', () => {
    const result = computeSpawnPools(
      makeInput({ vidMod: 50 }),
      never(),
    )
    expect(result.eligibleVideos).toEqual([])
  })

  it('audio eligible independently of visual media', () => {
    const result = computeSpawnPools(
      makeInput({ popupMod: 0, vidMod: 0, audioMod: 100 }),
      always(),
    )
    expect(result.eligibleAudio).toEqual(['aud1.mp3', 'aud2.wav'])
    expect(result.hasVisual).toBe(false)
  })

  it('audio eligible when visual is eligible and audioMod > 0 with passing roll', () => {
    const result = computeSpawnPools(
      makeInput({ popupMod: 100, audioMod: 100 }),
      always(),
    )
    expect(result.hasVisual).toBe(true)
    expect(result.eligibleAudio).toEqual(['aud1.mp3', 'aud2.wav'])
  })

  it('audio not eligible when audioMod = 0', () => {
    const result = computeSpawnPools(
      makeInput({ popupMod: 100, audioMod: 0 }),
      always(),
    )
    expect(result.eligibleAudio).toEqual([])
  })

  it('audio not eligible when audioMod > 0 but roll fails', () => {
    const result = computeSpawnPools(
      makeInput({ popupMod: 100, audioMod: 50 }),
      never(),
    )
    expect(result.eligibleAudio).toEqual([])
  })

  it('empty media arrays produce empty pools', () => {
    const result = computeSpawnPools(makeInput({
      images: [],
      videos: [],
      audio: [],
    }))
    expect(result.eligibleImages).toEqual([])
    expect(result.eligibleVideos).toEqual([])
    expect(result.eligibleAudio).toEqual([])
    expect(result.hasVisual).toBe(false)
  })

  it('popupMod = 100 with deterministic random includes all images', () => {
    let callCount = 0
    const randomFn = () => {
      callCount++
      return 0.0
    }
    const result = computeSpawnPools(makeInput({ popupMod: 100, vidMod: 100 }), randomFn)
    expect(result.eligibleImages).toEqual(['img1.png', 'img2.jpg', 'img3.bmp'])
    expect(result.eligibleVideos).toEqual(['vid1.mp4', 'vid2.webm'])
    expect(callCount).toBe(5)
  })

  it('popupMod = 1 filters to subset based on roll', () => {
    const rolls = [0.005, 0.002, 0.008]
    let i = 0
    const randomFn = () => rolls[i++ % rolls.length]
    const result = computeSpawnPools(makeInput({ popupMod: 1, vidMod: 0 }), randomFn)
    expect(result.eligibleImages).toEqual(['img1.png', 'img2.jpg', 'img3.bmp'])
  })

  it('popupMod = 1 with mostly failing rolls', () => {
    const rolls = [0.5, 0.5, 0.5]
    let i = 0
    const randomFn = () => rolls[i++ % rolls.length]
    const result = computeSpawnPools(makeInput({ popupMod: 1, vidMod: 0 }), randomFn)
    expect(result.eligibleImages).toEqual([])
  })

  it('audio spawns alone when no visual media and audioMod > 0', () => {
    const result = computeSpawnPools(
      makeInput({ popupMod: 0, vidMod: 0, audioMod: 100 }),
      always(),
    )
    expect(result.hasVisual).toBe(false)
    expect(result.eligibleAudio).toEqual(['aud1.mp3', 'aud2.wav'])
  })

  it('audio and visual spawn on same tick', () => {
    const result = computeSpawnPools(
      makeInput({ popupMod: 100, vidMod: 100, audioMod: 100 }),
      always(),
    )
    expect(result.hasVisual).toBe(true)
    expect(result.eligibleImages).toHaveLength(3)
    expect(result.eligibleVideos).toHaveLength(2)
    expect(result.eligibleAudio).toEqual(['aud1.mp3', 'aud2.wav'])
  })

  it('audio alone when visual roll fails but audioMod > 0', () => {
    const rolls = [0.99, 0.99, 0.99, 0.99, 0.99, 0.5]
    let i = 0
    const randomFn = () => rolls[i++ % rolls.length]
    const result = computeSpawnPools(
      makeInput({ popupMod: 50, vidMod: 50, audioMod: 100 }),
      randomFn,
    )
    expect(result.hasVisual).toBe(false)
    expect(result.eligibleAudio).toEqual(['aud1.mp3', 'aud2.wav'])
  })

  it('visual alone when audioMod = 0', () => {
    const result = computeSpawnPools(
      makeInput({ popupMod: 100, vidMod: 100, audioMod: 0 }),
      always(),
    )
    expect(result.hasVisual).toBe(true)
    expect(result.eligibleAudio).toEqual([])
  })

  it('neither when all chances are 0', () => {
    const result = computeSpawnPools(
      makeInput({ popupMod: 0, vidMod: 0, audioMod: 0 }),
      always(),
    )
    expect(result.hasVisual).toBe(false)
    expect(result.eligibleAudio).toEqual([])
  })

  it('only some images eligible with partial roll success', () => {
    const rolls = [0.0, 0.9, 0.0]
    let i = 0
    const randomFn = () => rolls[i++ % rolls.length]
    const result = computeSpawnPools(makeInput({ popupMod: 50, vidMod: 0 }), randomFn)
    expect(result.eligibleImages).toEqual(['img1.png', 'img3.bmp'])
  })
})
