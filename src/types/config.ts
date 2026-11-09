import { z } from "zod";

// ─── Primitive validators ───────────────────────────────────────────────────

export const ZodPercentage = z.number().int().min(0).max(100);
export const ZodNonNegative = z.number().int().min(0);
export const ZodBoolean = z.number().int().min(0).max(1);
export const ZodString = z.string();

/** Enum: danger level matching Python's `DangerLevel`. */
export const ZodDangerLevel = z.enum(["extreme", "major", "medium", "minor"]);

export interface Danger {
  level: z.infer<typeof ZodDangerLevel>;
  description: string;
}


// ─── Transform utilities ────────────────────────────────────────────────────

/** Convert integer percentage (0–100) to float (0.0–1.0). */
export function toFloat(value: number): number {
  return Math.min(1, value / 100);
}

/** Convert integer seconds to milliseconds. */
export function sToMs(value: number): number {
  return value * 1000;
}

/** Negate a boolean (used by corruption wallpaper/theme cycle toggles). */
export function negation<T>(value: T): T {
  if (typeof value === "boolean") return (value ? 0 : 1) as unknown as T;
  return value;
}

// ─── Config item definitions (93 keys) ──────────────────────────────────────

export type ConfigKey = keyof typeof CONFIG_ITEMS;

/** Mapping from Python-style internal keys to the camelCase field used in the store. */
export const CONFIG_KEYS_TO_FIELD: Record<string, string> = {
  packPath: "packPath",
  themeType: "themeType",
  themeNoConfig: "themeNoConfig",
  showLoadingFlair: "showLoadingFlair",
  runOnSaveQuit: "runOnSaveQuit",
  desktopIcons: "desktopIcons",
  safeMode: "safeMode",
  messageOff: "messageOff",
  globalPanicButton: "globalPanicButton",
  presetsDanger: "presetsDanger",
  delay: "delay",
  singleMode: "singleMode",
  popupMod: "popupMod",
  audioMod: "audioMod",
  maxAudio: "maxAudio",
  audioVolume: "audioVolume",
  fadeInDuration: "fadeInDuration",
  fadeOutDuration: "fadeOutDuration",
  vidMod: "vidMod",
  maxVideos: "maxVideos",
  videoVolume: "videoVolume",
  webMod: "webMod",
  webPopup: "webPopup",
  promptMod: "promptMod",
  promptMistakes: "promptMistakes",
  capPopChance: "capPopChance",
  capPopTimer: "capPopTimer",
  capPopOpacity: "capPopOpacity",
  notificationChance: "notificationChance",
  notificationImageChance: "notificationImageChance",
  showCaptions: "showCaptions",
  subliminalsChance: "subliminalsChance",
  subliminalsAlpha: "subliminalsAlpha",
  denialChance: "denialChance",
  buttonless: "buttonless",
  multiClick: "multiClick",
  lkScaling: "lkScaling",
  timeoutPopups: "timeoutPopups",
  popupTimeout: "popupTimeout",
  disabledMonitors: "disabledMonitors",
  movingChance: "movingChance",
  movingSpeed: "movingSpeed",
  clickthroughPopups: "clickthroughPopups",
  rotateWallpaper: "rotateWallpaper",
  wallpaperDat: "wallpaperDat",
  wallpaperTimer: "wallpaperTimer",
  wallpaperVariance: "wallpaperVariance",
  downloadEnabled: "downloadEnabled",
  tagList: "tagList",
  timerMode: "timerMode",
  safeword: "safeword",
  timerSetupTime: "timerSetupTime",
  avoidList: "avoidList",
  fill: "fill",
  fillDelay: "fillDelay",
  replace: "replace",
  replaceThresh: "replaceThresh",
  drivePath: "drivePath",
  panicDisabled: "panicDisabled",
  startOnLogon: "startOnLogon",
  showDiscord: "showDiscord",
  lkToggle: "lkToggle",
  lkCorner: "lkCorner",
  mitosisMode: "mitosisMode",
  mitosisStrength: "mitosisStrength",
  hibernateMode: "hibernateMode",
  hibernateType: "hibernateType",
  hibernateMin: "hibernateMin",
  hibernateMax: "hibernateMax",
  wakeupActivity: "wakeupActivity",
  hibernateLength: "hibernateLength",
  fixWallpaper: "fixWallpaper",
  corruptionMode: "corruptionMode",
  corruptionFullPerm: "corruptionFullPerm",
  corruptionTrigger: "corruptionTrigger",
  corruptionFadeType: "corruptionFadeType",
  corruptionTime: "corruptionTime",
  corruptionPopups: "corruptionPopups",
  corruptionLaunches: "corruptionLaunches",
  corruptionWallpaperCycle: "corruptionWallpaperCycle",
  corruptionThemeCycle: "corruptionThemeCycle",
  corruptionPurityMode: "corruptionPurityMode",
  corruptionDevMode: "corruptionDevMode",
  toggleHibSkip: "toggleHibSkip",
  toggleMoodSet: "toggleMoodSet",
  toggleInternet: "toggleInternet",
  mpvSubprocess: "mpvSubprocess",
  videoHardwareAcceleration: "videoHardwareAcceleration",
  panicButton: "panicButton",
  schedule: "schedule",
  timeType: "timeType",
  scheduleTime: "scheduleTime",
  varianceTime: "varianceTime",
  varianceType: "varianceType",
  repeatSchedule: "repeatSchedule",
  repeatType: "repeatType",
  repeatTime: "repeatTime",
};

