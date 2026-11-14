import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { DangerousPanel } from "../../src/components/Config/ConfigPanels/Annoyance/DangerousPanel";

const MANTINE_WRAPPER = ({ children }: { children: React.ReactNode }) => (
  <MantineProvider>{children}</MantineProvider>
);

describe("DangerousPanel", () => {
  it("marks the danger tone on the card and its title", () => {
    const { container } = render(<DangerousPanel />, { wrapper: MANTINE_WRAPPER });
    const paper = container.querySelector('[data-danger="true"]');
    expect(paper).not.toBeNull();
    expect(paper!.textContent).toContain("DANGEROUS SETTINGS");
    expect(container.querySelector('[data-danger-title="true"]')).not.toBeNull();
  });

  it("renders all 6 dangerous toggle item labels", () => {
    const { container } = render(<DangerousPanel />, { wrapper: MANTINE_WRAPPER });
    const textElements = container.querySelectorAll('[class*="Text-root"]');
    const allText = Array.from(textElements).map((e) => e.textContent || "").join("\n");
    expect(allText).toContain("Panic Lockout Mode");
    expect(allText).toContain("Panic Hotkey Disabled");
    expect(allText).toContain("Fill Drive Enabled");
    expect(allText).toContain("Replace Images Enabled");
    expect(allText).toContain("Launch on PC Startup");
    expect(allText).toContain("Show on Discord");
  });

  it("renders danger warning on each toggle", () => {
    const { container } = render(<DangerousPanel />, { wrapper: MANTINE_WRAPPER });
    const textElements = container.querySelectorAll('[class*="Text-root"], [class*="Badge-root"]');
    const allText = Array.from(textElements).map((e) => e.textContent || "").join("\n");
    const dangerCount = (allText.match(/DANGER/g) || []).length;
    expect(dangerCount).toBeGreaterThanOrEqual(6);
  });

  it("renders description texts for dangerous items", () => {
    const { container } = render(<DangerousPanel />, { wrapper: MANTINE_WRAPPER });
    const textElements = container.querySelectorAll('[class*="Text-root"]');
    const allText = Array.from(textElements).map((e) => e.textContent || "").join("\n");
    expect(allText).toContain("Enable time-based panic lockout");
    expect(allText).toContain("Disable the panic hotkey. Not recommended.");
  });

  it("renders feature-dropped descriptions for disabled dangerous toggles", () => {
    const { container } = render(<DangerousPanel />, { wrapper: MANTINE_WRAPPER });
    const textElements = container.querySelectorAll('[class*="Text-root"]');
    const allText = Array.from(textElements).map((e) => e.textContent || "").join("\n");
    expect(allText).toContain("Feature dropped. This would fill the drive with pack images.");
    expect(allText).toContain("Feature dropped. This would replace your system images.");
  });

  it("has disabled Fill Drive Enabled toggle", () => {
    const { container } = render(<DangerousPanel />, { wrapper: MANTINE_WRAPPER });
    const dangerousPaper = Array.from(container.querySelectorAll('[class*="Paper"]')).find(
      (p) => p.textContent?.includes("DANGEROUS SETTINGS")
    );
    expect(dangerousPaper).toBeDefined();
    if (dangerousPaper) {
      const inputs = dangerousPaper.querySelectorAll('input[type="checkbox"]');
      const fillCheckbox = Array.from(inputs).find((input) => {
        const sibling = input.closest("div")?.parentElement?.querySelector("label");
        return sibling && sibling.textContent?.includes("Fill Drive");
      });
      expect(fillCheckbox).toBeDefined();
      if (fillCheckbox) {
        expect(fillCheckbox.hasAttribute("disabled")).toBe(true);
      }
    }
  });

  it("has disabled Replace Images Enabled toggle", () => {
    const { container } = render(<DangerousPanel />, { wrapper: MANTINE_WRAPPER });
    const dangerousPaper = Array.from(container.querySelectorAll('[class*="Paper"]')).find(
      (p) => p.textContent?.includes("DANGEROUS SETTINGS")
    );
    expect(dangerousPaper).toBeDefined();
    if (dangerousPaper) {
      const inputs = dangerousPaper.querySelectorAll('input[type="checkbox"]');
      const replaceCheckbox = Array.from(inputs).find((input) => {
        const sibling = input.closest("div")?.parentElement?.querySelector("label");
        return sibling && sibling.textContent?.includes("Replace Images");
      });
      expect(replaceCheckbox).toBeDefined();
      if (replaceCheckbox) {
        expect(replaceCheckbox.hasAttribute("disabled")).toBe(true);
      }
    }
  });
});
