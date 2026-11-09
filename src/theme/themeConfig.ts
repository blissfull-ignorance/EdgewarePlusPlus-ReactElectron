import { createTheme, type MantineColorsTuple, type MantineThemeOverride } from "@mantine/core";

export type ThemeName = "original" | "dark" | "the-one" | "ransom" | "goth" | "bimbo";

const VALID_THEMES: ThemeName[] = ["original", "dark", "the-one", "ransom", "goth", "bimbo"];

/**
 * Custom primary ramps, one per legacy theme variant (10 steps, light → dark).
 * Step 6 is the filled-control color; steps 4/5 carry hover and accent tints.
 */
export const PRIMARY_RAMPS: Record<string, MantineColorsTuple> = {
  ember: [
    "#fff1f2",
    "#ffe4e6",
    "#fecdd3",
    "#fda4af",
    "#fb7185",
    "#f43f5e",
    "#e11d48",
    "#be123c",
    "#881337",
    "#4c0519",
  ],
  steel: [
    "#eef2ff",
    "#e0e7ff",
    "#c7d2fe",
    "#a5b4fc",
    "#818cf8",
    "#6366f1",
    "#4f46e5",
    "#4338ca",
    "#312e81",
    "#1e1b4b",
  ],
  matrix: [
    "#ecfdf5",
    "#d1fae5",
    "#a7f3d0",
    "#6ee7b7",
    "#34d399",
    "#10b981",
    "#059669",
    "#047857",
    "#065f46",
    "#064e3b",
  ],
  crimson: [
    "#fef2f2",
    "#fee2e2",
    "#fecaca",
    "#fca5a5",
    "#f87171",
    "#ef4444",
    "#dc2626",
    "#b91c1c",
    "#991b1b",
    "#7f1d1d",
  ],
  violet: [
    "#f5f3ff",
    "#ede9fe",
    "#ddd6fe",
    "#c4b5fd",
    "#a78bfa",
    "#8b5cf6",
    "#7c3aed",
    "#6d28d9",
    "#5b21b6",
    "#4c1d95",
  ],
  bubblegum: [
    "#fdf2f8",
    "#fce7f3",
    "#fbcfe8",
    "#f9a8d4",
    "#f472b6",
    "#ec4899",
    "#db2777",
    "#be185d",
    "#9d174d",
    "#831843",
  ],
};

/** Legacy theme name → primary ramp name for that variant. */
export const THEME_PRIMARY_NAMES: Record<ThemeName, string> = {
  original: "ember",
  dark: "steel",
  "the-one": "matrix",
  ransom: "crimson",
  goth: "violet",
  bimbo: "bubblegum",
};

/** Shared dark surface ramp (index 0 light text … index 9 deepest backdrop). */
const DARK_SURFACE: MantineColorsTuple = [
  "#eceef4",
  "#c8cddb",
  "#a3aabf",
  "#828a9f",
  "#676f85",
  "#4e556a",
  "#343b4e",
  "#232837",
  "#171b26",
  "#0e1119",
];

export const DEFAULT_PRIMARY = THEME_PRIMARY_NAMES.original;

function baseTheme(primary: string): MantineThemeOverride {
  return {
    primaryColor: primary,
    colors: {
      [primary]: PRIMARY_RAMPS[primary],
      dark: DARK_SURFACE,
    },
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontFamilyMonospace:
      "ui-monospace, 'SF Mono', SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    headings: {
      fontFamily: "inherit",
      fontWeight: "700",
      sizes: {
        h1: { fontSize: "1.375rem", fontWeight: "700", lineHeight: "1.2" },
        h2: { fontSize: "1.125rem", fontWeight: "700", lineHeight: "1.25" },
        h3: { fontSize: "1rem", fontWeight: "600", lineHeight: "1.3" },
        h4: { fontSize: "0.875rem", fontWeight: "600", lineHeight: "1.3" },
        h5: { fontSize: "0.75rem", fontWeight: "600", lineHeight: "1.3" },
        h6: { fontSize: "0.6875rem", fontWeight: "600", lineHeight: "1.3" },
      },
    },
    radius: { sm: "4px", md: "8px", lg: "12px", xl: "16px", xxl: "24px" },
    focusRing: "auto",
  };
}

/**
 * Resolve a legacy theme name ("Original", "Dark", "The One", "Ransom",
 * "Goth", "Bimbo") to a full dark Mantine theme. Unknown names fall back to
 * the "original" variant. All variants share the same surfaces, typography,
 * radii and focus behaviour; only the primary ramp and accents differ.
 */
export function getTheme(themeName: string): MantineThemeOverride {
  const normalized = (themeName || "original").toLowerCase().replace(/\s+/g, "-");
  const effective: ThemeName = VALID_THEMES.includes(normalized as ThemeName)
    ? (normalized as ThemeName)
    : "original";

  return createTheme(baseTheme(THEME_PRIMARY_NAMES[effective]));
}
