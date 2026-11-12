import { app, Notification } from "electron";
import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { logger } from "../utils/logger";
import { pickSubliminalText, pickNotificationText } from "../utils/textPool";
import { getActiveMoods, isMoodEligible, setActiveMoods } from "../utils/moodState";
import { loadAppIconDataUrl } from "../utils/appIcon";
import { parseDiscordDat } from "../utils/discordDat";
import { resolveBlacklistSource, computeBlacklistTarget } from "../utils/blacklist";

import { Index, Mood, Web, DEFAULT_INDEX, GalleryEntry, GalleryResult } from "../../src/types/pack";
import { buildFileMoods } from "../utils/galleryIndex";
import { addMood, removeMood, renameMood, setFileTags, type RawIndexLike } from "../utils/packEdit";
import {
  parseDesignerScript,
  renameMoodInCorruption,
  renameMoodInDesign,
  replaceDesignInScript,
} from "../../src/features/creator/designerModel";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the app's user data directory for storing config and packs. */
function dataDir(): string {
  return path.join(app.getPath("userData"), "data");
}

/**
 * The pack a running session was started with. While set, content resolvers
 * ignore config.json changes: switching packs applies on the next start,
 * like the legacy app which loads its pack once per run.
 */
let runtimePackDir: string | null = null;

export function setRuntimePackDir(dir: string | null): void {
  runtimePackDir = dir ? expandTilde(dir) : null;
}

/** Resolve the current pack's root directory. */
function currentPackDir(): string | null {
  if (runtimePackDir) return runtimePackDir;
  try {
    const cfg = fs.readFileSync(path.join(dataDir(), "config.json"), "utf-8");
    const parsed = JSON.parse(cfg) as Record<string, unknown>;
    const raw = parsed.packPath as string | undefined;
    return raw ? expandTilde(raw) : null;
  } catch {
    return null;
  }
}

/** Expand ~ in a file path to the user's home directory. */
function expandTilde(filepath: string): string {
  if (filepath.startsWith("~")) {
    return filepath.replace("~", app.getPath("home"));
  }
  return filepath;
}

/** Read and parse a JSON file, returning null on error. */
function readJson<T>(filePath: string): T | null {
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

// ── Legacy Fallback Parsers ─────────────────────────────────────────────────

/**
 * Parse legacy captions.json and return its raw data structure.
 * Returns empty object if file doesn't exist or is malformed.
 */
function loadCaptions(packDir: string): Record<string, unknown> {
  const data = readJson<Record<string, unknown>>(path.join(packDir, "captions.json"));
  if (!data) return {};
  return data;
}

/**
 * Parse legacy prompt.json and return its raw data structure.
 * Returns empty object if file doesn't exist or is malformed.
 */
function loadPrompts(packDir: string): Record<string, unknown> {
  const data = readJson<Record<string, unknown>>(path.join(packDir, "prompt.json"));
  if (!data) return {};
  return data;
}

/**
 * Parse legacy web.json and return its raw data structure.
 * Returns empty object if file doesn't exist or is malformed.
 */
function loadWeb(packDir: string): Record<string, unknown> {
  const data = readJson<Record<string, unknown>>(path.join(packDir, "web.json"));
  if (!data) return {};
  return data;
}

/**
 * Parse legacy media.json and return file-to-mood mapping.
 * Excludes 'default' mood files (matching legacy behavior).
 * Returns empty object if file doesn't exist or is malformed.
 */
function loadMedia(packDir: string): Record<string, string[]> {
  const data = readJson<Record<string, unknown>>(path.join(packDir, "media.json"));
  if (!data) return {};

  const result: Record<string, string[]> = {};
  for (const [moodName, files] of Object.entries(data)) {
    if (moodName === "default") continue;
    if (!Array.isArray(files)) continue;
    for (const file of files) {
      if (typeof file === "string") {
        const list = (result[file] ??= []);
        if (!list.includes(moodName)) list.push(moodName);
      }
    }
  }
  return result;
}

/** Helper: get or create a mood in the index moods array. */
function getOrCreateMood(moods: Mood[], name: string): Mood {
  let mood = moods.find((m) => m.name === name);
  if (!mood) {
    mood = {
      name,
      maxClicks: 1,
      captions: [],
      denial: [],
      subliminals: [],
      notifications: [],
      prompts: [],
      web: [],
    };
    moods.push(mood);
  }
  return mood;
}

/**
 * Build an Index object from legacy fallback files (captions.json, prompt.json,
 * web.json, media.json). Mirrors the behavior of load_index_fallback in load.py.
 */
function loadIndexFallback(packDir: string): Index {
  const captions = loadCaptions(packDir);
  const prompts = loadPrompts(packDir);
  const webData = loadWeb(packDir);
  const mediaMoods = loadMedia(packDir);

  const index: Index = {
    default: { ...DEFAULT_INDEX.default },
    moods: [],
    mediaMoods,
  };

  // ── Captions ──
  index.default.captions = (captions["default"] as string[]) ?? [];
  index.default.denial = (captions["denial"] as string[]) ?? [];
  index.default.subliminals = (captions["subliminals"] as string[]) ?? [];
  index.default.notifications = (captions["notifications"] as string[]) ?? [];
  if (captions["subtext"]) {
    index.default.popupClose = captions["subtext"] as string;
  }

  const prefixList = captions["prefix"] as string[] | undefined;
  const prefixSettings = captions["prefix_settings"] as Record<string, Record<string, unknown>> | undefined;

  if (prefixList && Array.isArray(prefixList)) {
    for (const moodName of prefixList) {
      if (moodName === "default") continue;
      const mood = getOrCreateMood(index.moods, moodName);
      mood.captions = (captions[moodName] as string[]) ?? [];
      if (prefixSettings && prefixSettings[moodName]) {
        const settings = prefixSettings[moodName];
        if (typeof settings["max"] === "number") {
          mood.maxClicks = settings["max"] as number;
        }
      }
    }
  }

  // ── Prompts ──
  index.default.prompts = (prompts["default"] as string[]) ?? [];
  if (prompts["subtext"]) {
    index.default.promptSubmit = prompts["subtext"] as string;
  }
  if (prompts["commandtext"]) {
    index.default.promptCommand = prompts["commandtext"] as string;
  }
  if (typeof prompts["minLen"] === "number") {
    index.default.promptMinLength = prompts["minLen"] as number;
  }
  if (typeof prompts["maxLen"] === "number") {
    index.default.promptMaxLength = prompts["maxLen"] as number;
  }

  const moodNames = prompts["moods"] as string[] | undefined;
  if (moodNames && Array.isArray(moodNames)) {
    for (const moodName of moodNames) {
      if (moodName === "default") continue;
      const mood = getOrCreateMood(index.moods, moodName);
      mood.prompts = (prompts[moodName] as string[]) ?? [];
    }
  }

  // ── Media moods: ensure moods exist ──
  for (const moodName of new Set(Object.values(mediaMoods).flat())) {
    if (moodName === "default") continue;
    getOrCreateMood(index.moods, moodName);
  }

  // ── Web URLs ──
  const urls = webData["urls"] as string[] | undefined;
  const argsList = webData["args"] as string[] | undefined;
  const webMoods = webData["moods"] as (string | null | undefined)[] | undefined;

  if (urls && Array.isArray(urls)) {
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      const argsRaw = argsList && argsList[i] ? argsList[i] : "";
      const args = typeof argsRaw === "string" ? argsRaw.split(",") : [];
      const webEntry: Web = { url, args };
      const moodName = webMoods && webMoods[i] ? webMoods[i] : null;

      if (moodName === null || moodName === "default" || moodName === undefined) {
        index.default.web.push(webEntry);
      } else {
        const mood = getOrCreateMood(index.moods, moodName);
        mood.web.push(webEntry);
      }
    }
  }

  return index;
}

