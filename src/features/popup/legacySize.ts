/**
 * @file legacySize — Legacy popup window sizing (features/popup.py).
 *
 * The media's longest side should span a random 30–70% of the monitor's
 * shortest side (20–50% in lowkey mode); the window is then sized exactly to
 * the scaled media so no letterbox surface surrounds it.
 */

export function legacyPopupSize(
  mediaWidth: number,
  mediaHeight: number,
  monitorShortSide: number,
  rand: () => number = Math.random,
  lowkey = false
): { width: number; height: number } {
  if (mediaWidth <= 0 || mediaHeight <= 0 || monitorShortSide <= 0) {
    return { width: 400, height: 300 };
  }
  const sourceSize = Math.max(mediaWidth, mediaHeight) / monitorShortSide;
  const lo = lowkey ? 20 : 30;
  const hi = lowkey ? 50 : 70;
  const targetSize = (lo + rand() * (hi - lo)) / 100;
  const scale = targetSize / sourceSize;
  return {
    width: Math.max(1, Math.round(mediaWidth * scale)),
    height: Math.max(1, Math.round(mediaHeight * scale)),
  };
}
