/**
 * @file HypnoOverlay — renders a pack spiral GIF on top of media popups.
 *
 * Driven independently by `subliminalsChance` (the "hypno" roll) and rendered on
 * top of whatever image/video pop at that moment — matching the original behaviour
 * where spiral GIFs overlay other popups rather than taking a popup slot themselves.
 *
 * When the parent supplies `frame` (the visible contain-rect of the base media),
 * the spiral is cut to exactly that size and ratio: it fills the frame with
 * `object-fit: cover` and anything spilling over is clipped, so an oversized
 * overlay can never extend beyond the base image. Without a frame it covers the
 * whole popup box (still clipped at the popup edge).
 */
import { useState } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { resolveHypnoGifUrl } from "../popup/resolveMediaUrl";
import type { MediaFrame } from "../popup/mediaFrame";

export interface HypnoOverlayProps {
  /** Optional spiral GIF filename from the pack's `hypno/` dir. */
  gif?: string;
  /** Visible rect of the base image/video. The overlay is clipped to it. */
  frame?: MediaFrame | null;
}

export function HypnoOverlay({ gif, frame }: HypnoOverlayProps) {
  const alpha = useSettingsStore((s) => s.subliminalsAlpha / 100);
  const [failed, setFailed] = useState(false);

  if (!gif || failed) return null;

  const clippedFrame =
    frame && frame.width > 0 && frame.height > 0 ? frame : (null as MediaFrame | null);

  return (
    <div
      data-testid="hypno-overlay"
      style={
        clippedFrame
          ? {
              position: "absolute",
              left: clippedFrame.x,
              top: clippedFrame.y,
              width: clippedFrame.width,
              height: clippedFrame.height,
              overflow: "hidden",
              opacity: alpha,
              pointerEvents: "none",
              zIndex: 6,
            }
          : {
              position: "absolute",
              inset: 0,
              overflow: "hidden",
              opacity: alpha,
              pointerEvents: "none",
              zIndex: 6,
            }
      }
    >
      <img
        data-testid="hypno-overlay-img"
        src={resolveHypnoGifUrl(gif)}
        alt=""
        onError={() => setFailed(true)}
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
