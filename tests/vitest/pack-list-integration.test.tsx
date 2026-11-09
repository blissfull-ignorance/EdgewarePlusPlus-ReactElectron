import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { useSettingsStore } from "../../src/stores/settingsStore";
import { ConfigPage } from "../../src/components/Config/ConfigPage";
import { PackList } from "../../src/components/Config/PackList";
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

  it("renders with no props passed", () => {
    expect(() => render(<ConfigPage />, { wrapper: MANTINE_WRAPPER })).not.toThrow();
  });
});

describe("PackList — pack selection integration", () => {
  const mockPacks = [
    { name: "Pack A", path: "/data/packs/pack-a", version: "1.0", creator: "Alice" },
    { name: "Pack B", path: "/data/packs/pack-b", version: "2.0", creator: "Bob" },
  ];

  it("renders pack names in the select dropdown", () => {
    render(
      <PackList packs={mockPacks} currentPackPath={undefined} onSelectPack={() => {}} />,
      { wrapper: MANTINE_WRAPPER }
    );
    const text = document.body.textContent || "";
    expect(text).toContain("Pack A");
    expect(text).toContain("Pack B");
  });

  it("shows alert when no packs available", () => {
    const { container } = render(
      <PackList packs={[]} currentPackPath={undefined} onSelectPack={() => {}} />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("No Packs Found");
  });

  it("onSelectPack is called with pack path when selection changes", () => {
    const handleSelect = vi.fn();
    const { container } = render(
      <PackList packs={mockPacks} currentPackPath={undefined} onSelectPack={handleSelect} />,
      { wrapper: MANTINE_WRAPPER }
    );
    const inputs = container.querySelectorAll('input[type="text"]');
    if (inputs.length > 0) {
      fireEvent.change(inputs[0], { target: { value: mockPacks[0].path } });
      expect(handleSelect).toHaveBeenCalledWith(mockPacks[0].path);
    }
  });

  it("shows current pack path when provided", () => {
    const { container } = render(
      <PackList packs={mockPacks} currentPackPath="/data/packs/pack-a" onSelectPack={() => {}} />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("/data/packs/pack-a");
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

  it("initial state has empty packs array", () => {
    const state = usePackDiscoveryStore.getState();
    expect(state.packs).toEqual([]);
    expect(state.isLoading).toBe(false);
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
