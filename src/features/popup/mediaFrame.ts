/**
 * @file mediaFrame — Geometry helpers for `object-fit: contain` media.
 *
 * A popup media element rendered with `max-width/max-height: 100%` scales its
 * content down to fit its container, centered. This computes where that visible
 * (un-letterboxed) area actually is, so overlays such as the hypno spiral can be
 * clipped to exactly the base image's size and ratio.
 */

export interface MediaFrame {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The visible content rect of natural-sized media contained inside a box.
 * Returns null when anything is non-positive (media not decoded yet).
 */
export function computeContainedFrame(
  boxWidth: number,
  boxHeight: number,
  naturalWidth: number,
  naturalHeight: number
): MediaFrame | null {
  if (!(boxWidth > 0) || !(boxHeight > 0) || !(naturalWidth > 0) || !(naturalHeight > 0)) {
    return null;
  }
  const scale = Math.min(boxWidth / naturalWidth, boxHeight / naturalHeight);
  const width = naturalWidth * scale;
  const height = naturalHeight * scale;
  return {
    x: (boxWidth - width) / 2,
    y: (boxHeight - height) / 2,
    width,
    height,
  };
}