/**
 * Parse modern index.json into a proper Index object.
 * Returns null if file doesn't exist or is malformed.
 */
function loadModernIndex(packDir: string): Index | null {
  const data = readJson<Record<string, unknown>>(path.join(packDir, "index.json"));
  if (!data) return null;

  const rawData = data as Record<string, unknown>;

  // Parse default section
  const defaultRaw = rawData["default"] as Record<string, unknown> | undefined;
  if (!defaultRaw) return null;

  const defaultObj = {
    maxClicks: typeof defaultRaw["maxClicks"] === "number" ? defaultRaw["maxClicks"] : 1,
    captions: Array.isArray(defaultRaw["captions"]) ? defaultRaw["captions"] : [],
    denial: Array.isArray(defaultRaw["denial"]) ? defaultRaw["denial"] : [],
    subliminals: Array.isArray(defaultRaw["subliminals"]) ? defaultRaw["subliminals"] : [],
    notifications: Array.isArray(defaultRaw["notifications"]) ? defaultRaw["notifications"] : [],
    prompts: Array.isArray(defaultRaw["prompts"]) ? defaultRaw["prompts"] : [],
    web: Array.isArray(defaultRaw["web"]) ? parseWebArray(defaultRaw["web"] as unknown[], defaultRaw["webArgs"] as unknown[] | undefined) : [],
    popupClose: typeof defaultRaw["popupClose"] === "string" ? defaultRaw["popupClose"] : DEFAULT_INDEX.default.popupClose,
    promptCommand: typeof defaultRaw["promptCommand"] === "string" ? defaultRaw["promptCommand"] : DEFAULT_INDEX.default.promptCommand,
    promptSubmit: typeof defaultRaw["promptSubmit"] === "string" ? defaultRaw["promptSubmit"] : DEFAULT_INDEX.default.promptSubmit,
    promptMinLength: typeof defaultRaw["promptMinLength"] === "number" ? defaultRaw["promptMinLength"] : 1,
    promptMaxLength: typeof defaultRaw["promptMaxLength"] === "number" ? defaultRaw["promptMaxLength"] : 1,
  };

  // Parse moods
  const rawMoods = rawData["moods"] as Record<string, unknown>[] | undefined;
  const moods: Mood[] = [];
  const mediaMoods: Record<string, string[]> = {};

  if (rawMoods && Array.isArray(rawMoods)) {
    for (const rawMood of rawMoods) {
      const name = typeof rawMood["mood"] === "string" ? rawMood["mood"] : undefined;
      const webUrls = Array.isArray(rawMood["web"]) ? parseWebArray(rawMood["web"] as unknown[], rawMood["webArgs"] as unknown[] | undefined) : [];

      const mood: Mood = {
        name,
        maxClicks: typeof rawMood["maxClicks"] === "number" ? rawMood["maxClicks"] : 1,
        captions: Array.isArray(rawMood["captions"]) ? rawMood["captions"] : [],
        denial: Array.isArray(rawMood["denial"]) ? rawMood["denial"] : [],
        subliminals: Array.isArray(rawMood["subliminals"]) ? rawMood["subliminals"] : [],
        notifications: Array.isArray(rawMood["notifications"]) ? rawMood["notifications"] : [],
        prompts: Array.isArray(rawMood["prompts"]) ? rawMood["prompts"] : [],
        web: webUrls,
      };
      moods.push(mood);

      // Build mediaMoods from mood.media arrays (a file may carry any
      // number of mood tags; any active tag makes it eligible)
      const mediaList = rawMood["media"] as string[] | undefined;
      if (mediaList && Array.isArray(mediaList) && name) {
        for (const file of mediaList) {
          const list = (mediaMoods[file] ??= []);
          if (!list.includes(name)) list.push(name);
        }
      }
    }
  }

  return {
    default: defaultObj,
    moods,
    mediaMoods,
  };
}

