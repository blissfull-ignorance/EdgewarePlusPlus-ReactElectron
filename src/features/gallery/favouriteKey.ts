/**
 * @file favouriteKey — stable cross-pack identity for a gallery file.
 */
import type { GalleryEntry } from "../../types/pack";
import type { MediaDir } from "../popup/resolveMediaUrl";

export const KIND_DIR: Record<GalleryEntry["kind"], MediaDir> = {
  image: "img",
  video: "vid",
  audio: "aud",
  hypno: "hypno",
};

export function favouriteKey(entry: GalleryEntry): string {
  return `${KIND_DIR[entry.kind]}/${entry.file}`;
}
