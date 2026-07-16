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
 *   - audioMod: probability (0–100) that audio is eligible to spawn independently
 *
 * When singleMode is enabled, pickSingleType selects exactly one media type
 * via weighted random (matching Python's random.choices with k=1).
 */

export type MediaKind = 'images' | 'videos' | 'audio'

/** Returns true with `percent` probability (0–100). Injectable for testing. */
export function roll(percent: number, randomFn: () => number = Math.random): boolean {
  return randomFn() * 100 < percent
}

/**
 * Weighted random selection of a single media type (singleMode).
 *
 * Equivalent to Python's `random.choices(types, weights, k=1)[0]`.
 * Types with chance = 0 are excluded from the pool. Returns null when
 * all chances are 0 (nothing to spawn).
 */
export function pickSingleType(
  chances: { images: number; videos: number; audio: number },
  randomFn: () => number = Math.random,
): MediaKind | null {
  const all: [MediaKind, number][] = [
    ['images', chances.images],
    ['videos', chances.videos],
    ['audio', chances.audio],
  ]
  const entries = all.filter((e): e is [MediaKind, number] => e[1] > 0)

  const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0)
  if (totalWeight <= 0) return null

  let r = randomFn() * totalWeight
  for (const [kind, weight] of entries) {
    r -= weight
    if (r < 0) return kind
  }
  return entries[entries.length - 1][0]
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
 * its chance value is > 0 AND the random roll succeeds. Audio is also
 * rolled independently — it does not depend on visual eligibility.
 * This matches the Python original where audio is a separate RollTarget.
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

  const eligibleAudio = input.audioMod > 0 && roll(input.audioMod, randomFn)
    ? input.audio
    : []

  return { eligibleImages, eligibleVideos, eligibleAudio, hasVisual }
}