/** Parse web URLs with optional webArgs into Web array. */
function parseWebArray(webUrls: unknown[], webArgs?: unknown[]): Web[] {
  const result: Web[] = [];
  if (!Array.isArray(webUrls)) return result;

  const argsArr = Array.isArray(webArgs) ? webArgs : [];
  for (let i = 0; i < webUrls.length; i++) {
    const url = webUrls[i];
    if (typeof url !== "string") continue;

    let args: string[] = [];
    if (i < argsArr.length && Array.isArray(argsArr[i])) {
      const item = argsArr[i] as unknown[];
      args = item.filter((a): a is string => typeof a === "string");
    }

    result.push({ url, args });
  }
  return result;
}

/**
 * Load the pack index, trying modern index.json first, then falling back to
 * legacy format files (captions.json, prompt.json, web.json, media.json).
 * If neither exists, return an empty Index with default values.
 */
function loadPackIndex(packDir: string): Index {
  const modern = loadModernIndex(packDir);
  if (modern) return modern;

  return loadIndexFallback(packDir);
}

let galleryRevision = 0;

/** Invalidate the memoized gallery directory scan (creator file writes). */
export function invalidateGalleryScan(): void {
  galleryRevision += 1;
}

/** User-starred gallery files, shared by the gallery view and the toggle. */
function readFavouritesList(): string[] {
  try {
    const list = readJson<unknown>(path.join(dataDir(), "gallery_favourites.json"));
    return Array.isArray(list) ? list.filter((k): k is string => typeof k === "string") : [];
  } catch {
    return [];
  }
}

/** Gallery favourite keys are "<dir>/<file>" under a known media dir. */
const GALLERY_DIR_BY_KIND = new Set(["img/", "vid/", "aud/"]);

function favouriteKey(entry: GalleryEntry): string {
  const dir = entry.kind === "image" ? "img/" : entry.kind === "video" ? "vid/" : "aud/";
  return `${dir}${entry.file}`;
}

/** Write JSON via temp file + rename so a crash never leaves a half-written file. */
function writePackJson(file: string, value: unknown): void {
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2), "utf-8");
  fs.renameSync(tmp, file);
}

/** A directory is browsable as a pack only if it ships pack manifests. */
export function looksLikePack(dir: string): boolean {
  return (
    fs.existsSync(path.join(dir, "info.json")) ||
    fs.existsSync(path.join(dir, "index.json")) ||
    fs.existsSync(path.join(dir, "captions.json")) ||
    fs.existsSync(path.join(dir, "media.json"))
  );
}

// ── Content resolvers (shared by IPC handlers and the Lua scripting host) ────

/**
 * Random file from a pack media dir, mood-gated legacy-style: untagged files
 * are always eligible; files tagged with a mood need that mood active.
 */
function pickMoodEligibleFile(packDir: string, subdir: string, pattern: RegExp): string | null {
  const dirPath = path.join(packDir, subdir);
  if (!fs.existsSync(dirPath)) return null;
  const all = fs.readdirSync(dirPath).filter((f) => pattern.test(f) && !f.startsWith("."));
  if (!all.length) return null;
  let mediaMoods: Record<string, string[]> = {};
  try {
    mediaMoods = loadPackIndex(packDir).mediaMoods ?? {};
  } catch {
    /* index unreadable → treat everything as untagged */
  }
  const eligible = all.filter((f) => isMoodEligible(mediaMoods[f]));
  return eligible.length ? eligible[Math.floor(Math.random() * eligible.length)] : null;
}

/** Moods of the active pack that are currently enabled (default excluded). */
function activeIndexMoods(idx: Index): Index["moods"] {
  const active = getActiveMoods();
  return (idx.moods ?? []).filter((m) => m.name && active.has(m.name));
}