export const RUN_ON_SAVE_QUIT_DANGER =
  "Edgeware will run on Save & Exit (AKA: when you hit Yes!)";
const PANIC_LOCKOUT_DANGER =
  "Panic Lockout is enabled! Panic cannot be used until a specific time! Make sure you know your Safeword!";
const MITOSIS_MODE_DANGER =
  "Mitosis Mode is enabled! With high popup rates, this could create a chain reaction, causing lag!";
const HIBERNATE_DELAY_MIN_DANGER =
  "You are running Hibernate Mode with a short minimum cooldown! You might experience lag!";
const HIBERNATE_DELAY_MAX_DANGER =
  "You are running Hibernate Mode with a short maximum cooldown! You might experience lag!";
const SHOW_ON_DISCORD_DANGER =
  "Show on Discord is enabled! This could lead to potential embarrassment!";
const PANIC_DISABLED_DANGER =
  "Panic Hotkey is disabled! If you want to easily close Edgeware, check the documentation!";
const FILL_DRIVE_DANGER =
  "Fill Drive is enabled! Edgeware will place images all over your computer!";
const REPLACE_IMAGES_DANGER =
  "Replace Images is enabled! THIS WILL DELETE FILES ON YOUR COMPUTER!";
const RUN_AT_STARTUP_DANGER =
  "Launch on PC Startup is enabled! This will run Edgeware when you start your computer!";

/**
 * All 93 config items as Zod schemas with danger-level and block metadata.
 * Matches the legacy `items.py` CONFIG_ITEMS dict exactly.
 */
