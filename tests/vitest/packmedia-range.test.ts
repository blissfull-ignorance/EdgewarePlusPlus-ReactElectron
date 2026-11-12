import { describe, expect, it } from "vitest";
import { parseByteRange } from "../../electron/utils/mediaGuard";

describe("parseByteRange", () => {
  it("returns null without a usable Range header", () => {
    expect(parseByteRange(null, 100)).toBeNull();
    expect(parseByteRange("bytes=", 100)).toBeNull();
    expect(parseByteRange("items=1-2", 100)).toBeNull();
  });

  it("parses explicit, open-ended and suffix ranges", () => {
    expect(parseByteRange("bytes=0-49", 100)).toEqual({ start: 0, end: 49 });
    expect(parseByteRange("bytes=50-", 100)).toEqual({ start: 50, end: 99 });
    expect(parseByteRange("bytes=-20", 100)).toEqual({ start: 80, end: 99 });
  });

  it("clamps end past EOF and rejects impossible ranges", () => {
    expect(parseByteRange("bytes=10-5000", 100)).toEqual({ start: 10, end: 99 });
    expect(parseByteRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=90-10", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=-0", 100)).toBe("unsatisfiable");
  });
});