/** A random image filename from the active pack's img/ dir, or null. */
export function resolveRandomImage(): string | null {
  const packDir = currentPackDir();
  if (!packDir) return null;
  try {
    return pickMoodEligibleFile(packDir, "img", /\.(png|jpg|jpeg|gif|webp)$/i);
  } catch (err) {
    logger.error("[Pack] Failed to read random image:", err);
    return null;
  }
}

/** A random audio filename from the active pack's aud/ dir, or null. */
export function resolveRandomAudio(): string | null {
  const packDir = currentPackDir();
  if (!packDir) return null;
  try {
    return pickMoodEligibleFile(packDir, "aud", /\.(mp3|wav|ogg|flac)$/i);
  } catch (err) {
    logger.error("[Pack] Failed to read random audio:", err);
    return null;
  }
}

/** A random video filename from the active pack's vid/ dir, or null. */
export function resolveRandomVideo(): string | null {
  const packDir = currentPackDir();
  if (!packDir) return null;
  try {
    return pickMoodEligibleFile(packDir, "vid", /\.(mp4|webm|mkv)$/i);
  } catch (err) {
    logger.error("[Pack] Failed to read random video:", err);
    return null;
  }
}

// Runtime override applied by pack scripts (set_popup_close_text).
let closeLabelOverride: string | null = null;

export function setCloseLabelOverride(text: string): void {
  closeLabelOverride = text;
}

/** The pack-defined popup close-button label, or null. */
export function resolveCloseLabel(): string | null {
  if (closeLabelOverride) return closeLabelOverride;
  const packDir = currentPackDir();
  if (!packDir) return null;
  try {
    const idx = loadPackIndex(packDir);
    const label = idx.default?.popupClose ?? null;
    return typeof label === "string" && label.trim() ? label : null;
  } catch (err) {
    logger.error("[Pack] Failed to read close label:", err);
    return null;
  }
}

/**
 * A random prompt phrase from the active pack (default + all moods), or null.
 * Legacy packs join 1..N random prompt pieces into one phrase, bounded by
 * index.default.promptMinLength/promptMaxLength (piece counts, not chars).
 */
export function resolveRandomPrompt(): string | null {
  const packDir = currentPackDir();
  if (!packDir) return null;
  try {
    const idx = loadPackIndex(packDir);
    const pool: string[] = [
      ...(idx.default?.prompts ?? []).filter((p) => typeof p === "string" && p.trim()),
      ...activeIndexMoods(idx).flatMap((m) =>
        (m.prompts ?? []).filter((p) => typeof p === "string" && p.trim())
      ),
    ];
    if (!pool.length) return null;

    let min = idx.default?.promptMinLength ?? 1;
    let max = idx.default?.promptMaxLength ?? min;
    if (max < min) [min, max] = [max, min];
    if (min < 1) min = 1;

    const count = min + Math.floor(Math.random() * (max - min + 1));
    let prompt = "";
    for (let i = 0; i < count; i++) {
      prompt += pool[Math.floor(Math.random() * pool.length)] + " ";
    }
    return prompt.trim();
  } catch (err) {
    logger.error("[Pack] Failed to read random prompt:", err);
    return null;
  }
}

/**
 * A random web URL from the active pack (default + all moods), or null.
 * Mirrors legacy open_web(pack) → pack.random_web(): the raw url plus one of
 * its args (legacy concatenates them, so we do the same).
 */
export function resolveRandomWeb(): string | null {
  const packDir = currentPackDir();
  if (!packDir) return null;
  try {
    const idx = loadPackIndex(packDir);
    const pool: Array<{ url: string; args: string[] }> = [
      ...(idx.default?.web ?? []).filter((w) => typeof w?.url === "string" && w.url.trim()),
      ...activeIndexMoods(idx).flatMap((m) =>
        (m.web ?? []).filter((w) => typeof w?.url === "string" && !!(w.url as string).trim())
      ),
    ];
    if (!pool.length) return null;
    const entry = pool[Math.floor(Math.random() * pool.length)];
    const args = Array.isArray(entry.args) && entry.args.length ? entry.args : [""];
    const arg = args[Math.floor(Math.random() * args.length)];
    return String(arg) ? entry.url + String(arg) : entry.url;
  } catch (err) {
    logger.error("[Pack] Failed to read random web url:", err);
    return null;
  }
}

/** A random notification text from the active pack, or null. */
export function resolveNotificationText(): string | null {
  const packDir = currentPackDir();
  if (!packDir) return null;
  try {
    return pickNotificationText(loadPackIndex(packDir), Math.random, getActiveMoods());
  } catch (err) {
    logger.error("[Pack] Failed to read random notification text:", err);
    return null;
  }
}

/** A random subliminal text from the active pack, or null. */
export function resolveSubliminalText(): string | null {
  const packDir = currentPackDir();
  if (!packDir) return null;
  try {
    return pickSubliminalText(loadPackIndex(packDir), Math.random, getActiveMoods());
  } catch (err) {
    logger.error("[Pack] Failed to read random subliminal text:", err);
    return null;
  }
}

