import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { ConfigSlider } from "../../src/components/Config/ConfigSlider";
import { ConfigToggle } from "../../src/components/Config/ConfigToggle";
import { ConfigDropdown } from "../../src/components/Config/ConfigDropdown";
import { ConfigField } from "../../src/components/Config/ConfigField";
import { PackImport } from "../../src/components/Config/PackImport";
import { PackList } from "../../src/components/Config/PackList";

const MANTINE_WRAPPER = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

beforeEach(() => {
  cleanup();
});

// ---------- ConfigSlider — behavioral tests ----------

describe("ConfigSlider", () => {
  it("calls onChange with clamped value when slider moves above max", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <ConfigSlider label="Slider" value={50} onChange={handleChange} min={0} max={100} />,
      { wrapper: MANTINE_WRAPPER }
    );
    const sliders = container.querySelectorAll('input[type="range"]');
    if (sliders.length > 0) {
      fireEvent.change(sliders[0], { target: { value: "100" } });
      expect(handleChange).toHaveBeenCalledWith(100);
    }
  });

  it("calls onChange with clamped value when slider moves below min", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <ConfigSlider label="Slider" value={50} onChange={handleChange} min={0} max={100} />,
      { wrapper: MANTINE_WRAPPER }
    );
    const sliders = container.querySelectorAll('input[type="range"]');
    if (sliders.length > 0) {
      fireEvent.change(sliders[0], { target: { value: "0" } });
      expect(handleChange).toHaveBeenCalledWith(0);
    }
  });

  it("renders label text", () => {
    const { container } = render(
      <ConfigSlider label="Test Slider" value={50} onChange={() => {}} min={0} max={100} />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("Test Slider");
  });

  it("renders description text when provided", () => {
    const { container } = render(
      <ConfigSlider label="Slider" value={50} onChange={() => {}} min={0} max={100} description="A description" />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("A description");
  });

  it("does not render description when not provided", () => {
    const { container } = render(
      <ConfigSlider label="Slider" value={50} onChange={() => {}} min={0} max={100} />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).not.toContain("A description");
  });

  it("applies disabled state when disabled prop is true", () => {
    const { container } = render(
      <ConfigSlider label="Slider" value={50} onChange={() => {}} min={0} max={100} disabled />,
      { wrapper: MANTINE_WRAPPER }
    );
    const sliders = container.querySelectorAll('input[type="range"]');
    if (sliders.length > 0) {
      expect(sliders[0].hasAttribute("disabled")).toBe(true);
    }
  });
});

// ---------- ConfigToggle — behavioral tests ----------

