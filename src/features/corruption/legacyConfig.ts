/**
 * @file legacyConfig — unit bridge for pack-supplied configuration values.
 *
 * Legacy packs store `corruptionTime` and `popupTimeout` in seconds (the
 * legacy app applied an s→ms conversion when loading settings); the port's
 * canonical unit is ms. Values authored by a pack — config.json presets and
 * corruption level configs — are converted here when they are applied.
 */

export function normalizePackConfigValues(
  values: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...values };
  for (const key of ["corruptionTime", "popupTimeout"] as const) {
    const value = out[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      out[key] = value * 1000;
    }
  }
  return out;
}
