import { describe, expect, it } from "vitest";
import { toAccelerator } from "../../electron/utils/panicKeys";

describe("toAccelerator", () => {
  it("maps the legacy escape key name", () => {
    expect(toAccelerator("Key.esc")).toBe("Escape");
  });

  it("maps single-character keys to uppercase letters", () => {
    expect(toAccelerator("e")).toBe("E");
    expect(toAccelerator("Key.q")).toBe("Q");
  });

  it("maps function keys", () => {
    expect(toAccelerator("Key.f12")).toBe("F12");
  });

  it("maps named special keys", () => {
    expect(toAccelerator("Key.space")).toBe("Space");
    expect(toAccelerator("Key.tab")).toBe("Tab");
    expect(toAccelerator("Key.enter")).toBe("Return");
  });

  it("passes through values that already look like accelerators", () => {
    expect(toAccelerator("CommandOrControl+Shift+Q")).toBe("CommandOrControl+Shift+Q");
  });

  it("falls back to Escape for empty or unusable values", () => {
    expect(toAccelerator("")).toBe("Escape");
    expect(toAccelerator("Key.")).toBe("Escape");
  });
});
