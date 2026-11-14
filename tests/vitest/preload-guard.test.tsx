import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import {
  bootstrapDecision,
  isElectronRenderer,
  PreloadFailureScreen,
} from "../../src/features/preloadGuard";

describe("isElectronRenderer", () => {
  it("recognizes the Electron UA token", () => {
    expect(
      isElectronRenderer(
        "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Edgeware++/1.0 Chrome/120 Electron/30.0 Safari/537.36"
      )
    ).toBe(true);
  });

  it("rejects plain browser UAs", () => {
    expect(isElectronRenderer("Mozilla/5.0 (Macintosh) Chrome/120 Safari/537.36")).toBe(false);
  });
});

describe("bootstrapDecision", () => {
  it("mounts the real app whenever the bridge exists", () => {
    expect(bootstrapDecision(true, true)).toBe("app");
    expect(bootstrapDecision(false, true)).toBe("app");
  });

  it("is fatal inside Electron when the preload never ran", () => {
    expect(bootstrapDecision(true, false)).toBe("fatal");
  });

  it("installs the stub only in real browsers", () => {
    expect(bootstrapDecision(false, false)).toBe("stub");
  });
});

describe("PreloadFailureScreen", () => {
  it("renders the visible failure surface the boot decision promises", () => {
    const { container } = render(<PreloadFailureScreen />);
    const screen = container.querySelector('[data-testid="preload-failure"]');
    expect(screen).not.toBeNull();
    expect(screen?.textContent).toContain("failed to start");
  });
});