/** The active pack directory, or null. */
export function activePackPath(): string | null {
  return currentPackDir();
}

/** The active pack's display name, or null. */
export function resolvePackName(): string | null {
  const packDir = currentPackDir();
  if (!packDir) return null;
  const info = readJson<Record<string, unknown>>(path.join(packDir, "info.json"));
  const name = info?.name;
  return typeof name === "string" && name.trim() ? name : null;
}

// ── IPC Handlers ─────────────────────────────────────────────────────────────

function registerHandlers(): void {
  ipcMain.handle("pack:loadInfo", async (): Promise<Partial<Record<string, unknown>> | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;

    try {
      const index = readJson<Index>(path.join(packDir, "index.json"));
      if (index) return index as unknown as Partial<Record<string, unknown>>;

      const info = readJson<Record<string, unknown>>(path.join(packDir, "info.json"));
      if (info) return info;

      return loadPackIndex(packDir) as unknown as Partial<Record<string, unknown>>;
    } catch {
      return null;
    }
  });

  ipcMain.handle("pack:loadIndex", async (): Promise<Index | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;

    try {
      return loadPackIndex(packDir);
    } catch {
      return DEFAULT_INDEX;
    }
  });

  ipcMain.handle("pack:listFiles", async (_event, dir: "aud" | "vid" | "img"): Promise<string[]> => {
    const packDir = currentPackDir();
    if (!packDir) return [];
    try {
      const mediaDir = path.join(packDir, dir);
      if (!fs.existsSync(mediaDir)) return [];
      return fs.readdirSync(mediaDir).filter((f) => f.endsWith(".png") || f.endsWith(".jpg") || f.endsWith(".gif") || f.endsWith(".webm") || f.endsWith(".mp4") || f.endsWith(".mp3") || f.endsWith(".wav") || f.endsWith(".ogg"));
    } catch {
      return [];
    }
  });

  ipcMain.handle("pack:randomImage", async (): Promise<string | null> => resolveRandomImage());

  ipcMain.handle("pack:randomAudio", async (): Promise<string | null> => resolveRandomAudio());

  ipcMain.handle("pack:randomVideo", async (): Promise<string | null> => resolveRandomVideo());

  // ── Pop-up content resolvers ───────────────────────────────────────────────

  /** The pack-defined text shown on the image/video close button (e.g. "I submit <3"). */
  ipcMain.handle("pack:closeLabel", async (): Promise<string | null> => resolveCloseLabel());

  /** A random prompt phrase from the active pack (default + all moods), or null. */
  ipcMain.handle("pack:randomPrompt", async (): Promise<string | null> => resolveRandomPrompt());

  /**
   * A random web URL from the active pack (default + all moods), or null.
   * Mirrors legacy open_web(pack) → pack.random_web(): the raw url plus one of
   * its args (legacy concatenates them, so we do the same).
   */
  ipcMain.handle("pack:randomWeb", async (): Promise<string | null> => resolveRandomWeb());

  /**
   * A random spiral/hypno image from the active pack, or null.
   * Checks `hypno/` first, then the pre-v17 `subliminals/` dir (legacy packs).
   * Returns a subdir-qualified name ("hypno/x.gif") so the renderer can anchor the
   * packmedia URL to the exact directory the file lives in.
   */
  ipcMain.handle("pack:randomHypnoGif", async (): Promise<string | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    try {
      for (const dir of ["hypno", "subliminals"]) {
        const dirPath = path.join(packDir, dir);
        if (!fs.existsSync(dirPath)) continue;
        const all = fs
          .readdirSync(dirPath)
          .filter((f) => /\.(gif|png|jpe?g|webp)$/i.test(f));
        if (all.length) return `${dir}/${all[Math.floor(Math.random() * all.length)]}`;
      }
      return null;
    } catch (err) {
      logger.error("[Pack] Failed to read random hypno gif:", err);
      return null;
    }
  });

  /**
   * A random subliminal text for the legacy text popup, or null.
   * Pool: pack `subliminals` lists (default + moods), falling back to
   * `captions` — mirrors legacy pack.random_subliminal().
   */
  ipcMain.handle("pack:randomSubliminalText", async (): Promise<string | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    try {
      return pickSubliminalText(loadPackIndex(packDir), Math.random, getActiveMoods());
    } catch (err) {
      logger.error("[Pack] Failed to read random subliminal text:", err);
      return null;
    }
  });

  /**
   * The pack's Discord presence payload from `resource/discord.dat`
   * (legacy format: line 1 = status text, optional line 2 = artwork key).
   * Returns null when the pack ships no discord.dat.
   */
  ipcMain.handle(
    "pack:discord",
    async (): Promise<{ text: string; image: string | null } | null> => {
      const packDir = currentPackDir();
      if (!packDir) return null;
      const file = path.join(packDir, "resource", "discord.dat");
      if (!fs.existsSync(file)) return null;
      try {
        return parseDiscordDat(fs.readFileSync(file, "utf-8"));
      } catch (err) {
        logger.error("[Pack] Failed to read discord.dat:", err);
        return null;
      }
    }
  );

  /**
   * A random notification text for the notification popup type, or null.
   * Pool: pack `notifications` lists (default + moods), falling back to
   * captions — mirrors legacy pack.random_notification().
   */
  ipcMain.handle("pack:randomNotificationText", async (): Promise<string | null> =>
    resolveNotificationText()
  );

  /**
   * The app icon (pack icon.ico/icon.png, falling back to the bundled
   * default) as a data URL for the header logo, or null.
   */
  ipcMain.handle("pack:iconImage", async (): Promise<string | null> => {
    return loadAppIconDataUrl(currentPackDir());
  });

  /**
   * The pack's startup splash image as a data URL, or null when the pack
   * ships none. Candidates mirror the legacy pack layout: the first existing
   * loading_splash.{png,gif,jpg,jpeg,bmp} at the pack root, then under
   * resource/.
   */
  ipcMain.handle("pack:splashImage", async (): Promise<string | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    const mime: Record<string, string> = {
      ".png": "image/png",
      ".gif": "image/gif",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".bmp": "image/bmp",
    };
    try {
      for (const dir of [packDir, path.join(packDir, "resource")]) {
        for (const [ext, type] of Object.entries(mime)) {
          const candidate = path.join(dir, `loading_splash${ext}`);
          if (fs.existsSync(candidate)) {
            return `${type};base64,${fs.readFileSync(candidate).toString("base64")}`;
          }
        }
      }
      return null;
    } catch (err) {
      logger.error("[Pack] Failed to read splash image:", err);
      return null;
    }
  });

  /**
   * Mirror the renderer's active corruption moods into the main process so
   * content resolvers gate mood-tagged media and text like the legacy app.
   */
  ipcMain.handle("pack:setActiveMoods", async (_event, moods: unknown): Promise<void> => {
    setActiveMoods(Array.isArray(moods) ? moods.filter((m): m is string => typeof m === "string") : []);
  });

  /** The active pack's mood catalogue for the moods panel. */
  ipcMain.handle(
    "pack:listMoods",
    async (): Promise<Array<{ name: string; mediaCount: number; captionCount: number }>> => {
      const packDir = currentPackDir();
      if (!packDir) return [];
      try {
        const idx = loadPackIndex(packDir);
        const mediaMoods = idx.mediaMoods ?? {};
        const mediaCount = (name: string) =>
          Object.values(mediaMoods).filter((tags) => tags.includes(name)).length;
        return (idx.moods ?? [])
          .filter((m): m is Index["moods"][number] & { name: string } => typeof m.name === "string" && !!m.name)
          .map((m) => ({
            name: m.name,
            mediaCount: mediaCount(m.name),
            captionCount: (m.captions ?? []).length,
          }));
      } catch (err) {
        logger.error("[Pack] Failed to list moods:", err);
        return [];
      }
    }
  );

  /**
   * The pack's suggested configuration (its config.json), with the legacy
   * filter: version markers and the pack path are never presets.
   */
  ipcMain.handle("pack:loadPackConfig", async (): Promise<Record<string, unknown> | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    const cfg = readJson<Record<string, unknown>>(path.join(packDir, "config.json"));
    if (!cfg) return null;
    const filtered: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(cfg)) {
      if (key === "version" || key === "versionplusplus" || key === "packPath") continue;
      filtered[key] = value;
    }
    return filtered;
  });

  /** Whether the active pack ships a script.lua (scripted corruption). */
    // The directory scan is memoized per pack: switching to the Gallery or
  // Creator tab repeatedly must not re-walk thousands of files. Creator
  // writes bump the revision; a pack-path change misses the key naturally.
  let galleryScan: { key: string; entries: GalleryEntry[]; moods: string[] } | null = null;

