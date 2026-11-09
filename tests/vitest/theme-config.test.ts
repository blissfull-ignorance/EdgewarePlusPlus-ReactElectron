import { describe, expect, it } from "vitest";
import { getTheme, THEME_PRIMARY_NAMES } from "../../src/theme/themeConfig";

describe("getTheme", () => {
  it("returns the ember primary for 'original'", () => {
    const theme = getTheme("original");
    expect(theme.primaryColor).toBe(THEME_PRIMARY_NAMES.original);
    expect(theme.primaryColor).toBe("ember");
  });

  it("returns the steel primary for 'dark'", () => {
    const theme = getTheme("dark");
    expect(theme.primaryColor).toBe("steel");
  });

  it("returns the crimson primary for 'ransom'", () => {
    const theme = getTheme("ransom");
    expect(theme.primaryColor).toBe("crimson");
  });

  it("returns the bubblegum primary for 'bimbo'", () => {
    const theme = getTheme("bimbo");
    expect(theme.primaryColor).toBe("bubblegum");
  });

  it("falls back to the original variant for empty string", () => {
    const theme = getTheme("");
    expect(theme.primaryColor).toBe("ember");
  });

  it("falls back to the original variant for null/undefined", () => {
    const themeNull = getTheme(null as unknown as string);
    const themeUndefined = getTheme(undefined as unknown as string);
    expect(themeNull.primaryColor).toBe("ember");
    expect(themeUndefined.primaryColor).toBe("ember");
  });

  it("handles legacy theme names with spaces", () => {
    const theme = getTheme("The One");
    expect(theme.primaryColor).toBe("matrix");
  });

  it("handles legacy theme names with mixed case", () => {
    const theme = getTheme("Ransom");
    expect(theme.primaryColor).toBe("crimson");
  });

  it("falls back to the original variant for unknown theme name", () => {
    const theme = getTheme("unknown-theme");
    expect(theme.primaryColor).toBe("ember");
  });

  it("includes a full 10-step primary ramp and dark surface ramp", () => {
    const theme = getTheme("goth");
    const colors = theme.colors as Record<string, readonly string[]>;
    expect(colors.violet).toHaveLength(10);
    expect(colors.dark).toHaveLength(10);
  });
});

describe("getTheme surfaces", () => {
  const surface = (name: string) => {
    const theme = getTheme(name);
    return (theme.colors as Record<string, string[]>).dark;
  };

  it("paints Original with the legacy light-gray surfaces", () => {
    const ramp = surface("original");
    expect(ramp[8]).toBe("#f0f0f0");
    expect(ramp[0]).toBe("#16181d");
  });

  it("paints Bimbo with pink surfaces", () => {
    const ramp = surface("bimbo");
    expect(ramp[8]).toBe("#ffc0cb");
  });

  it("paints Ransom with dark-red surfaces", () => {
    const ramp = surface("ransom");
    expect(ramp[8]).toBe("#841212");
  });

  it("paints The One with green-on-charcoal surfaces", () => {
    const ramp = surface("the-one");
    expect(ramp[8]).toBe("#282c34");
    expect(ramp[0]).toBe("#00ff41");
  });

  it("keeps Dark and Goth on charcoal backgrounds", () => {
    expect(surface("dark")[8]).toBe("#171b26");
    expect(surface("goth")[8]).toBe("#282c34");
  });

  it("gives every variant a distinct app background", () => {
    const backgrounds = ["original", "dark", "the-one", "ransom", "goth", "bimbo"].map(
      (name) => surface(name)[8]
    );
    expect(new Set(backgrounds).size).toBeGreaterThanOrEqual(5);
  });

  it("uses the monospace legacy font for The One and serif faces for Goth and Bimbo", () => {
    expect(getTheme("the-one").fontFamily).toContain("Consolas");
    expect(getTheme("goth").fontFamily).toContain("Georgia");
    expect(getTheme("bimbo").fontFamily).toContain("Constantia");
  });
});
