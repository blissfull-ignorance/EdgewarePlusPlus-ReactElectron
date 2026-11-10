/**
 * @file dangerFlags — Live danger registry for the user's own settings.
 *
 * Mirrors the legacy `Danger(DangerLevel, Schema(value))` annotations from
 * config/items.py: a warning exists only while the setting actually holds the
 * dangerous value, never merely because the option exists. Messages come from
 * the shared CONFIG_DANGER registry.
 */

import { CONFIG_DANGER } from "../../types/config";

export interface DangerWarning {
  key: string;
  message: string;
}

const isOn = (v: unknown): boolean => Number(v) === 1;
const num = (v: unknown): number => Number(v) || 0;
const hibernate = (s: Record<string, unknown>): boolean => isOn(s.hibernateMode);

/** Per-key predicates: true while the current value is the dangerous one. */
const DANGER_TRIGGERS: Record<string, (s: Record<string, unknown>) => boolean> = {
  fill: (s) => isOn(s.fill),
  replace: (s) => isOn(s.replace),
  panicDisabled: (s) => isOn(s.panicDisabled),
  timerMode: (s) => isOn(s.timerMode),
  timerSetupTime: (s) => isOn(s.timerMode) && num(s.timerSetupTime) > 0,
  startOnLogon: (s) => isOn(s.startOnLogon),
  showDiscord: (s) => isOn(s.showDiscord),
  mitosisMode: (s) => isOn(s.mitosisMode),
  runOnSaveQuit: (s) => isOn(s.runOnSaveQuit),
  delay: (s) => num(s.delay) > 0 && num(s.delay) <= 1999,
  hibernateMin: (s) => hibernate(s) && num(s.hibernateMin) > 0 && num(s.hibernateMin) < 30_000,
  hibernateMax: (s) => hibernate(s) && num(s.hibernateMax) > 0 && num(s.hibernateMax) < 30_000,
  wakeupActivity: (s) => hibernate(s) && num(s.wakeupActivity) >= 36_000,
};

/** Danger warnings for the given settings, keyed and worded like the legacy app. */
export function collectSettingDangers(s: Record<string, unknown>): DangerWarning[] {
  const warnings: DangerWarning[] = [];
  for (const [key, triggered] of Object.entries(DANGER_TRIGGERS)) {
    const meta = CONFIG_DANGER[key];
    if (meta && triggered(s)) {
      warnings.push({ key, message: meta.description });
    }
  }
  return warnings;
}
