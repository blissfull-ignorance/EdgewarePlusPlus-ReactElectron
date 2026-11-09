/**
 * TypeScript type declarations for the preload-exposed IPC API surface.
 *
 * The renderer accesses Electron main process capabilities through
 * `window.api` (exposed via contextBridge in electron/preload.ts).
 * All methods return Promises since IPC is inherently async.
 */

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

/** Pack listing entry — returned by system:listPacks. */
export interface PackListing {
  name: string;
  path: string;
  version?: string;
  creator?: string;
}

/** Result of a successful zip import — the extracted pack's identity and location. */
export interface ImportedPack {
  path: string;
  name: string;
  version?: string;
  creator?: string;
}

/** Result of a native zip picker (main-process dialog). */
export interface ZipSelection {
  cancelled: boolean;
  filePaths: string[];
}

/** Result of a native directory picker (main-process dialog). */
export interface FolderSelection {
  cancelled: boolean;
  folderPath?: string;
}

/** Loose validation result for an existing pack folder. */
export interface FolderValidation {
  ok: boolean;
  error?: string;
  warning?: string;
  name?: string;
  version?: string;
  creator?: string;
}

/** Extraction progress reported by the main process during a zip import. */
export interface ImportProgress {
  done: number;
  total: number;
  name: string;
}