export const CONFIG_ITEMS: Record<string, z.ZodType> = {
  // ── Start (10) ──
  packPath: ZodString.nullish().describe("Pack directory path"),
  themeType: z
    .enum(["Original", "Dark", "The One", "Ransom", "Goth", "Bimbo"])
    .describe("UI theme"),
  themeNoConfig: ZodBoolean.describe("Ignore config theme").refine(() => true, {
    message: "block: true",
  }),
  showLoadingFlair: ZodBoolean.describe("Show splash at startup").refine(() => true, {
    message: "block: true",
  }),
  runOnSaveQuit: ZodBoolean.describe("Run on Save & Exit").refine(() => true, {
    message: RUN_ON_SAVE_QUIT_DANGER,
  }),
  desktopIcons: ZodBoolean.describe("Create desktop icons").refine(() => true, {
    message: "block: true",
  }),
  safeMode: ZodBoolean.describe("Safe mode off").refine(() => true, {
    message: "block: true",
  }),
  messageOff: ZodBoolean.describe("Hide messages").refine(() => true, {
    message: "block: true",
  }),
  globalPanicButton: ZodString.describe("Global panic hotkey").refine(() => true, {
    message: "block: true",
  }),
  presetsDanger: ZodBoolean.describe("Preset danger flag").refine(() => true, {
    message: "block: true",
  }),

  // ── Popup Types (16) ──
  delay: ZodNonNegative.describe("Delay between popups (ms)"),
  singleMode: ZodBoolean.describe("Single popup mode"),
  popupMod: ZodPercentage.describe("Image popup chance (%)"),
  audioMod: ZodPercentage.describe("Audio popup chance (%)"),
  maxAudio: ZodNonNegative.describe("Max simultaneous audio players"),
  audioVolume: ZodPercentage.describe("Audio volume (0–100)"),
  fadeInDuration: ZodNonNegative.describe("Fade-in time (ms)"),
  fadeOutDuration: ZodNonNegative.describe("Fade-out time (ms)"),
  vidMod: ZodPercentage.describe("Video popup chance (%)"),
  maxVideos: ZodNonNegative.describe("Max simultaneous video players"),
  videoVolume: ZodPercentage.describe("Video volume (0–100)"),
  webMod: ZodPercentage.describe("Web popup chance (%)"),
  webPopup: ZodBoolean.describe("Open web on popup close"),
  promptMod: ZodPercentage.describe("Prompt popup chance (%)"),
  promptMistakes: ZodNonNegative.describe("Prompt max mistakes"),
  capPopChance: ZodPercentage.describe("Subliminal chance (%)"),
  capPopTimer: ZodNonNegative.describe("Subliminal timeout (ms)"),
  capPopOpacity: ZodPercentage.describe("Subliminal opacity (0–100)"),
  notificationChance: ZodPercentage.describe("Notification chance (%)"),
  notificationImageChance: ZodPercentage.describe("Notification image chance (%)"),

  // ── Popup Tweaks (15) ──
  showCaptions: ZodBoolean.describe("Show captions in popups"),
  subliminalsChance: ZodPercentage.describe("Hypno/hypnosis chance (%)"),
  subliminalsAlpha: ZodPercentage.describe("Hypno opacity (0–100)"),
  denialChance: ZodPercentage.describe("Denial chance (%)"),
  buttonless: ZodBoolean.describe("Buttonless popup mode"),
  multiClick: ZodBoolean.describe("Multi-click popups"),
  lkScaling: ZodPercentage.describe("Lowkey scaling (0–100)"),
  timeoutPopups: ZodBoolean.describe("Timeout popups enabled"),
  popupTimeout: ZodNonNegative.describe("Popup auto-close timeout (ms)"),
  disabledMonitors: ZodString.describe(
    "JSON array of disabled monitor identifiers"
  ),
  movingChance: ZodPercentage.describe("Moving popup chance (%)"),
  movingSpeed: ZodNonNegative.describe("Moving popup speed"),
  clickthroughPopups: ZodBoolean.describe("Click-through enabled"),

  // ── Wallpaper (4) ──
  rotateWallpaper: ZodBoolean.describe("Rotate wallpaper").refine(() => true, {
    message: "block: BROKEN",
  }),
  wallpaperDat: ZodString.describe("Wallpaper data"),
  wallpaperTimer: ZodNonNegative.describe("Wallpaper change interval (ms)"),
  wallpaperVariance: ZodNonNegative.describe("Wallpaper variance (ms)"),

  // ── Booru (2) ──
  downloadEnabled: ZodBoolean.describe("Booru download enabled"),
  tagList: ZodString.describe("Booru tags for image download"),

  // ── Dangerous (12) ──
  // Note: fill and replace are FEATURE-DROPPED but config keys remain
  timerMode: ZodBoolean.describe("Panic lockout mode").refine(() => true, {
    message: PANIC_LOCKOUT_DANGER,
  }),
  safeword: ZodString.describe("Panic lockout password").refine(() => true, {
    message: "block: true",
  }),
  timerSetupTime: ZodNonNegative.describe("Panic lockout duration (min)").refine(() => true, {
    message: "blocked by corruption",
  }),
  avoidList: ZodString.describe("Drive avoid list (delimited)").refine(() => true, {
    message: "block: true",
  }),
  fill: ZodBoolean.describe("FillDrive enabled").refine(() => false, {
    message: FILL_DRIVE_DANGER,
  }),
  fillDelay: ZodNonNegative.describe("FillDrive delay"),
  replace: ZodBoolean.describe("ReplaceImages enabled").refine(() => false, {
    message: REPLACE_IMAGES_DANGER,
  }),
  replaceThresh: ZodNonNegative.describe("Replace threshold").refine(() => true, {
    message: "block: BROKEN",
  }),
  drivePath: ZodString.describe("Drive path").refine(() => true, {
    message: "block: true",
  }),
  panicDisabled: ZodBoolean.describe("Panic disabled").refine(() => true, {
    message: PANIC_DISABLED_DANGER,
  }),
  startOnLogon: ZodBoolean.describe("Run at startup").refine(() => true, {
    message: RUN_AT_STARTUP_DANGER,
  }),
  showDiscord: ZodBoolean.describe("Show on Discord").refine(() => true, {
    message: SHOW_ON_DISCORD_DANGER,
  }),

  // ── Modes (10) ──
  lkToggle: ZodBoolean.describe("Lowkey mode"),
  lkCorner: z
    .number()
    .int()
    .min(0)
    .max(4)
    .describe("Lowkey corner (0=Random, 1-4=corners)"),
  mitosisMode: ZodBoolean.describe("Mitosis mode").refine(() => false, {
    message: MITOSIS_MODE_DANGER,
  }),
  mitosisStrength: ZodNonNegative.describe("Mitosis strength"),
  hibernateMode: ZodBoolean.describe("Hibernate mode").refine(() => true, {
    message: "block: BROKEN",
  }),
  hibernateType: z
    .enum(["Original", "Spaced", "Glitch", "Ramp", "Pump-Scare", "Chaos"])
    .describe("Hibernate burst type"),
  hibernateMin: ZodNonNegative.describe("Hibernate min delay (ms)"),
  hibernateMax: ZodNonNegative.describe("Hibernate max delay (ms)"),
  wakeupActivity: ZodNonNegative.describe("Wake activity duration (ms)"),
  hibernateLength: ZodNonNegative.describe("Hibernation burst length (ms)"),
  fixWallpaper: ZodBoolean.describe("Fix wallpaper after hibernate"),

  // ── Corruption (10) ──
  corruptionMode: ZodBoolean.describe("Enable corruption mode").refine(() => true, {
    message: "block: true",
  }),
  corruptionFullPerm: ZodBoolean.describe("Corruption full permissions").refine(() => true, {
    message: "block: true",
  }),
  corruptionTrigger: z
    .enum(["Timed", "Popup", "Launch", "Script"])
    .describe("Corruption trigger type"),
  corruptionFadeType: z
    .enum(["Normal", "Abrupt"])
    .describe("Corruption fade type"),
  corruptionTime: ZodNonNegative.describe("Corruption time per level (ms)"),
  corruptionPopups: ZodNonNegative.describe("Corruption popup count trigger"),
  corruptionLaunches: ZodNonNegative.describe("Corruption launch count trigger"),
  corruptionWallpaperCycle: ZodBoolean.describe("Cycle wallpaper in corruption").refine(() => false, {
    message: "inverted (negation)",
  }),
  corruptionThemeCycle: ZodBoolean.describe("Cycle themes in corruption").refine(() => false, {
    message: "inverted (negation)",
  }),
  corruptionPurityMode: ZodBoolean.describe("Corruption purity mode"),
  corruptionDevMode: ZodBoolean.describe("Corruption dev mode").refine(() => true, {
    message: "block: true",
  }),

  // ── Troubleshooting (6) ──
  toggleHibSkip: ZodBoolean.describe("Toggle hibernate skip").refine(() => true, {
    message: "block: true",
  }),
  toggleMoodSet: ZodBoolean.describe("Toggle mood set").refine(() => true, {
    message: "block: true",
  }),
  toggleInternet: ZodBoolean.describe("Toggle internet").refine(() => true, {
    message: "block: true",
  }),
  mpvSubprocess: ZodBoolean.describe("Use MPV subprocess").refine(() => true, {
    message: "block: true",
  }),
  videoHardwareAcceleration: ZodBoolean.describe("Video hardware acceleration"),
  panicButton: ZodString.describe("Panic hotkey").refine(() => true, { message: "block: true" }),

  // ── Scheduler (8) ──
  schedule: ZodBoolean.describe("Schedule enabled"),
  timeType: z.enum(["Minutes", "Hours", "Days"]).describe("Schedule time unit"),
  scheduleTime: ZodNonNegative.describe("Schedule time"),
  varianceTime: ZodNonNegative.describe("Schedule variance (ms)"),
  varianceType: z.enum(["Minutes", "Hours", "Days"]).describe("Variance time unit"),
  repeatSchedule: ZodBoolean.describe("Repeat schedule enabled"),
  repeatType: z.enum(["Minutes", "Hours", "Days"]).describe("Repeat time unit"),
  repeatTime: ZodNonNegative.describe("Repeat schedule time"),
};

