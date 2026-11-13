import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { useSettingsStore } from "../../src/stores/settingsStore";
import { ConfigPage } from "../../src/components/Config/ConfigPage";
import { usePackDiscoveryStore, usePackDiscovery } from "../../src/hooks/usePackDiscovery";

const MANTINE_WRAPPER = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

const resetStores = () => {
  usePackDiscoveryStore.setState({ packs: [], isLoading: false, error: null });
};

describe("ConfigPage — store-driven rendering", () => {
  beforeEach(() => {
    resetStores();
  });

  it("renders without crashing and shows config tabs", () => {
    const { container } = render(<ConfigPage />, { wrapper: MANTINE_WRAPPER });
    expect(container.textContent).toContain("Edgeware++ Configuration");
    expect(container.textContent).toContain("General");
    expect(container.textContent).toContain("Annoyance / Runtime");
    expect(container.textContent).toContain("Modes");
    expect(container.textContent).toContain("Corruption");
    expect(container.textContent).toContain("Troubleshooting");
  });

});


describe("usePackDiscoveryStore", () => {
  beforeEach(() => {
    usePackDiscoveryStore.setState({ packs: [], isLoading: false, error: null });
    vi.clearAllMocks();
  });

  afterEach(() => {
    usePackDiscoveryStore.setState({ packs: [], isLoading: false, error: null });
  });


  it("refreshPacks populates packs from IPC", async () => {
    const mockPacks = [
      { name: "Test Pack", path: "/data/packs/test", version: "1.0" },
    ];
    (window.api?.system.listPacks as ReturnType<typeof vi.fn>).mockResolvedValue(mockPacks);

    await usePackDiscoveryStore.getState().refreshPacks();

    const state = usePackDiscoveryStore.getState();
    expect(state.packs).toEqual(mockPacks);
    expect(state.isLoading).toBe(false);
  });

  it("auto-selects first pack when packPath is null", async () => {
    useSettingsStore.setState({ packPath: null });

    const mockPacks = [
      { name: "Test Pack", path: "/data/packs/test", version: "1.0" },
    ];
    (window.api?.system.listPacks as ReturnType<typeof vi.fn>).mockResolvedValue(mockPacks);

    await usePackDiscoveryStore.getState().refreshPacks();

    const settingsState = useSettingsStore.getState();
    expect(settingsState.packPath).toBe("/data/packs/test");
    // The pick must persist, or the next boot re-picks differently.
    expect(window.api?.system.saveSettings).toHaveBeenCalled();
  });

  it("does not auto-select when packPath is already set", async () => {
    useSettingsStore.setState({ packPath: "/data/packs/existing" });

    const mockPacks = [
      { name: "Test Pack", path: "/data/packs/test", version: "1.0" },
    ];
    (window.api?.system.listPacks as ReturnType<typeof vi.fn>).mockResolvedValue(mockPacks);

    await usePackDiscoveryStore.getState().refreshPacks();

    const settingsState = useSettingsStore.getState();
    expect(settingsState.packPath).toBe("/data/packs/existing");
  });

  it("handles IPC failure gracefully and preserves existing packs", async () => {
    usePackDiscoveryStore.setState({
      packs: [{ name: "Existing", path: "/data/packs/existing" }],
      isLoading: false,
      error: null,
    });

    (window.api?.system.listPacks as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("IPC error")
    );

    await usePackDiscoveryStore.getState().refreshPacks();

    const state = usePackDiscoveryStore.getState();
    expect(state.isLoading).toBe(false);
    expect(state.packs).toEqual([{ name: "Existing", path: "/data/packs/existing" }]);
    expect(state.error).toBeNull();
  });

  it("does not trigger refreshPacks on hook subscription", () => {
    const listPacksSpy = window.api?.system.listPacks as ReturnType<typeof vi.fn>;
    listPacksSpy.mockClear();

    // Render a component that subscribes via the usePackDiscovery hook
    function TestComponent() {
      usePackDiscovery((s) => s.packs);
      return <div>test</div>;
    }

    render(<TestComponent />, { wrapper: MANTINE_WRAPPER });

    // listPacks should NOT have been called by hook subscription alone
    expect(listPacksSpy).not.toHaveBeenCalled();
  });
});

describe("MainAppPage — tab toggle", () => {
  beforeEach(() => {
    resetStores();
  });

  it("renders Status tab content by default", async () => {
    const { MainAppPage } = await import("../../src/pages/MainAppPage/MainAppPage");
    const { container } = render(<MainAppPage />, { wrapper: MANTINE_WRAPPER });
    expect(container.textContent).toContain("Edgeware++");
    expect(container.textContent).toContain("Status");
    expect(container.textContent).toContain("Config");
  });
});
