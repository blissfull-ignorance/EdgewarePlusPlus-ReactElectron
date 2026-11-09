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
    },
    corruption: {
      getCurrentLevel: async () => 0,
      getNextLevelTime: async () => null,
      applyLevelChanges: async () => undefined,
    },
    popup: {
      create: async (_type: string, _mediaId: string, _hypnoGif?: string) => ({ id: `popup-${Date.now()}` }),
      closePopup: async () => undefined,
      closeAll: async () => undefined,
      onClosed: () => () => {},
    },
    hibernate: {
      start: async () => undefined,
      stop: async () => undefined,
    },
    scripting: {
      runLua: async () => false,
      injectCorruptionLevel: async () => false,
    },
    system: {
      setWallpaper: async () => undefined,
      createDesktopIcons: async () => undefined,
      createTray: async () => true,
      toggleRunAtStartup: async () => undefined,
      setDiscordPresence: async () => undefined,
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
      loadSettings: async () => null,
      saveSettings: async () => undefined,
      sendNotification: async () => undefined,
      openExternal: async () => false,
    },
  };
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