export const CONFIG_ITEM_COUNT = Object.keys(CONFIG_ITEMS).length;

/** All config keys that are block=True (not editable by corruption scripts). */
export const CORRUPTION_BLOCKED_KEYS: Record<string, true> = {
  themeNoConfig: true,
  showLoadingFlair: true,
  desktopIcons: true,
  safeMode: true,
  messageOff: true,
  globalPanicButton: true,
  presetsDanger: true,
  disabledMonitors: true,
  rotateWallpaper: true,
  timerMode: true,
  safeword: true,
  timerSetupTime: true,
  avoidList: true,
  replaceThresh: true,
  drivePath: true,
  startOnLogon: true,
  hibernateMode: true,
  corruptionMode: true,
  corruptionFullPerm: true,
  corruptionDevMode: true,
  toggleHibSkip: true,
  toggleMoodSet: true,
  toggleInternet: true,
  mpvSubprocess: true,
  panicButton: true,
};

/** All config keys with danger-level metadata. */
export const CONFIG_DANGER: Record<string, Danger> = {
  delay: { level: "medium", description: "Delay below 2000ms causes rapid popups" },
  timerMode: { level: "medium", description: PANIC_LOCKOUT_DANGER },
  panicDisabled: { level: "minor", description: PANIC_DISABLED_DANGER },
  fill: { level: "major", description: FILL_DRIVE_DANGER },
  replace: { level: "extreme", description: REPLACE_IMAGES_DANGER },
  startOnLogon: { level: "major", description: RUN_AT_STARTUP_DANGER },
  showDiscord: { level: "medium", description: SHOW_ON_DISCORD_DANGER },
  mitosisMode: { level: "medium", description: MITOSIS_MODE_DANGER },
  runOnSaveQuit: { level: "minor", description: RUN_ON_SAVE_QUIT_DANGER },
  hibernateMin: { level: "medium", description: HIBERNATE_DELAY_MIN_DANGER },
  hibernateMax: { level: "medium", description: HIBERNATE_DELAY_MAX_DANGER },
  timerSetupTime: { level: "medium", description: PANIC_LOCKOUT_DANGER },
  wakeupActivity: { level: "medium", description: "High activity values cause rapid bursts" },
};
