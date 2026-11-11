import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@mantine/core/styles.css";
import "@mantine/dropzone/styles.css";
import App from "./App";
import { useSettingsStore } from "./stores/settingsStore";
import "./styles.css";

// Mock window.api for non-Electron environments (Vite dev server, Playwright E2E)
if (typeof window !== "undefined" && !(window as unknown as Record<string, unknown>).api) {
  (window as unknown as Record<string, unknown>).api = {
    pack: {
      loadInfo: async () => null,
      loadIndex: async () => null,
      listFiles: async () => [],
      randomImage: async () => null,
      randomAudio: async () => null,
      randomVideo: async () => null,
      closeLabel: async () => null,
      randomPrompt: async () => null,
      randomWeb: async () => null,
      randomHypnoGif: async () => null,
      randomSubliminalText: async () => null,
      randomNotificationText: async () => null,
      splashImage: async () => null,
      iconImage: async () => null,
      setActiveMoods: async () => undefined,
      listMoods: async () => [],
      loadPackConfig: async () => null,
      hasScript: async () => false,
      listGallery: async () => ({ entries: [], moods: [], activeMoods: [] }),
      blacklist: async () => ({ ok: true }),
      loadCorruption: async () => null,
      discord: async () => null,
    },
    booru: {
      fetchImage: async () => null,
    },
    corruption: {
      getCurrentLevel: async () => 0,
      getNextLevelTime: async () => null,
      applyLevelChanges: async () => undefined,
      setLevel: async () => undefined,
      onInject: () => () => {},
      onApplyChanges: () => () => {},
    },
    panic: {
      trigger: async () => ({ ok: true }),
      status: async () => ({ lockoutActive: false, accelerator: "Escape" }),
      unlock: async () => ({ ok: true }),
      refreshShortcut: async () => ({ lockoutActive: false, accelerator: "Escape" }),
      onBlocked: () => () => {},
    },
    popup: {
      create: async (_type: string, _mediaId: string, _hypnoGif?: string) => ({ id: `popup-${Date.now()}` }),
      closePopup: async () => undefined,
      closeAll: async () => undefined,
      sizeToMedia: async (_id: string, _w: number, _h: number, _lowkey?: boolean) => ({ width: 400, height: 300 }),
      startMoving: async () => true,
      onClosed: () => () => {},
    },
    hibernate: {
      start: async () => undefined,
      stop: async () => undefined,
    },
    scripting: {
      runLua: async () => false,
      runSelfTest: async () => ({ ok: false, error: 'no lua host in this mode' }),
      stop: async () => true,
      injectCorruptionLevel: async () => false,
    },
    system: {
      setWallpaper: async () => undefined,
      quit: async () => undefined,
      createDesktopIcons: async () => undefined,
      createTray: async () => true,
      toggleRunAtStartup: async () => undefined,
      setDiscordPresence: async () => undefined,
      corruptionLaunches: async () => 0,
      listPacks: async () => [],
      importPack: async (filepath: string) => ({
        path: filepath,
        name: filepath.split("/").pop() ?? "Imported Pack",
      }),
      selectZip: async () => ({ cancelled: true, filePaths: [] }),
      selectPackFolder: async () => ({ cancelled: true }),
      validatePackFolder: async () => ({
        ok: false,
        error: "Pack folders can only be added inside the Electron app.",
      }),
      openPackLibrary: async () => undefined,
      onImportProgress: () => () => undefined,
      getPathForFile: () => null,
      // The startup splash is verified in the Electron layer; the browser
      // harness starts straight on the app UI.
      loadSettings: async () => ({ showLoadingFlair: 0 }),
      flushSettings: () => true,
      saveSettings: async () => undefined,
      sendNotification: async () => undefined,
      openExternal: async () => false,
    },
  };
}

// Popup windows must be fully transparent: the app body paints a dark surface
// that would letterbox media as a thick border.
if (typeof window !== "undefined" && window.location.hash.startsWith("#/popup/")) {
  document.documentElement.dataset.popup = "1";
}

// Expose settingsStore for E2E testing
if (typeof window !== "undefined") {
  (window as unknown as Record<string, unknown>).__settingsStore = useSettingsStore;
}

const container = document.getElementById("root")!;
const root = createRoot(container);

root.render(
  <StrictMode>
    <App />
  </StrictMode>
);
