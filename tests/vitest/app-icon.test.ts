import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getAppPath: () => "/app",
    getPath: () => "/home/user",
  },
  nativeImage: { createFromPath: vi.fn() },
}));
vi.mock("../../electron/utils/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { iconCandidates } from "../../electron/utils/appIcon";

describe("iconCandidates", () => {
  it("prefers the pack icon over the bundled default", () => {
    const list = iconCandidates("/packs/demo");
    expect(list[0]).toContain("/packs/demo/icon.ico");
    expect(list[1]).toContain("/packs/demo/icon.png");
    expect(list[2]).toContain("dist/icon.png");
  });

  it("falls back to the bundled default without a pack", () => {
    const list = iconCandidates(null);
    expect(list).toHaveLength(2);
    expect(list[0]).toContain("dist/icon.png");
    expect(list[1]).toContain("dist/icon.png");
  });
});
