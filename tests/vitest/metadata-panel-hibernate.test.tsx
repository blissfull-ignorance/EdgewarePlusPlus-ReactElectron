import { describe, expect, it, beforeEach } from "vitest";
import { screen, cleanup } from "@testing-library/react";
import { renderWithMantine } from "./setup";
import { useAppStore } from "../../src/stores/appStore";
import { useSettingsStore } from "../../src/stores/settingsStore";
import { useCorruptionStore } from "../../src/stores/corruptionStore";
import { MetadataPanel } from "../../src/components/MetadataPanel/MetadataPanel";

describe("MetadataPanel hibernate and mitosis display", () => {
  beforeEach(() => {
    cleanup();
    useAppStore.setState({ popupsCount: 0, isRunning: false, hibernateActive: false });
    useSettingsStore.setState({
      hibernateMode: 0,
      mitosisMode: 0,
      corruptionMode: 0,
      mitosisStrength: 0,
      packPath: null,
    });
    useCorruptionStore.getState().reset();
  });

  it("shows Hibernate: Disabled when hibernate is off", () => {
    renderWithMantine(<MetadataPanel />);
    const panel = screen.getByTestId("metadata-panel");
    expect(panel.textContent).toContain("Disabled");
  });

  it("shows Hibernate: Active when hibernate is active", () => {
    useSettingsStore.setState({ hibernateMode: 1 });
    useAppStore.setState({ hibernateActive: true });

    renderWithMantine(<MetadataPanel />);
    // Scoped: the Mitosis badge also contains the substring "Active".
    expect(screen.getByTestId("hibernate-state")).toHaveTextContent("Active");
  });

  it("shows Hibernate: Enabled, Idle when enabled but not active", () => {
    useSettingsStore.setState({ hibernateMode: 1 });
    useAppStore.setState({ hibernateActive: false });

    renderWithMantine(<MetadataPanel />);
    const panel = screen.getByTestId("metadata-panel");
    expect(panel.textContent).toContain("Enabled, Idle");
  });

  it("shows Mitosis indicator when mitosis is enabled", () => {
    useSettingsStore.setState({ mitosisMode: 1, mitosisStrength: 3 });

    renderWithMantine(<MetadataPanel />);
    expect(screen.getByTestId("mitosis-indicator")).toHaveTextContent("Active (strength: 3)");
  });

  it("shows Mitosis indicator as Inactive when mitosis is disabled", () => {
    useSettingsStore.setState({ mitosisMode: 0 });

    renderWithMantine(<MetadataPanel />);
    expect(screen.getByTestId("mitosis-indicator")).toHaveTextContent("Inactive");
  });

  it("shows hibernate countdown when active", () => {
    useSettingsStore.setState({ hibernateMode: 1 });
    useAppStore.setState({ hibernateActive: true });

    renderWithMantine(<MetadataPanel />);
    const panel = screen.getByTestId("metadata-panel");
    expect(panel.textContent).toContain("Countdown");
  });
});
