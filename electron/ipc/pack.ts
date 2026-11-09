import { app, Notification } from "electron";
import fs from "node:fs";
import path from "node:path";
import { ipcMain } from "electron";
import { logger } from "../utils/logger";
import { pickSubliminalText, pickNotificationText } from "../utils/textPool";
import { parseDiscordDat } from "../utils/discordDat";
import { resolveBlacklistSource, computeBlacklistTarget } from "../utils/blacklist";

import { Index, Mood, Web, DEFAULT_INDEX } from "../../src/types/pack";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Resolve the app's user data directory for storing config and packs. */
function dataDir(): string {
  return path.join(app.getPath("userData"), "data");
}

/** Resolve the current pack's root directory. */
function currentPackDir(): string | null {
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
function loadMedia(packDir: string): Record<string, string> {
  const data = readJson<Record<string, unknown>>(path.join(packDir, "media.json"));
  if (!data) return {};

  const result: Record<string, string> = {};
  for (const [moodName, files] of Object.entries(data)) {
    if (moodName === "default") continue;
    if (!Array.isArray(files)) continue;
    for (const file of files) {
      if (typeof file === "string") {
        result[file] = moodName;
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
  for (const moodName of new Set(Object.values(mediaMoods))) {
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
  const mediaMoods: Record<string, string> = {};

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

      // Build mediaMoods from mood.media arrays
      const mediaList = rawMood["media"] as string[] | undefined;
      if (mediaList && Array.isArray(mediaList) && name) {
        for (const file of mediaList) {
          mediaMoods[file] = name;
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

  ipcMain.handle("pack:randomImage", async (): Promise<string | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    try {
      const imgDir = path.join(packDir, "img");
      if (!fs.existsSync(imgDir)) return null;
      const all = fs.readdirSync(imgDir).filter((f) => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
      return all.length ? all[Math.floor(Math.random() * all.length)] : null;
    } catch (err) {
      logger.error("[Pack] Failed to read random image:", err);
      return null;
    }
  });

  ipcMain.handle("pack:randomAudio", async (): Promise<string | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    try {
      const audDir = path.join(packDir, "aud");
      if (!fs.existsSync(audDir)) return null;
      const all = fs.readdirSync(audDir).filter((f) => /\.(mp3|wav|ogg|flac)$/i.test(f));
      return all.length ? all[Math.floor(Math.random() * all.length)] : null;
    } catch (err) {
      logger.error("[Pack] Failed to read random audio:", err);
      return null;
    }
  });

  ipcMain.handle("pack:randomVideo", async (): Promise<string | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    try {
      const vidDir = path.join(packDir, "vid");
      if (!fs.existsSync(vidDir)) return null;
      const all = fs.readdirSync(vidDir).filter((f) => /\.(mp4|webm|mkv)$/i.test(f));
      return all.length ? all[Math.floor(Math.random() * all.length)] : null;
    } catch (err) {
      logger.error("[Pack] Failed to read random video:", err);
      return null;
    }
  });

  // ── Pop-up content resolvers ───────────────────────────────────────────────

  /** The pack-defined text shown on the image/video close button (e.g. "I submit <3"). */
  ipcMain.handle("pack:closeLabel", async (): Promise<string | null> => {
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
  });

  /** A random prompt phrase from the active pack (default + all moods), or null. */
  ipcMain.handle("pack:randomPrompt", async (): Promise<string | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    try {
      const idx = loadPackIndex(packDir);
      const pool: string[] = [
        ...(idx.default?.prompts ?? []).filter((p) => typeof p === "string" && p.trim()),
        ...(idx.moods ?? []).flatMap((m) =>
          (m.prompts ?? []).filter((p) => typeof p === "string" && p.trim())
        ),
      ];
      if (!pool.length) return null;

      // Legacy packs join 1..N random prompt pieces into one phrase, bounded by
      // index.default.promptMinLength/promptMaxLength (piece counts, not chars).
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
  });

  /**
   * A random web URL from the active pack (default + all moods), or null.
   * Mirrors legacy open_web(pack) → pack.random_web(): the raw url plus one of
   * its args (legacy concatenates them, so we do the same).
   */
  ipcMain.handle("pack:randomWeb", async (): Promise<string | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    try {
      const idx = loadPackIndex(packDir);
      const pool: Array<{ url: string; args: string[] }> = [
        ...(idx.default?.web ?? []).filter((w) => typeof w?.url === "string" && w.url.trim()),
        ...(idx.moods ?? []).flatMap((m) =>
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
  });

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
      return pickSubliminalText(loadPackIndex(packDir));
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
  ipcMain.handle("pack:randomNotificationText", async (): Promise<string | null> => {
    const packDir = currentPackDir();
    if (!packDir) return null;
    try {
      return pickNotificationText(loadPackIndex(packDir));
    } catch (err) {
      logger.error("[Pack] Failed to read random notification text:", err);
      return null;
    }
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
