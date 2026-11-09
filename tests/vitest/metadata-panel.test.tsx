import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithMantine } from "./setup";
import { MetadataPanel } from "../../src/components/MetadataPanel/MetadataPanel";
import { useAppStore } from "../../src/stores/appStore";
import { useCorruptionStore } from "../../src/stores/corruptionStore";
import { useSettingsStore } from "../../src/stores/settingsStore";

vi.mock("../../src/stores/appStore", () => ({
  useAppStore: vi.fn(),
}));

vi.mock("../../src/stores/corruptionStore", () => ({
  useCorruptionStore: vi.fn(),
}));

vi.mock("../../src/stores/settingsStore", () => ({
  useSettingsStore: vi.fn(),
}));

function mockStores(
  appState: Partial<ReturnType<typeof useAppStore.getState>>,
  corruptionState: Partial<ReturnType<typeof useCorruptionStore.getState>>,
  settingsState: Partial<ReturnType<typeof useSettingsStore.getState>>
) {
  (useAppStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (s: unknown) => unknown) =>
    fn(appState)
  );
  (useCorruptionStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (s: unknown) => unknown) =>
    fn(corruptionState)
  );
  (useSettingsStore as unknown as ReturnType<typeof vi.fn>).mockImplementation((fn: (s: unknown) => unknown) =>
    fn(settingsState)
  );
}

describe("MetadataPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the metadata panel container", () => {
    mockStores(
      { popupsCount: 0, isRunning: false, hibernateActive: false },
      { currentLevel: 0, activeMoods: [], driverType: "timer", nextLevelTime: null },
      { corruptionMode: 0, packPath: null, hibernateMode: 0 }
    );

    renderWithMantine(<MetadataPanel />);
    expect(screen.getByTestId("metadata-panel")).toBeTruthy();
  });

  it("displays corruption level and driver type", () => {
    mockStores(
      { popupsCount: 3, isRunning: true, hibernateActive: false },
      {
        currentLevel: 2,
        activeMoods: ["submissive", "dominant"],
        driverType: "audio",
        nextLevelTime: Date.now() + 60000,
      },
      { corruptionMode: 1, packPath: "/path/to/pack", hibernateMode: 0 }
    );

    renderWithMantine(<MetadataPanel />);
    expect(screen.getByTestId("corruption-level")).toBeTruthy();
    expect(screen.getByTestId("driver-type")).toBeTruthy();
    expect(screen.getByTestId("next-level-time")).toBeTruthy();
  });

  it("displays active moods when corruption mode is active", () => {
    mockStores(
      { popupsCount: 0, isRunning: true, hibernateActive: false },
      {
        currentLevel: 1,
        activeMoods: ["beginner", "submissive"],
        driverType: "timer",
        nextLevelTime: Date.now() + 300000,
      },
      { corruptionMode: 1, packPath: null, hibernateMode: 0 }
    );

    renderWithMantine(<MetadataPanel />);
    const moods = screen.getAllByTestId("active-mood");
    expect(moods.length).toBe(2);
  });

  it("displays popup count in real time", () => {
    mockStores(
      { popupsCount: 5, isRunning: true, hibernateActive: false },
      {
        currentLevel: 0,
        activeMoods: [],
        driverType: "timer",
        nextLevelTime: null,
      },
      { corruptionMode: 0, packPath: null, hibernateMode: 0 }
    );

    renderWithMantine(<MetadataPanel />);
    const popupCount = screen.getByTestId("popup-count");
    expect(popupCount.textContent).toContain("5");
  });

  it("displays pack info when a pack is loaded", () => {
    mockStores(
      { popupsCount: 0, isRunning: false, hibernateActive: false },
      {
        currentLevel: 0,
        activeMoods: [],
        driverType: "timer",
        nextLevelTime: null,
      },
      { corruptionMode: 0, packPath: "/home/user/packs/MyPack", hibernateMode: 0 }
    );

    renderWithMantine(<MetadataPanel />);
    const packInfo = screen.getByTestId("pack-info");
    expect(packInfo.textContent).toContain("MyPack");
  });

  it("shows running/stopped status", () => {
    mockStores(
      { popupsCount: 0, isRunning: true, hibernateActive: false },
      {
        currentLevel: 0,
        activeMoods: [],
        driverType: "timer",
        nextLevelTime: null,
      },
      { corruptionMode: 0, packPath: null, hibernateMode: 0 }
    );

    renderWithMantine(<MetadataPanel />);
    expect(screen.getByText("Running")).toBeTruthy();
  });

  it("shows hibernate disabled status", () => {
    mockStores(
      { popupsCount: 0, isRunning: false, hibernateActive: false },
      {
        currentLevel: 0,
        activeMoods: [],
        driverType: "timer",
        nextLevelTime: null,
      },
      { corruptionMode: 0, packPath: null, hibernateMode: 0 }
    );

    renderWithMantine(<MetadataPanel />);
    expect(screen.getByText("Disabled")).toBeTruthy();
  });

  it("shows hibernate enabled but idle status", () => {
    mockStores(
      { popupsCount: 0, isRunning: true, hibernateActive: false },
      {
        currentLevel: 0,
        activeMoods: [],
        driverType: "timer",
        nextLevelTime: null,
      },
      { corruptionMode: 0, packPath: null, hibernateMode: 1 }
    );

    renderWithMantine(<MetadataPanel />);
    expect(screen.getByText("Enabled, Idle")).toBeTruthy();
  });

  it("shows hibernate active status", () => {
    mockStores(
      { popupsCount: 0, isRunning: true, hibernateActive: true },
      {
        currentLevel: 0,
        activeMoods: [],
        driverType: "timer",
        nextLevelTime: null,
      },
      { corruptionMode: 0, packPath: null, hibernateMode: 1 }
    );

    renderWithMantine(<MetadataPanel />);
    expect(screen.getByText("Active")).toBeTruthy();
  });
});
