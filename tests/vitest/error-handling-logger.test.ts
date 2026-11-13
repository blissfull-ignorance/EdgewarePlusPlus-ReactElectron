import { describe, expect, it, vi, beforeEach } from "vitest";

describe("renderer logger", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("respects log level filtering", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "debug").mockImplementation(() => {});

    const { logger } = await import("../../src/utils/logger");
    logger.setLevel("error");

    logger.error("error msg");
    logger.warn("warn msg");
    logger.info("info msg");
    logger.debug("debug msg");

    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("error msg"));
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.log).not.toHaveBeenCalled();
    expect(console.debug).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  it("includes timestamp in formatted messages", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});

    const { logger } = await import("../../src/utils/logger");
    logger.setLevel("debug");

    logger.info("test");

    expect(console.log).toHaveBeenCalledWith(expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T/));

    vi.restoreAllMocks();
  });
});
