/**
 * @file booru — Pure pieces of the Gelbooru downloader.
 *
 * Mirrors the legacy image-popup integration: on each image pop with the
 * downloader enabled, a coin flip (50%) swaps the pack image for one random
 * Gelbooru result for the configured tags. Failures fall back to the pack
 * image, so the popup loop never stalls on the network.
 */

export const DEFAULT_BOORU_BASE = "https://gelbooru.com";

/** tagList stores tags joined with ">" (legacy config); the API wants spaces. */
export function joinTags(tagList: string): string {
  return String(tagList ?? "")
    .split(">")
    .map((t) => t.trim())
    .filter(Boolean)
    .join(" ");
}

export function buildSearchUrl(baseUrl: string, tags: string): string {
  const params = new URLSearchParams({
    page: "dapi",
    s: "post",
    q: "index",
    json: "1",
    limit: "1",
    tags: tags || "all",
  });
  return `${baseUrl.replace(/\/+$/, "")}/index.php?${params.toString()}`;
}

interface GelbooruPost {
  file_url?: unknown;
}

interface GelbooruResponse {
  post?: GelbooruPost[] | GelbooruPost;
}

export function parseSearchResponse(data: unknown): string | null {
  const posts = (data as GelbooruResponse | null)?.post;
  const list = Array.isArray(posts) ? posts : posts ? [posts] : [];
  for (const p of list) {
    if (typeof p?.file_url === "string" && /^https?:\/\//i.test(p.file_url)) return p.file_url;
  }
  return null;
}

/** Stable, traversal-proof cache filename derived from the remote file URL. */
export function cacheFileName(fileUrl: string): string {
  const withoutQuery = fileUrl.split(/[?#]/)[0];
  const base = withoutQuery.split("/").pop() ?? "image.jpg";
  const ext = base.includes(".") ? base.slice(base.lastIndexOf(".")).toLowerCase() : ".jpg";
  const stem = base.includes(".") ? base.slice(0, base.lastIndexOf(".")) : base;
  const safe = (s: string) => s.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 60);
  return `${safe(stem) || "image"}${[".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext) ? ext : ".jpg"}`;
}
