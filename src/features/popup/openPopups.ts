/**
 * @file openPopups — registry of currently open popup windows by id and type.
 *
 * Both render modes register their popups here; close events (IPC closed or
 * in-app removal) un-register, and Stop clears the whole registry. The dispatch
 * layer consults the counts to enforce the legacy concurrency limits
 * (maxAudio / maxVideos) — audio pops are capped so a pack of overlapping tracks
 * cannot exceed the configured player count.
 */

const openTypes = new Map<string, string>();

export function registerOpenPopup(id: string, type: string): void {
  openTypes.set(id, type);
}

export function unregisterOpenPopup(id: string): boolean {
  return openTypes.delete(id);
}

export function clearOpenPopups(): void {
  openTypes.clear();
}

export function countOpenPops(type?: string): number {
  let n = 0;
  for (const t of openTypes.values()) {
    if (!type || t === type) n += 1;
  }
  return n;
}

/** Legacy concurrency caps: refuse new audio pops at maxAudio, video at maxVideos. */
export function canOpenPopup(
  type: string,
  limits: { maxAudio: number; maxVideos: number }
): boolean {
  if (type === "audio") return countOpenPops("audio") < limits.maxAudio;
  if (type === "video") return countOpenPops("video") < limits.maxVideos;
  return true;
}
