/**
 * @file rotation — Pure logic for desktop wallpaper rotation.
 *
 * While the runtime runs with rotation on, a wallpaper from the configured
 * list is applied every `wallpaperTimer` ± `wallpaperVariance` ms, never
 * repeating the previous pick while other candidates exist (legacy
 * `handle_wallpaper`). The list lives in the `wallpaperDat` setting as a
 * JSON (or legacy Python-literal) object whose values are pack-relative
 * filenames.
 */

export function parseWallpaperDat(raw: string): string[] {
  if (!raw) return [];
  const attempt = (s: string): unknown => JSON.parse(s);
  let parsed: unknown;
  try {
    parsed = attempt(raw);
  } catch {
    try {
      parsed = attempt(raw.replace(/'/g, '"'));
    } catch {
      return [];
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return [];
  return Object.values(parsed as Record<string, unknown>)
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");
}

/** Random pick excluding `previous` when other candidates exist. */
export function nextWallpaperPick(
  files: string[],
  previous: string | null,
  rand: () => number = Math.random
): string | null {
  if (files.length === 0) return null;
  const candidates = files.length > 1 && previous ? files.filter((f) => f !== previous) : files;
  if (candidates.length === 0) return null;
  return candidates[Math.floor(rand() * candidates.length)] ?? candidates[candidates.length - 1];
}

/** Timer plus random jitter in [-variance, +variance], floored at 1s. */
export function rotationDelay(
  timerMs: number,
  varianceMs: number,
  rand: () => number = Math.random
): number {
  const base = Math.max(0, timerMs);
  const jitter = (rand() * 2 - 1) * Math.max(0, varianceMs);
  return Math.max(1000, Math.round(base + jitter));
}