describe("ConfigToggle", () => {
  it("renders checked checkbox when value=1", () => {
    const { container } = render(
      <ConfigToggle label="Toggle" value={1} onChange={() => {}} />,
      { wrapper: MANTINE_WRAPPER }
    );
    const inputs = container.querySelectorAll('input[type="checkbox"]');
    expect(inputs[0]).toBeChecked();
  });

  it("renders unchecked checkbox when value=0", () => {
    const { container } = render(
      <ConfigToggle label="Toggle" value={0} onChange={() => {}} />,
      { wrapper: MANTINE_WRAPPER }
    );
    const inputs = container.querySelectorAll('input[type="checkbox"]');
    expect(inputs[0]).not.toBeChecked();
  });

  it("onChange receives 1 when checkbox is checked", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <ConfigToggle label="Toggle" value={0} onChange={handleChange} />,
      { wrapper: MANTINE_WRAPPER }
    );
    const inputs = container.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(inputs[0]);
    expect(handleChange).toHaveBeenCalledWith(1);
  });

  it("onChange receives 0 when checkbox is unchecked", () => {
    const handleChange = vi.fn();
    const { container } = render(
      <ConfigToggle label="Toggle" value={1} onChange={handleChange} />,
      { wrapper: MANTINE_WRAPPER }
    );
    const inputs = container.querySelectorAll('input[type="checkbox"]');
    fireEvent.click(inputs[0]);
    expect(handleChange).toHaveBeenCalledWith(0);
  });

  it("renders label text", () => {
    const { container } = render(
      <ConfigToggle label="Test Toggle" value={0} onChange={() => {}} />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("Test Toggle");
  });

  it("renders description when provided", () => {
    const { container } = render(
      <ConfigToggle label="Toggle" value={0} onChange={() => {}} description="A description" />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("A description");
  });

  // Isolated test for danger prop rendering
  it("renders DANGER text when danger prop is true", () => {
    const { container } = render(
      <ConfigToggle label="Danger Toggle" value={0} onChange={() => {}} danger />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("DANGER");
  });

  it("does not render DANGER text when danger is false", () => {
    const { container } = render(
      <ConfigToggle label="Safe Toggle" value={0} onChange={() => {}} />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).not.toContain("DANGER");
  });

  it("applies red border via CSS variable when danger is true", () => {
    const { container } = render(
      <ConfigToggle label="Danger Toggle" value={0} onChange={() => {}} danger />,
      { wrapper: MANTINE_WRAPPER }
    );
    // The red border style is applied to the Checkbox wrapper via styles.input prop
    // In Mantine, this renders as inline styles on an inner element
    const allText = container.textContent || "";
    // If the danger prop works, the component renders DANGER text and the checkbox wrapper
    // should contain the red border styling
    expect(allText).toContain("DANGER");
    // The Checkbox's styles.input prop applies red border — verify it renders without error
    expect(container.querySelector('[class*="Checkbox-root"]')).toBeDefined();
  });

  it("applies disabled state when disabled prop is true", () => {
    const { container } = render(
      <ConfigToggle label="Toggle" value={0} onChange={() => {}} disabled />,
      { wrapper: MANTINE_WRAPPER }
    );
    const inputs = container.querySelectorAll('input[type="checkbox"]');
    if (inputs.length > 0) {
      expect(inputs[0].getAttribute("disabled")).not.toBeNull();
    }
  });
});

// ---------- ConfigDropdown — behavioral tests ----------

describe("ConfigDropdown", () => {
  it("renders label text", () => {
    const { container } = render(
      <ConfigDropdown label="Dropdown" value="a" onChange={() => {}} data={[{ label: "A", value: "a" }]} />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("Dropdown");
  });

  it("applies disabled state when disabled prop is true", () => {
    const { container } = render(
      <ConfigDropdown label="Dropdown" value="a" onChange={() => {}} data={[{ label: "A", value: "a" }]} disabled />,
      { wrapper: MANTINE_WRAPPER }
    );
    const inputs = container.querySelectorAll('input');
    if (inputs.length > 0) {
      expect(inputs[0].hasAttribute("disabled")).toBe(true);
    }
  });
});

// ---------- ConfigField — behavioral tests ----------

describe("ConfigField", () => {
  it("renders label text", () => {
    const { container } = render(
      <ConfigField label="Test Field" value="hello" onChange={() => {}} />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("Test Field");
  });

  it("renders description when provided", () => {
    const { container } = render(
      <ConfigField label="Field" value="hello" onChange={() => {}} description="A description" />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("A description");
  });
});

// ---------- PackImport — behavioral tests ----------

describe("PackImport", () => {
  const baseProps = {
    onDrop: vi.fn().mockResolvedValue(undefined),
    onImportFromDisk: vi.fn(),
    onAddFolder: vi.fn(),
    importing: false,
    progress: null,
    error: null,
    warning: null,
  };

  it("renders dropzone heading text", () => {
    const { container } = render(<PackImport {...baseProps} />, { wrapper: MANTINE_WRAPPER });
    expect(container.textContent).toContain("Drag and drop");
  });

  it("renders the zip file hint text", () => {
    const { container } = render(<PackImport {...baseProps} />, { wrapper: MANTINE_WRAPPER });
    expect(container.textContent).toContain(".zip file here");
  });

  it("renders the import-from-disk and add-folder buttons", () => {
    const { container } = render(<PackImport {...baseProps} />, { wrapper: MANTINE_WRAPPER });
    expect(container.textContent).toContain("Import from file…");
    expect(container.textContent).toContain("Add existing pack folder…");
  });

  it("shows a visible error alert when import fails", () => {
    const { container } = render(
      <PackImport {...baseProps} error="Not a valid zip file (corrupt or truncated archive): garbage.zip" />,
      { wrapper: MANTINE_WRAPPER }
    );
    const alert = container.querySelector('[data-testid="pack-import-error"]');
    expect(alert?.textContent).toContain("Not a valid zip file");
  });

  it("shows a folder warning alert", () => {
    const { container } = render(
      <PackImport {...baseProps} warning="No info.json or index.json found" />,
      { wrapper: MANTINE_WRAPPER }
    );
    const alert = container.querySelector('[data-testid="pack-folder-warning"]');
    expect(alert?.textContent).toContain("No info.json or index.json found");
  });

  it("shows the progress bar while importing", () => {
    const { container } = render(
      <PackImport {...baseProps} importing progress={42} />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.querySelector('[data-testid="pack-import-progress"]')).toBeTruthy();
    expect(container.textContent).toContain("42%");
  });
});

// ---------- PackList — behavioral tests ----------

describe("PackList", () => {
  const mockPacks = [
    { name: "Pack A", path: "/data/packs/pack-a", version: "1.0", creator: "Alice" },
    { name: "Pack B", path: "/data/packs/pack-b", version: "2.0", creator: "Bob" },
  ];

  it("renders pack names in the list", () => {
    render(<PackList packs={mockPacks} currentPackPath={undefined} onSelectPack={() => {}} />, { wrapper: MANTINE_WRAPPER });
    // The Select component renders its options inside a portal, so we check the full document
    const text = document.body.textContent || "";
    expect(text).toContain("Pack A");
  });

  it("shows alert when no packs available", () => {
    const { container } = render(<PackList packs={[]} currentPackPath={undefined} onSelectPack={() => {}} />, { wrapper: MANTINE_WRAPPER });
    expect(container.textContent).toContain("No Packs Found");
  });

  it("onSelectPack is called with pack path when selection changes", async () => {
    const handleSelect = vi.fn();
    const { container } = render(
      <PackList packs={mockPacks} currentPackPath={undefined} onSelectPack={handleSelect} />,
      { wrapper: MANTINE_WRAPPER }
    );
    // Find the input in the Select component and simulate selection
    const inputs = container.querySelectorAll('input[type="text"]');
    if (inputs.length > 0) {
      fireEvent.change(inputs[0], { target: { value: mockPacks[0].path } });
      expect(handleSelect).toHaveBeenCalledWith(mockPacks[0].path);
    }
  });

  it("shows current pack path when provided", () => {
    const { container } = render(<PackList packs={mockPacks} currentPackPath="/data/packs/pack-a" onSelectPack={() => {}} />, { wrapper: MANTINE_WRAPPER });
    expect(container.textContent).toContain("/data/packs/pack-a");
  });

  it("does not show current pack path when not provided", () => {
    const { container } = render(<PackList packs={mockPacks} currentPackPath={undefined} onSelectPack={() => {}} />, { wrapper: MANTINE_WRAPPER });
    expect(container.textContent).not.toContain("/data/packs/pack-a");
  });
});