/**
   * Every media file the active pack ships, tagged with its moods, for the
   * gallery browser. Untagged files are default content; the mood list and
   * currently-active moods let the UI group and badge entries.
   */
  ipcMain.handle("pack:listGallery", async (_event, packPathArg?: unknown): Promise<GalleryResult> => {
    // The renderer passes the store's packPath: switching packs is visible
    // in the store before the autosave reaches disk, and reading a
    // directory off disk would race that flush.
    const requested = typeof packPathArg === "string" && packPathArg ? packPathArg : null;
    const packDir = requested ?? currentPackDir();
    const activeMoods = [...getActiveMoods()];
    const favourites = readFavouritesList();
    if (!packDir || !fs.existsSync(packDir) || !looksLikePack(packDir)) {
      return { entries: [], moods: [], activeMoods, favourites };
    }
    try {
      if (!galleryScan || galleryScan.key !== `${packDir}#${galleryRevision}`) {
        const indexRaw = readJson<{ moods?: Array<{ mood?: unknown; media?: unknown }> }>(
          path.join(packDir, "index.json")
        );
        const legacyMedia = readJson<Record<string, unknown>>(path.join(packDir, "media.json"));
        const fileMoods = buildFileMoods(indexRaw?.moods, legacyMedia ?? undefined);

        const dirs: Array<[string, GalleryEntry["kind"], RegExp]> = [
          ["img", "image", /\.(png|jpg|jpeg|gif|webp)$/i],
          ["vid", "video", /\.(mp4|webm|mkv)$/i],
          ["aud", "audio", /\.(mp3|wav|ogg|flac)$/i],
        ];
        const entries: GalleryEntry[] = [];
        for (const [subdir, kind, pattern] of dirs) {
          const dirPath = path.join(packDir, subdir);
          if (!fs.existsSync(dirPath)) continue;
          for (const file of fs.readdirSync(dirPath).filter((f) => pattern.test(f) && !f.startsWith("."))) {
            entries.push({ file, kind, moods: fileMoods[file] ?? [] });
          }
        }
        galleryScan = {
          key: `${packDir}#${galleryRevision}`,
          entries,
          moods: [...new Set(entries.flatMap((e) => e.moods))].sort(),
        };
      }
      const { entries, moods } = galleryScan;
      const keys = new Set(entries.map(favouriteKey));
      return { entries, moods, activeMoods, favourites: favourites.filter((k) => keys.has(k)) };
    } catch (err) {
      logger.error("[Pack] Failed to list gallery:", err);
      return { entries: [], moods: [], activeMoods, favourites: [] };
    }
  });

  // ── Gallery favourites (user stars, persisted across packs and boots) ──

  ipcMain.handle("pack:listFavourites", async (): Promise<string[]> => readFavouritesList());

  ipcMain.handle(
    "pack:setFavourite",
    async (_event, key: unknown, favourite: unknown): Promise<string[]> => {
      if (
        typeof key !== "string" ||
        ![...GALLERY_DIR_BY_KIND].some((prefix) => key.startsWith(prefix)) ||
        typeof favourite !== "boolean"
      ) {
        return readFavouritesList();
      }
      const set = new Set(readFavouritesList());
      if (favourite) set.add(key);
      else set.delete(key);
      const next = [...set].sort();
      try {
        fs.mkdirSync(dataDir(), { recursive: true });
        fs.writeFileSync(path.join(dataDir(), "gallery_favourites.json"), JSON.stringify(next, null, 1), "utf-8");
      } catch (err) {
        logger.error("[Pack] Failed to persist gallery favourites:", err);
      }
      return next;
    }
  );

