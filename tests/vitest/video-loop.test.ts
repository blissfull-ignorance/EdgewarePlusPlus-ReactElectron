import { describe, expect, it } from "vitest";
import { nextVideoAction, videoLoopAttribute } from "../../src/features/video/loop";

describe("nextVideoAction", () => {
  it("replays forever when videoLoopInf is on", () => {
    expect(nextVideoAction(1, 1, 1)).toBe("replay");
    expect(nextVideoAction(999, 1, 1)).toBe("replay");
  });

  it("closes after the configured play count", () => {
    expect(nextVideoAction(1, 0, 3)).toBe("replay");
    expect(nextVideoAction(2, 0, 3)).toBe("replay");
    expect(nextVideoAction(3, 0, 3)).toBe("close");
  });

  it("closes after one play at count 1", () => {
    expect(nextVideoAction(1, 0, 1)).toBe("close");
  });

  it("treats a zero or negative count as one play", () => {
    expect(nextVideoAction(1, 0, 0)).toBe("close");
    expect(nextVideoAction(1, 0, -5)).toBe("close");
  });
});

describe("videoLoopAttribute", () => {
  it("enables the native loop attribute only for infinite looping", () => {
    expect(videoLoopAttribute(1)).toBe(true);
    expect(videoLoopAttribute(0)).toBe(false);
  });
});
