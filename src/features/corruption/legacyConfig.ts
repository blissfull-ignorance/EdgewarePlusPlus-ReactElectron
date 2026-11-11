/**
 * @file legacyConfig — unit bridge for pack-supplied configuration values.
 *
 * Legacy packs store `corruptionTime` in seconds (the legacy app applied an
 * s→ms conversion when loading settings); the port's canonical unit is ms.
 * Values authored by a pack — config.json presets and corruption level
 * configs — are converted here when they are applied.
 */

export function normalizePackConfigValues(
  values: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...values };
  const time = out.corruptionTime;
  if (typeof time === "number" && Number.isFinite(time)) {
    out.corruptionTime = time * 1000;
  }
  return out;
}
