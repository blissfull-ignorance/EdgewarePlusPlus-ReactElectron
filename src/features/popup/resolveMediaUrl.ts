/**
 * @file resolveMediaUrl — Turn a popup's `mediaId` into a loadable URL.
 *
 * Pack IPC hands the renderer a bare filename (e.g. "seed.png") scoped to a media
 * subdir (img/vid/aud). In Electron that resolves through the privileged
 * `packmedia://` protocol so the real file is served from inside the active pack.
 *
 * Values that are already absolute — data-URIs (the browser-layer test strategy),
 * http(s) URLs, blob:, or an existing packmedia: URL — pass through untouched, so
 * this resolver is safe in both the Electron app and the mocked browser E2E layer.
 */

export type MediaDir = "img" | "vid" | "aud" | "hypno";

/**
 * Built-in spiral shipped with the app (public/). Used when the active pack has no
 * `hypno/` media of its own, mirroring the legacy default-hypno fallback.
 */
export const DEFAULT_HYPNO_ASSET = "default_hypno.gif";

const ABSOLUTE_URL = /^(?:data|https?|blob|file|packmedia):/i;

/**
 * Map a media reference plus its pack subdirectory to a URL a `<img>/<video>/<audio>`
 * can actually load. Bare filenames become `packmedia://<dir>/<encoded-name>`;
 * absolute URLs (incl. data-URIs for the browser layer) are returned as-is.
 */
export function resolvePackMediaUrl(mediaId: string, dir: MediaDir): string {
  if (!mediaId) return mediaId;
  if (ABSOLUTE_URL.test(mediaId)) return mediaId;

  // Pack IPC may return "seed.png" or occasionally "img/seed.png"; anchor on the
  // final segment and re-scope it to the authoritative subdir for this popup type.
  const name = mediaId.split("/").filter(Boolean).pop() ?? mediaId;
  return `packmedia://${dir}/${encodeURIComponent(name)}`;
}

/**
 * Resolve a hypno GIF reference for an overlay: pack files (subdir-qualified
 * "hypno/x.gif" or "subliminals/y.gif", or bare names anchored under hypno/) go
 * through `packmedia://`, while the built-in default asset is loaded as a plain
 * (relative) app asset so it works in dev (http origin) and packaged (file origin).
 */
export function resolveHypnoGifUrl(gif: string): string {
  if (!gif) return gif;
  if (gif === DEFAULT_HYPNO_ASSET || ABSOLUTE_URL.test(gif)) return gif;
  const rel = gif.includes("/") ? gif : `hypno/${gif}`;
  return `packmedia://${rel.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`;
}
