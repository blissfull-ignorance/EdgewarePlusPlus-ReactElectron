/**
 * Pure spawn pool functions for popup media selection.
 *
 * This module contains ZERO side effects — all functions are pure and testable
 * in isolation. It handles the filtering of media pools based on config chance
 * values (popupMod, vidMod, audioMod) before the spawn tick selects media.
 *
 * In the Python original, each media type is independently rolled against its
 * chance value via RollTarget.roll(). This module replicates that behavior:
 *   - popupMod: probability (0–100) that images are eligible to spawn
 *   - vidMod: probability (0–100) that videos are eligible to spawn
 *   - audioMod: probability (0–100) that audio spawns alongside visual media
 */

/** Returns true with `percent` probability (0–100). Injectable for testing. */
export function roll(percent: number, randomFn: () => number = Math.random): boolean {
  return randomFn() * 100 < percent
}

export interface SpawnPoolInput {
  images: string[]
  videos: string[]
  audio: string[]
  popupMod: number
  vidMod: number
  audioMod: number
}

export interface SpawnPoolResult {
  eligibleImages: string[]
  eligibleVideos: string[]
  eligibleAudio: string[]
  hasVisual: boolean
}

/**
 * Filters media pools by their respective chance values.
 *
 * Each type is independently rolled: an image/video is only included if
 * its chance value is > 0 AND the random roll succeeds. Audio is included
 * if any visual media is eligible AND audioMod > 0 AND the roll succeeds.
 *
 * @returns Filtered pools and a flag indicating whether any visual media is eligible.
 */
export function computeSpawnPools(
  input: SpawnPoolInput,
  randomFn: () => number = Math.random,
): SpawnPoolResult {
  const eligibleImages = input.popupMod > 0
    ? input.images.filter(() => roll(input.popupMod, randomFn))
    : []

  const eligibleVideos = input.vidMod > 0
    ? input.videos.filter(() => roll(input.vidMod, randomFn))
    : []

  const hasVisual = eligibleImages.length + eligibleVideos.length > 0

  const eligibleAudio = hasVisual && input.audioMod > 0 && roll(input.audioMod, randomFn)
    ? input.audio
    : []

  return { eligibleImages, eligibleVideos, eligibleAudio, hasVisual }
}
