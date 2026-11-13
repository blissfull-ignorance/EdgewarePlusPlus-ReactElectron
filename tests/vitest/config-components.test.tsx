import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react";
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
  it("clamps a typed value above max", () => {
    const handleChange = vi.fn();
    const { getByLabelText } = render(
      <ConfigSlider label="Spawn Delay" value={50} onChange={handleChange} min={0} max={100} />,
      { wrapper: MANTINE_WRAPPER }
    );
    fireEvent.change(getByLabelText("Spawn Delay"), { target: { value: "150" } });
    expect(handleChange).toHaveBeenCalledWith(100);
  });

  it("clamps a typed value below min", () => {
    const handleChange = vi.fn();
    const { getByLabelText } = render(
      <ConfigSlider label="Spawn Delay" value={50} onChange={handleChange} min={10} max={100} />,
      { wrapper: MANTINE_WRAPPER }
    );
    fireEvent.change(getByLabelText("Spawn Delay"), { target: { value: "5" } });
    expect(handleChange).toHaveBeenCalledWith(10);
  });

  it("ignores non-numeric typed input", () => {
    const handleChange = vi.fn();
    const { getByLabelText } = render(
      <ConfigSlider label="Spawn Delay" value={50} onChange={handleChange} min={0} max={100} />,
      { wrapper: MANTINE_WRAPPER }
    );
    fireEvent.change(getByLabelText("Spawn Delay"), { target: { value: "abc" } });
    expect(handleChange).not.toHaveBeenCalled();
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

  it("disables the numeric input when disabled", () => {
    const { getByLabelText } = render(
      <ConfigSlider label="Slider" value={50} onChange={() => {}} min={0} max={100} disabled />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(getByLabelText("Slider")).toBeDisabled();
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

  it("renders label and description text", () => {
    const { container } = render(
      <ConfigToggle label="Test Toggle" value={0} onChange={() => {}} description="A description" />,
      { wrapper: MANTINE_WRAPPER }
    );
    expect(container.textContent).toContain("Test Toggle");
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

  it("renders dropzone heading and zip hint", () => {
    const { container } = render(<PackImport {...baseProps} />, { wrapper: MANTINE_WRAPPER });
    expect(container.textContent).toContain("Drag and drop");
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

  it("calls onSelectPack when an option is chosen", async () => {
    const handleSelect = vi.fn();
    const { getByLabelText } = render(
      <PackList packs={mockPacks} currentPackPath={undefined} onSelectPack={handleSelect} />,
      { wrapper: MANTINE_WRAPPER }
    );
    fireEvent.mouseDown(getByLabelText("Available Packs", { selector: "input" }));
    const option = await waitFor(() => {
      const found = Array.from(document.querySelectorAll('[role="option"]')).find((o) =>
        o.textContent?.includes("Pack A")
      );
      if (!found) throw new Error("option not open");
      return found;
    });
    fireEvent.click(option);
    expect(handleSelect).toHaveBeenCalledWith("/data/packs/pack-a");
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
