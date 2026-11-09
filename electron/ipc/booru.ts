/**
 * @file booru — Gelbooru image fetching for the optional downloader.
 *
 * On an image pop with the downloader enabled, the legacy app flips a coin
 * (50%) and, on a hit, shows one random Gelbooru result for the configured
 * tags instead of the pack image. This handler performs search + download in
 * the main process and returns a ready `packmedia://booru-cache/<file>` URL;
 * every failure path returns null so the caller falls back to pack media.
 *
 * Test hooks: `EDGWARE_BOORU_BASE_URL` points the search at a stub server and
 * `EDGWARE_BOORU_ROLL` overrides the coin-flip percentage.
 */
import { app, ipcMain } from "electron";
import fs from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger";
import {
  DEFAULT_BOORU_BASE,
  buildSearchUrl,
  cacheFileName,
  joinTags,
  parseSearchResponse,
} from "../utils/booru";

const FETCH_TIMEOUT_MS = 10000;
const USER_AGENT = "EdgewarePlusPlus/1.0 (cross-platform port)";

function cacheRoot(): string {
  return path.join(app.getPath("userData"), "data", "booru-cache");
}

function rollHit(): boolean {
  const percent = Number(process.env.EDGWARE_BOORU_ROLL ?? 50);
  if (!Number.isFinite(percent)) return false;
  return Math.random() * 100 < percent;
}

async function fetchImage(tags: string): Promise<string | null> {
  if (!rollHit()) return null;
  const base = process.env.EDGWARE_BOORU_BASE_URL || DEFAULT_BOORU_BASE;

  try {
    const search = await fetch(buildSearchUrl(base, joinTags(String(tags ?? ""))), {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT },
    });
    if (!search.ok) {
      logger.warn(`[Booru] search failed with HTTP ${search.status}`);
      return null;
    }
    const fileUrl = parseSearchResponse(await search.json());
    if (!fileUrl) {
      logger.warn(`[Booru] no results for tags "${tags}"`);
      return null;
    }

    const image = await fetch(fileUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": USER_AGENT },
    });
    if (!image.ok) {
      logger.warn(`[Booru] image download failed with HTTP ${image.status}`);
      return null;
    }
    const bytes = Buffer.from(await image.arrayBuffer());
    if (bytes.length === 0) {
      logger.warn("[Booru] image download was empty");
      return null;
    }

    const root = cacheRoot();
    fs.mkdirSync(root, { recursive: true });
    const name = cacheFileName(fileUrl);
    fs.writeFileSync(path.join(root, name), bytes);
    logger.info(`[Booru] cached ${name} (${bytes.length} bytes)`);
    return `packmedia://booru-cache/${encodeURIComponent(name)}`;
  } catch (err) {
    logger.warn("[Booru] fetch failed, falling back to pack media:", err);
    return null;
  }
}

function registerHandlers(): void {
  ipcMain.handle("booru:fetchImage", (_event, tags: string): Promise<string | null> =>
    fetchImage(tags)
  );
}

export { registerHandlers };
