import { describe, expect, it, beforeEach } from "vitest";
import {
  canOpenPopup,
  clearOpenPopups,
  countOpenPops,
  registerOpenPopup,
  unregisterOpenPopup,
} from "../../src/features/popup/openPopups";

describe("open popup registry (legacy maxAudio/maxVideos enforcement)", () => {
  beforeEach(() => {
    clearOpenPopups();
  });

  it("counts popups by type and overall", () => {
    registerOpenPopup("a1", "audio");
    registerOpenPopup("a2", "audio");
    registerOpenPopup("v1", "video");

    expect(countOpenPops("audio")).toBe(2);
    expect(countOpenPops("video")).toBe(1);
    expect(countOpenPops("image")).toBe(0);
    expect(countOpenPops()).toBe(3);
  });

  it("removes a popup when its close event lands", () => {
    registerOpenPopup("a1", "audio");
    registerOpenPopup("v1", "video");
    unregisterOpenPopup("a1");
    expect(countOpenPops("audio")).toBe(0);
    expect(countOpenPops()).toBe(1);
  });

  it("refuses a new audio pop once maxAudio open audio pops exist", () => {
    registerOpenPopup("a1", "audio");
    const limits = { maxAudio: 1, maxVideos: 10 };

    expect(canOpenPopup("audio", limits)).toBe(false);
    expect(canOpenPopup("video", limits)).toBe(true);
    expect(canOpenPopup("image", limits)).toBe(true);

    registerOpenPopup("v1", "video");
    registerOpenPopup("v2", "video");
    // Video cap of 10 not reached — still allowed (legacy default maxVideos=10)
    expect(canOpenPopup("video", limits)).toBe(true);
    const tight = { maxAudio: 1, maxVideos: 2 };
    expect(canOpenPopup("video", tight)).toBe(false);
  });

  it("clears the whole registry on stop so caps re-arm for the next session", () => {
    registerOpenPopup("a1", "audio");
    registerOpenPopup("v1", "video");

    clearOpenPopups();

    expect(countOpenPops()).toBe(0);
    expect(canOpenPopup("audio", { maxAudio: 1, maxVideos: 10 })).toBe(true);
  });

  it("unregister only affects the matching id", () => {
    registerOpenPopup("a1", "audio");
    registerOpenPopup("a2", "audio");
    unregisterOpenPopup("a1");
    expect(countOpenPops("audio")).toBe(1);
  });
});