/**
   * Creator tools: edit the pack's own index.json. Every mutation takes the
   * pack path explicitly (validated as a pack directory) and preserves
   * unrecognized fields by editing the parsed object in place.
   */
  const editableIndex = (packPath: unknown): { dir: string; index: RawIndexLike } | null => {
    if (typeof packPath !== "string" || !packPath) return null;
    const dir = expandTilde(packPath);
    if (!fs.existsSync(dir) || !looksLikePack(dir)) return null;
    const raw = readJson<unknown>(path.join(dir, "index.json"));
    if (raw !== null) {
      // An index that is not a JSON object (array, string, number) cannot be
      // edited without mangling it; refuse until the file is fixed.
      if (typeof raw !== "object" || Array.isArray(raw)) return null;
    }
    const index = (raw as RawIndexLike | null) ?? { default: {}, moods: [] };
    return { dir, index };
  };

  const writeIndex = (dir: string, index: RawIndexLike): void => {
    writePackJson(path.join(dir, "index.json"), index);
    invalidateGalleryScan();
  };

  ipcMain.handle(
    "pack:getEditableIndex",
    async (_event, packPath: unknown): Promise<RawIndexLike | null> => {
      const ctx = editableIndex(packPath);
      return ctx ? ctx.index : null;
    }
  );

  ipcMain.handle(
    "pack:setFileTags",
    async (_event, packPath: unknown, file: unknown, tags: unknown): Promise<RawIndexLike | null> => {
      const ctx = editableIndex(packPath);
      if (!ctx || typeof file !== "string" || !file || !Array.isArray(tags)) return null;
      const clean = tags.filter((t): t is string => typeof t === "string");
      const next = setFileTags(ctx.index, file, clean);
      try {
        writeIndex(ctx.dir, next);
      } catch (err) {
        logger.error("[Pack] Failed to save file tags:", err);
        return null;
      }
      return next;
    }
  );

  ipcMain.handle(
    "pack:addMood",
    async (_event, packPath: unknown, name: unknown): Promise<RawIndexLike | null> => {
      const ctx = editableIndex(packPath);
      if (!ctx || typeof name !== "string" || !name.trim()) return null;
      const next = addMood(ctx.index, name);
      try {
        writeIndex(ctx.dir, next);
      } catch (err) {
        logger.error("[Pack] Failed to add mood:", err);
        return null;
      }
      return next;
    }
  );

