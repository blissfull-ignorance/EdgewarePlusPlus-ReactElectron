import { describe, expect, it } from "vitest";
import { levenshteinDistance } from "../../src/utils/leet";

describe("levenshteinDistance", () => {
  it("returns 0 for identical strings", () => {
    expect(levenshteinDistance("hello", "hello")).toBe(0);
    expect(levenshteinDistance("", "")).toBe(0);
  });

  it("returns correct distance for single character difference", () => {
    expect(levenshteinDistance("cat", "car")).toBe(1);
    expect(levenshteinDistance("cat", "bat")).toBe(1);
  });

  it("returns correct distance for insertion", () => {
    expect(levenshteinDistance("cat", "cats")).toBe(1);
    expect(levenshteinDistance("", "hello")).toBe(5);
  });

  it("returns correct distance for deletion", () => {
    expect(levenshteinDistance("cats", "cat")).toBe(1);
    expect(levenshteinDistance("hello", "")).toBe(5);
  });

  it("returns correct distance for substitution", () => {
    expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    expect(levenshteinDistance("saturday", "sunday")).toBe(3);
  });

  it("handles empty strings", () => {
    expect(levenshteinDistance("", "abc")).toBe(3);
    expect(levenshteinDistance("abc", "")).toBe(3);
  });

  it("returns correct distance for completely different strings", () => {
    expect(levenshteinDistance("abc", "xyz")).toBe(3);
  });

  it("is symmetric", () => {
    expect(levenshteinDistance("abc", "def")).toBe(levenshteinDistance("def", "abc"));
    expect(levenshteinDistance("kitten", "sitting")).toBe(
      levenshteinDistance("sitting", "kitten")
    );
  });
});
