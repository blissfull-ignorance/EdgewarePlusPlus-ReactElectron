import { vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { MantineProvider } from "@mantine/core";
import { render } from "@testing-library/react";

// Mock zustand/middleware — devtools and persist should be no-ops in tests
const mockMemoryStorage: Record<string, string> = {};
export const clearMockStorage = () => {
  Object.keys(mockMemoryStorage).forEach((k) => delete mockMemoryStorage[k]);
};
vi.mock("zustand/middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("zustand/middleware")>("zustand/middleware");
  // Provide an in-memory storage for persist middleware (jsdom localStorage may be incomplete)
  const mockPersist = function persist<T>(
    storeCreator: Parameters<typeof actual.persist<T>>[0],
    persistOptions: Parameters<typeof actual.persist<T>>[1]
  ) {
    const storage: {
      length: number;
      getItem: (key: string) => string | null;
      setItem: (key: string, value: string) => void;
      removeItem: (key: string) => void;
      clear: () => void;
      key: (index: number) => string | null;
    } = {
      length: Object.keys(mockMemoryStorage).length,
      getItem: (key: string) => mockMemoryStorage[key] ?? null,
      setItem: (key: string, value: string) => { mockMemoryStorage[key] = value; },
      removeItem: (key: string) => { delete mockMemoryStorage[key]; },
      clear: () => { Object.keys(mockMemoryStorage).forEach((k) => delete mockMemoryStorage[k]); },
      key: (index: number) => Object.keys(mockMemoryStorage)[index] ?? null,
    };
    return actual.persist<T>(storeCreator, { ...persistOptions, storage });
  } as typeof actual.persist;
  const devtools = actual.devtools || (function <T>(fn: T): T { return fn; }) as typeof actual.devtools;
  return { devtools, persist: mockPersist };
});

// Create a persistent matchMedia result object (Mantine stores and mutates this)
const createMediaQueryList = () => ({
  matches: false,
  media: "",
  onchange: null,
  addListener: function () {},
  removeListener: function () {},
  addEventListener: function () {},
  removeEventListener: function () {},
  dispatchEvent: function () { return false; },
});

// Mock window.matchMedia for Mantine
if (typeof window !== "undefined") {
  const mockMql = createMediaQueryList();
  (window as unknown as Record<string, unknown>).matchMedia = function () {
    return mockMql;
  };

  // Mock ResizeObserver (used by Mantine components)
  (window as unknown as Record<string, unknown>).ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  // Mock window.api (Electron IPC bridge)
  (window as unknown as Record<string, unknown>).api = {
    pack: {
      loadInfo: vi.fn().mockResolvedValue(null),
      loadIndex: vi.fn().mockResolvedValue(null),
      listFiles: vi.fn().mockResolvedValue([]),
      randomImage: vi.fn().mockResolvedValue(null),
      randomAudio: vi.fn().mockResolvedValue(null),
      randomVideo: vi.fn().mockResolvedValue(null),
      closeLabel: vi.fn().mockResolvedValue(null),
      randomPrompt: vi.fn().mockResolvedValue(null),
      randomWeb: vi.fn().mockResolvedValue(null),
      randomHypnoGif: vi.fn().mockResolvedValue(null),
      randomSubliminalText: vi.fn().mockResolvedValue(null),
      randomNotificationText: vi.fn().mockResolvedValue(null),
      blacklist: vi.fn().mockResolvedValue({ ok: true }),
      loadCorruption: vi.fn().mockResolvedValue(null),
      discord: vi.fn().mockResolvedValue(null),
    },
    booru: {
      fetchImage: vi.fn().mockResolvedValue(null),
    },
    panic: {
      trigger: vi.fn().mockResolvedValue({ ok: true }),
      status: vi.fn().mockResolvedValue({ lockoutActive: false, accelerator: "Escape" }),
      unlock: vi.fn().mockResolvedValue({ ok: true }),
      refreshShortcut: vi.fn().mockResolvedValue({ lockoutActive: false, accelerator: "Escape" }),
      onBlocked: vi.fn().mockReturnValue(() => {}),
    },
    corruption: {
      getCurrentLevel: vi.fn().mockResolvedValue(0),
      getNextLevelTime: vi.fn().mockResolvedValue(null),
      applyLevelChanges: vi.fn().mockResolvedValue(undefined),
      setLevel: vi.fn().mockResolvedValue(undefined),
      onInject: vi.fn().mockReturnValue(() => {}),
      onApplyChanges: vi.fn().mockReturnValue(() => {}),
    },
    popup: {
      create: vi.fn().mockImplementation((_type, _mediaId, _hypnoGif) =>
        Promise.resolve({ id: `popup-${Date.now()}` })
      ),
      closePopup: vi.fn().mockResolvedValue(undefined),
      closeAll: vi.fn().mockResolvedValue(undefined),
      onClosed: vi.fn().mockImplementation((callback: (id: string) => void) => {
        (window as unknown as Record<string, unknown>).__onPopupClosed = callback;
        return () => {
          (window as unknown as Record<string, unknown>).__onPopupClosed = undefined;
        };
      }),
    },
    hibernate: {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
    },
    scripting: {
      runLua: vi.fn().mockResolvedValue(false),
      injectCorruptionLevel: vi.fn().mockResolvedValue(false),
    },
    system: {
      setWallpaper: vi.fn().mockResolvedValue(undefined),
      createDesktopIcons: vi.fn().mockResolvedValue(undefined),
      createTray: vi.fn().mockResolvedValue(true),
      toggleRunAtStartup: vi.fn().mockResolvedValue(undefined),
      setDiscordPresence: vi.fn().mockResolvedValue(undefined),
      listPacks: vi.fn().mockResolvedValue([]),
      importPack: vi.fn().mockImplementation(async (filepath: string) => ({
        path: filepath,
        name: filepath.split("/").pop() ?? "Imported Pack",
      })),
      selectZip: vi.fn().mockResolvedValue({ cancelled: true, filePaths: [] }),
      selectPackFolder: vi.fn().mockResolvedValue({ cancelled: true }),
      validatePackFolder: vi
        .fn()
        .mockResolvedValue({ ok: false, error: "not available in tests" }),
      openPackLibrary: vi.fn().mockResolvedValue(undefined),
      onImportProgress: vi.fn().mockReturnValue(() => undefined),
      getPathForFile: vi.fn().mockReturnValue(null),
      loadSettings: vi.fn().mockResolvedValue(null),
      saveSettings: vi.fn().mockResolvedValue(undefined),
      sendNotification: vi.fn().mockResolvedValue(undefined),
      openExternal: vi.fn().mockResolvedValue(false),
      corruptionLaunches: vi.fn().mockResolvedValue(0),
    },
  };
}

// Store the original render
const originalRender = render;

// Wrap all renders in MantineProvider
export function renderWithMantine(ui: React.ReactElement, options?: Record<string, unknown>) {
  return originalRender(ui, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <MantineProvider>{children}</MantineProvider>
    ),
    ...options,
  } as Parameters<typeof render>[1]);
}
