/**
 * @file mediaGuard — Pure, dependency-free helpers for the pack-media protocol.
 *
 * Keeping the path-confinement logic free of any Electron import lets it be unit
 * tested in isolation (task 21 A21.5) and reused by the main-process handler. The
 * single source of truth is `resolvePackMediaPath`: a request only resolves to a
 * real file when it stays strictly inside `<packRoot>/<subdir>`.
 */
import path from "node:path";

export const PACK_MEDIA_SCHEME = "packmedia" as const;

export const MEDIA_SUBDIRS = ["img", "vid", "aud", "hypno", "subliminals"] as const;
export type MediaSubdir = (typeof MEDIA_SUBDIRS)[number];

/** Map a file extension (lowercase, incl. dot) to its MIME content-type. */
const CONTENT_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".m4v": "video/mp4",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".oga": "audio/ogg",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
};

export function contentTypeForFile(filename: string): string {
  return CONTENT_TYPES[path.extname(filename).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Resolve a pack-media request into an absolute path, or `null` to reject it.
 *
 * A request is accepted only when ALL of the following hold:
 *  - `packRoot` is present.
 *  - `subdir` is one of the known media subdirs (img / vid / aud).
 *  - every `rel` segment, joined under `<packRoot>/<subdir>`, stays strictly
 *    inside that directory tree — i.e. no `../` escapes the subdir and absolute
 *    segments cannot redirect the resolution elsewhere.
 *
 * Path segments are split on `/` (empties dropped) so an attacker-supplied
 * leading `/` or embedded `..` can never re-anchor the lookup outside the pack
 * root. Existence/file-ness is intentionally left to the caller so this stays pure.
 */
export function resolvePackMediaPath(
  packRoot: string | null,
  subdir: string,
  rel: string
): string | null {
  if (!packRoot || !subdir) return null;
  if (!(MEDIA_SUBDIRS as readonly string[]).includes(subdir)) return null;

  const base = path.resolve(packRoot);
  const segments = rel.split("/").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  // Guard against NUL bytes in a path segment before touching the filesystem.
  if (segments.some((s) => s.includes("\0"))) return null;

  // Reject any explicit ".." traversal segment outright (defense-in-depth); a
  // legitimate flat media filename never contains a bare dot-dot segment.
  if (segments.includes("..")) return null;

  const target = path.resolve(base, subdir, ...segments);
  const subRoot = path.resolve(base, subdir);
  if (target === subRoot || !target.startsWith(subRoot + path.sep)) return null;

  return target;
}
