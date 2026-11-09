import { describe, expect, it } from "vitest";

describe("Project scaffold", () => {
  it("should pass as a smoke test for the test infrastructure", () => {
    expect(true).toBe(true);
  });

  it("should recognize Node.js environment", () => {
    expect(typeof process).toBe("object");
  });
});
