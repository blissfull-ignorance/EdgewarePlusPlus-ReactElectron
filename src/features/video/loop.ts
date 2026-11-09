/**
 * @file loop — Video loop policy mirroring the legacy mpv settings.
 *
 * `videoLoopInf` loops forever; otherwise the video replays until it has
 * played `videoLoopCount` times, then the popup closes (legacy: mpv loop
 * property plus on_eof → close).
 */
export type VideoLoopAction = "replay" | "close";

export function nextVideoAction(
  playsDone: number,
  videoLoopInf: number,
  videoLoopCount: number
): VideoLoopAction {
  if (videoLoopInf === 1) return "replay";
  return playsDone >= Math.max(1, videoLoopCount) ? "close" : "replay";
}

/** The HTML loop attribute value: infinite looping is native, counted is scripted. */
export function videoLoopAttribute(videoLoopInf: number): boolean {
  return videoLoopInf === 1;
}
