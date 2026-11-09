/**
 * @file selectMedia — Random media selection for popup spawning.
 *
 * Picks a random media file from the active pack via IPC for a given
 * popup type. Returns null when no media is available or the type is
 * not yet supported by pack IPC.
 */
import { type PopupType } from "../../hooks/useRoll";
import { logger } from "../../utils/logger";

export type SelectedMedia =
  | { mediaId: string; mediaType: "image" }
  | { mediaId: string; mediaType: "video" }
  | { mediaId: string; mediaType: "audio-only" }
  | { url: string; mediaType: "web" }
  | { text: string; mediaType: "prompt" };

export async function selectMedia(type: PopupType): Promise<SelectedMedia | null> {
  const api = window.api;
  if (!api) return null;

  switch (type) {
    case "image": {
      const img = await api.pack.randomImage();
      if (!img) logger.warn(`[selectMedia] image roll passed but the pack has no images`);
      return img ? { mediaId: img, mediaType: "image" } : null;
    }
    case "video": {
      const vid = await api.pack.randomVideo();
      if (!vid) logger.warn(`[selectMedia] video roll passed but the pack has no videos`);
      return vid ? { mediaId: vid, mediaType: "video" } : null;
    }
    case "audio": {
      const aud = await api.pack.randomAudio();
      if (!aud) logger.warn(`[selectMedia] audio roll passed but the pack has no audio`);
      return aud ? { mediaId: aud, mediaType: "audio-only" } : null;
    }
    case "prompt": {
      const prompt = await api.pack.randomPrompt();
      if (!prompt) logger.warn(`[selectMedia] prompt roll passed but the pack defines no prompts`);
      return prompt ? { text: prompt, mediaType: "prompt" } : null;
    }
    case "web": {
      const url = await api.pack.randomWeb();
      if (!url) logger.warn(`[selectMedia] web roll passed but the pack defines no web urls`);
      return url ? { url, mediaType: "web" } : null;
    }
    // Hypno is an overlay, not a popup: these types never spawn and resolve to
    // null until the PopupType unions are cleaned up.
    case "caption":
    case "subliminal":
      return null;
    default:
      return null;
  }
}
