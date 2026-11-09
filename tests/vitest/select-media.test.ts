import { describe, expect, it, beforeEach, vi } from "vitest";
import { selectMedia } from "../../src/features/popup/selectMedia";

describe("selectMedia", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    window.api.pack.randomImage = vi.fn().mockResolvedValue("img/foo.png");
    window.api.pack.randomVideo = vi.fn().mockResolvedValue("vid/bar.mp4");
    window.api.pack.randomAudio = vi.fn().mockResolvedValue("aud/baz.ogg");
  });

  it("selectMedia('image') returns image media from pack IPC", async () => {
    const result = await selectMedia("image");
    expect(result).not.toBeNull();
    expect(result?.mediaId).toBe("img/foo.png");
    expect(result?.mediaType).toBe("image");
    expect(window.api.pack.randomImage).toHaveBeenCalledTimes(1);
  });

  it("selectMedia('video') returns video media from pack IPC", async () => {
    const result = await selectMedia("video");
    expect(result).not.toBeNull();
    expect(result?.mediaId).toBe("vid/bar.mp4");
    expect(result?.mediaType).toBe("video");
    expect(window.api.pack.randomVideo).toHaveBeenCalledTimes(1);
  });

  it("selectMedia('audio') returns audio-only media type", async () => {
    const result = await selectMedia("audio");
    expect(result).not.toBeNull();
    expect(result?.mediaId).toBe("aud/baz.ogg");
    expect(result?.mediaType).toBe("audio-only");
  });

  it("selectMedia('prompt') returns the pack prompt text", async () => {
    window.api.pack.randomPrompt = vi.fn().mockResolvedValue("Do as I say");
    const result = await selectMedia("prompt");
    expect(result).toEqual({ text: "Do as I say", mediaType: "prompt" });
    expect(window.api.pack.randomPrompt).toHaveBeenCalledTimes(1);
  });

  it("selectMedia('prompt') returns null when the pack defines no prompts", async () => {
    window.api.pack.randomPrompt = vi.fn().mockResolvedValue(null);
    const result = await selectMedia("prompt");
    expect(result).toBeNull();
  });

  it("selectMedia('caption') returns null (unsupported)", async () => {
    const result = await selectMedia("caption");
    expect(result).toBeNull();
  });

  it("selectMedia('subliminal') returns null (unsupported)", async () => {
    const result = await selectMedia("subliminal");
    expect(result).toBeNull();
  });

  it("selectMedia('web') returns the pack web url", async () => {
    window.api.pack.randomWeb = vi.fn().mockResolvedValue("https://example.com");
    const result = await selectMedia("web");
    expect(result).toEqual({ url: "https://example.com", mediaType: "web" });
    expect(window.api.pack.randomWeb).toHaveBeenCalledTimes(1);
  });

  it("selectMedia('web') returns null when the pack defines no web urls", async () => {
    window.api.pack.randomWeb = vi.fn().mockResolvedValue(null);
    const result = await selectMedia("web");
    expect(result).toBeNull();
  });

  it("returns null when pack has no media for the type", async () => {
    window.api.pack.randomImage = vi.fn().mockResolvedValue(null);
    const result = await selectMedia("image");
    expect(result).toBeNull();
  });

  it("returns null when no IPC API is available", async () => {
    const w = window as unknown as { api: unknown };
    const original = w.api;
    w.api = undefined;
    try {
      const result = await selectMedia("image");
      expect(result).toBeNull();
    } finally {
      w.api = original;
    }
  });
});
