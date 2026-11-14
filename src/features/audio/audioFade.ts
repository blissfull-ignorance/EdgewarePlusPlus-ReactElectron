/**
 * @file audioFade — legacy audio volume/fade scheduling (features/audio.py).
 *
 * Volume ramps 0 → target over the fade-in, and the fade-out is scheduled so
 * it reaches zero exactly at end-of-stream. When the two fades together outlast
 * the clip they are scaled down proportionally, preserving their ratio.
 */

export interface AudioFadePlan {
  fadeInMs: number;
  fadeOutMs: number;
  /** When the fade-out starts, measured from playback start. */
  fadeOutStartMs: number;
}

export function planAudioFades(
  durationMs: number,
  fadeInMs: number,
  fadeOutMs: number
): AudioFadePlan {
  let fi = Math.max(0, Number.isFinite(fadeInMs) ? fadeInMs : 0);
  let fo = Math.max(0, Number.isFinite(fadeOutMs) ? fadeOutMs : 0);

  const finite = Number.isFinite(durationMs) && durationMs > 0;
  if (!finite) {
    // Unknown length (streaming): a fade-out anchored to the end is
    // impossible, so only the fade-in survives.
    return { fadeInMs: fi, fadeOutMs: 0, fadeOutStartMs: 0 };
  }
  if (fi + fo > durationMs) {
    const total = fi + fo;
    fi = Math.floor((durationMs * fi) / total);
    fo = durationMs - fi;
  }
  return { fadeInMs: fi, fadeOutMs: fo, fadeOutStartMs: Math.max(0, durationMs - fo) };
}

/** Legacy audio_volume is a percentage; the element wants 0..1. */
export function targetVolume(percent: number): number {
  const v = Number(percent);
  if (!Number.isFinite(v)) return 1;
  return Math.min(1, Math.max(0, v / 100));
}