export interface ElectronAPI {
  pack: {
    /** Load the current pack's index.json manifest */
    loadInfo: () => Promise<Partial<Record<string, unknown>> | null>;
    /** Load the current pack's Index (modern or legacy fallback) */
    loadIndex: () => Promise<Record<string, unknown> | null>;
    /** List files in a pack subdirectory */
    listFiles: (dir: "aud" | "vid" | "img") => Promise<string[]>;
    /** Select a random image from the pack's img/ directory */
    randomImage: () => Promise<string | null>;
    /** Select a random audio track from the pack's aud/ directory */
    randomAudio: () => Promise<string | null>;
    /** Select a random video from the pack's vid/ directory */
    randomVideo: () => Promise<string | null>;
    /** The pack-defined label for the image/video close button (e.g. "I submit <3"). */
    closeLabel: () => Promise<string | null>;
    /** A random prompt phrase from the active pack, or null if none defined. */
    randomPrompt: () => Promise<string | null>;
    /** A random web URL from the active pack (default + moods), or null if none defined. */
    randomWeb: () => Promise<string | null>;
    /** A random spiral/hypno GIF filename from the pack's `hypno/` dir, or null. */
    randomHypnoGif: () => Promise<string | null>;
    /** A random subliminal text (subliminals lists, falling back to captions), or null. */
    randomSubliminalText: () => Promise<string | null>;
    /** Move a pack media file into the blacklist so it never spawns again. */
    blacklist: (fileName: string) => Promise<{ ok: boolean; movedTo?: string; reason?: string }>;
    /** The pack's raw corruption.json, or null when the pack ships none. */
    loadCorruption: () => Promise<Record<string, unknown> | null>;
    /** The pack's Discord presence payload (resource/discord.dat), or null. */
    discord: () => Promise<{ text: string; image: string | null } | null>;
  };
  corruption: {
    /** Get the current corruption (guided mode) level number */
    getCurrentLevel: () => Promise<number>;
    /** Get the Unix timestamp (ms) of the next level transition, or null */
    getNextLevelTime: () => Promise<number | null>;
    /** Apply config changes from a corruption level definition */
    applyLevelChanges: (changes: Record<string, unknown>) => Promise<void>;
    /** Publish the runtime's level + next-transition time to the main process */
    setLevel: (level: number, nextLevelTime: number | null) => Promise<void>;
    /** Script-driven level change relayed from the main process */
    onInject: (callback: (level: number) => void) => () => void;
    /** Config changes relayed from the main process (scripting API) */
    onApplyChanges: (callback: (changes: Record<string, unknown>) => void) => () => void;
  };
  popup: {
    /** Create a new popup window of the given type and media ID */
    create: (
      type: "image" | "video" | "audio" | "subliminal" | "prompt",
      mediaId: string,
      hypnoGif?: string
    ) => Promise<{ id: string }>;
    /** Close a single popup by its ID */
    closePopup: (id: string) => Promise<void>;
    /** Close all open popup windows */
    closeAll: () => Promise<void>;
    /** Subscribe to popup close events. Returns an unsubscribe function. */
    onClosed: (callback: (id: string) => void) => () => void;
  };
  hibernate: {
    /** Start hibernate scheduler with given burst type and duration (seconds) */
    start: (type: string, durationInSec: number) => Promise<void>;
    /** Stop the hibernate scheduler */
    stop: () => Promise<void>;
  };
  scripting: {
    /** Execute a Lua script from the pack and return success/failure */
    runLua: (scriptName: string) => Promise<boolean>;
    /** Inject a corruption level into the running Lua VM (fires transition callbacks) */
    injectCorruptionLevel: (level: number) => Promise<boolean>;
  };
  system: {
    /** Set desktop wallpaper to the given file path */
    setWallpaper: (filepath: string) => Promise<void>;
    /** Create desktop shortcut icons */
    createDesktopIcons: (options: Record<string, unknown>) => Promise<void>;
    /** Create the system tray icon */
    createTray: () => Promise<boolean>;
    /** Toggle auto-start at login */
    toggleRunAtStartup: (state: boolean) => Promise<void>;
    /** Set Discord Rich Presence */
    setDiscordPresence: (text: string, imageId: string) => Promise<void>;
    /** List available packs from all pack library locations */
    listPacks: () => Promise<PackListing[]>;
    /** Import a pack from a zip filepath; extracts into the pack library */
    importPack: (filepath: string) => Promise<ImportedPack>;
    /** Native zip picker (main-process dialog); returns the selected path(s) */
    selectZip: () => Promise<ZipSelection>;
    /** Native directory picker for adding an existing pack folder */
    selectPackFolder: () => Promise<FolderSelection>;
    /** Validate a folder as a pack (loose: exists; info.json/index.json preferred) */
    validatePackFolder: (folderPath: string) => Promise<FolderValidation>;
    /** Open the canonical pack library folder in the OS file manager */
    openPackLibrary: () => Promise<void>;
    /** Subscribe to zip extraction progress. Returns an unsubscribe function. */
    onImportProgress: (
      callback: (progress: ImportProgress) => void
    ) => () => void;
    /** Resolve the real filesystem path of a renderer File (drag-drop or picker) */
    getPathForFile: (file: File) => string | null;
    /** Load settings from config.json on disk */
    loadSettings: () => Promise<Record<string, unknown> | null>;
    /** Save settings to config.json on disk */
    saveSettings: (settings: Record<string, unknown>) => Promise<void>;
    /** Send a native desktop notification */
    sendNotification: (title: string, message: string, attachmentPath?: string) => Promise<void>;
    /** Open a URL in the OS default browser (http/https only). Returns success. */
    openExternal: (url: string) => Promise<boolean>;
    /** Corruption launch counter: returns the count before this launch. */
    corruptionLaunches: () => Promise<number>;
  };
  booru: {
    /** Search + download one Gelbooru image; null on miss/failure (fall back to pack media). */
    fetchImage: (tags: string) => Promise<string | null>;
  };
  panic: {
    /** Run panic; the hotkey path honors panicDisabled, the tray path forces. */
    trigger: (opts?: { respectDisabled?: boolean }) => Promise<{ ok: boolean; reason?: "disabled" | "lockout" }>;
    status: () => Promise<{ lockoutActive: boolean; accelerator: string }>;
    /** Complete a lockout-gated panic with the safeword. */
    unlock: (password: string) => Promise<{ ok: boolean }>;
    refreshShortcut: () => Promise<{ lockoutActive: boolean; accelerator: string }>;
    /** Fires when a panic attempt was blocked by an active lockout. */
    onBlocked: (callback: () => void) => () => void;
  };
}

export {};
