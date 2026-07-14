import { describe, it, expect } from 'vitest'
import { categorizeByExt } from '@electron/ipc/pack'

describe('categorizeByExt — hypno overlay classification', () => {
  it('gif files appear in both images and hypno', () => {
    const result = categorizeByExt(['/pack/images/spiral.gif', '/pack/images/test.GIF'])
    expect(result.images).toContain('/pack/images/spiral.gif')
    expect(result.images).toContain('/pack/images/test.GIF')
    expect(result.hypno).toContain('/pack/images/spiral.gif')
    expect(result.hypno).toContain('/pack/images/test.GIF')
  })

  it('mp4 files appear in videos but NOT in hypno', () => {
    const result = categorizeByExt(['/pack/hypno/spiral.mp4'])
    expect(result.videos).toContain('/pack/hypno/spiral.mp4')
    expect(result.hypno).toHaveLength(0)
  })

  it('webm files appear in videos but NOT in hypno', () => {
    const result = categorizeByExt(['/pack/hypno/spiral.webm'])
    expect(result.videos).toContain('/pack/hypno/spiral.webm')
    expect(result.hypno).toHaveLength(0)
  })

  it('regular images (png, jpg) do NOT appear in hypno', () => {
    const result = categorizeByExt(['/pack/images/photo.png', '/pack/images/photo.jpg', '/pack/images/photo.jpeg'])
    expect(result.images).toHaveLength(3)
    expect(result.hypno).toHaveLength(0)
  })

  it('mov videos do NOT appear in hypno', () => {
    const result = categorizeByExt(['/pack/videos/clip.mov'])
    expect(result.videos).toContain('/pack/videos/clip.mov')
    expect(result.hypno).toHaveLength(0)
  })

  it('audio files do NOT appear in hypno', () => {
    const result = categorizeByExt(['/pack/audio/song.mp3', '/pack/audio/song.wav'])
    expect(result.audio).toHaveLength(2)
    expect(result.hypno).toHaveLength(0)
  })

  it('mixed files: hypno contains only gif', () => {
    const result = categorizeByExt([
      '/pack/images/photo.png',
      '/pack/images/spiral.gif',
      '/pack/videos/clip.mp4',
      '/pack/videos/clip.mov',
      '/pack/hypno/swirl.webm',
      '/pack/audio/song.mp3',
    ])
    expect(result.images).toHaveLength(2)
    expect(result.videos).toHaveLength(3)
    expect(result.audio).toHaveLength(1)
    expect(result.hypno).toHaveLength(1)
    expect(result.hypno).toContain('/pack/images/spiral.gif')
  })

  it('empty input produces empty arrays', () => {
    const result = categorizeByExt([])
    expect(result.images).toHaveLength(0)
    expect(result.videos).toHaveLength(0)
    expect(result.audio).toHaveLength(0)
    expect(result.hypno).toHaveLength(0)
  })
})