/**
   * A mood rename/removal (to = "" means removed) must reach the artifacts
   * that name moods by string: the corruption.json level tables and the
   * design embedded in a generated script.lua. Hand-written scripts without
   * a designer marker are left alone.
   */
  const propagateMoodChange = (dir: string, from: string, to: string): void => {
    const corruptionPath = path.join(dir, "corruption.json");
    try {
      const raw = fs.readFileSync(corruptionPath, "utf-8");
      // Unrelated files (never naming this mood) keep their exact bytes.
      if (raw.includes(from)) {
        const corruption = JSON.parse(raw) as Record<string, unknown>;
        if (corruption && typeof corruption === "object" && !Array.isArray(corruption)) {
          writePackJson(corruptionPath, renameMoodInCorruption(corruption, from, to));
        }
      }
    } catch {
      /* absent, unreadable or invalid: nothing to propagate into */
    }
    const scriptPath = path.join(dir, "script.lua");
    if (fs.existsSync(scriptPath)) {
      try {
        const lua = fs.readFileSync(scriptPath, "utf-8");
        const design = lua.includes(from) ? parseDesignerScript(lua) : null;
        if (design) {
          const next = replaceDesignInScript(lua, renameMoodInDesign(design, from, to));
          const tmp = `${scriptPath}.${process.pid}.tmp`;
          fs.writeFileSync(tmp, next, "utf-8");
          fs.renameSync(tmp, scriptPath);
        }
      } catch (err) {
        logger.error("[Pack] Failed to propagate mood change to script.lua:", err);
      }
    }
  };

  ipcMain.handle(
    "pack:renameMood",
    async (_event, packPath: unknown, from: unknown, to: unknown): Promise<RawIndexLike | null> => {
      const ctx = editableIndex(packPath);
      if (!ctx || typeof from !== "string" || typeof to !== "string" || !to.trim()) return null;
      const next = renameMood(ctx.index, from, to);
      // A colliding or blank target returns the index unchanged; report null
      // so the UI does not claim a save that never happened, and never
      // propagate a rename the index refused.
      if (next === ctx.index) return null;
      try {
        writeIndex(ctx.dir, next);
      } catch (err) {
        logger.error("[Pack] Failed to rename mood:", err);
        return null;
      }
      propagateMoodChange(ctx.dir, from, to.trim());
      return next;
    }
  );

  ipcMain.handle(
    "pack:removeMood",
    async (_event, packPath: unknown, name: unknown): Promise<RawIndexLike | null> => {
      const ctx = editableIndex(packPath);
      if (!ctx || typeof name !== "string" || !name) return null;
      const next = removeMood(ctx.index, name);
      if (JSON.stringify(next) === JSON.stringify(ctx.index)) return null;
      try {
        writeIndex(ctx.dir, next);
      } catch (err) {
        logger.error("[Pack] Failed to remove mood:", err);
        return null;
      }
      propagateMoodChange(ctx.dir, name, "");
      return next;
    }
  );

  /** Pin (or release) the pack a running session resolves content from. */
  ipcMain.handle("pack:setRuntimePack", async (_event, dir: unknown): Promise<void> => {
    setRuntimePackDir(typeof dir === "string" && dir ? dir : null);
  });

  ipcMain.handle("pack:hasScript", async (): Promise<boolean> => {
    const packDir = currentPackDir();
    if (!packDir) return false;
    return fs.existsSync(path.join(packDir, "script.lua"));
  });

  /**
   * The pack's raw corruption.json, or null when the pack ships none.
   * Returned unparsed: the danger audit inspects the raw per-level config
   * maps, including keys the runtime would refuse to apply.
   */
  ipcMain.handle("pack:loadCorruption", async (): Promise<Record<string, unknown> | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    return readJson<Record<string, unknown>>(path.join(packDir, "corruption.json"));
  });

  /**
   * Move one pack media file into the blacklist so it can never spawn again,
   * then confirm with a desktop notification (legacy alt+click close behavior).
   * The file is located strictly inside the active pack's img/vid/aud dirs.
   */
  ipcMain.handle(
    "pack:blacklistMedia",
    async (
      _event,
      fileName: string
    ): Promise<{ ok: boolean; movedTo?: string; reason?: string }> => {
      const packDir = currentPackDir();
      if (!packDir) return { ok: false, reason: "no active pack" };
      const source = resolveBlacklistSource(packDir, String(fileName ?? ""));
      if (!source) return { ok: false, reason: "file not found in pack" };

      try {
        const info = readJson<{ name?: unknown }>(path.join(packDir, "info.json"));
        const packName =
          typeof info?.name === "string" && info.name.trim()
            ? info.name
            : path.basename(packDir);
        const fileName = path.basename(source.src);
        const target = computeBlacklistTarget(dataDir(), packName, fileName);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        try {
          fs.renameSync(source.src, target);
        } catch (moveErr) {
          // Packs may live on another volume than the user data dir; rename
          // cannot cross devices, so fall back to copy+delete.
          if ((moveErr as NodeJS.ErrnoException).code !== "EXDEV") throw moveErr;
          fs.copyFileSync(source.src, target);
          fs.rmSync(source.src);
        }
        new Notification({
          title: packName,
          body: `${fileName} has been successfully sent to blacklist`,
        }).show();
        logger.info(`[Pack] Blacklisted ${fileName} → ${target}`);
        return { ok: true, movedTo: target };
      } catch (err) {
        logger.error("[Pack] Failed to blacklist media:", err);
        return { ok: false, reason: "move failed" };
      }
    }
  );
}

export { registerHandlers };

/** Exported for the pack-media protocol so it can scope requests to the active pack. */
export { currentPackDir };
