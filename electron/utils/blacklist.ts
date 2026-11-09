/**
 * @file blacklist — Pure path helpers for the media blacklist.
 *
 * Alt+clicking a popup's close control moves the media file out of the pack
 * into `<userData>/data/blacklist/<pack name without whitespace>/`, so it can
 * never spawn again. These helpers keep the naming and containment rules
 * unit-testable without touching the filesystem; the IPC handler composes them.
 */
import path from "node:path";
import { existsSync } from "node:fs";

const BLACKLISTABLE_SUBDIRS = ["img", "vid", "aud"] as const;

/** Legacy naming: the pack display name with every whitespace removed. */
export function sanitizePackDirName(name: string): string {
  const condensed = String(name).replace(/\s+/g, "").replace(/[/\\]/g, "");
  if (!condensed || /^\.+$/.test(condensed)) return "pack";
  return condensed;
}

/** Locate `fileName` inside the pack's media subdirectories; null when absent or hostile. */
export function resolveBlacklistSource(
  packDir: string,
  fileName: string
): { subdir: string; src: string } | null {
  if (!fileName || fileName !== path.basename(fileName)) return null;
  for (const subdir of BLACKLISTABLE_SUBDIRS) {
    const src = path.join(packDir, subdir, fileName);
    if (!src.startsWith(path.join(packDir, subdir) + path.sep)) return null;
    if (existsSync(src)) return { subdir, src };
  }
  return null;
}

/** Destination path for a blacklisted file, always confined under `<dataRoot>/blacklist`. */
export function computeBlacklistTarget(dataRoot: string, packName: string, fileName: string): string {
  const blacklistRoot = path.join(dataRoot, "blacklist");
  const dir = path.join(blacklistRoot, sanitizePackDirName(packName));
  const safeFile = path.basename(String(fileName)).replace(/[/\\]/g, "");
  const target = path.join(dir, safeFile || "media");
  if (!path.resolve(target).startsWith(path.resolve(blacklistRoot) + path.sep)) {
    return path.join(blacklistRoot, "pack", safeFile || "media");
  }
  return target;
}
