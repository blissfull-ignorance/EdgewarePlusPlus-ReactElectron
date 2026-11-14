/**
 * @file danger — Corruption full-permission danger audit.
 *
 * With corruption mode on and full permission granted, pack corruption
 * levels can rewrite app settings. This registry mirrors the legacy
 * `CONFIG_DANGER` table: each entry names the danger level, the value
 * predicate that counts as dangerous (checked against the raw pack value),
 * and the warning text. `collectCorruptionDangers` aggregates the hits across
 * all levels so the start-up confirmation dialog can list them before the
 * runtime begins.
 */

export type DangerLevel = "EXTREME" | "MAJOR" | "MEDIUM" | "MINOR";

export interface DangerRule {
  level: DangerLevel;
  check: (value: unknown) => boolean;
  warning?: string;
}

const isOn = (v: unknown) => Number(v) === 1;

export const DANGER_REGISTRY: Record<string, DangerRule> = {
  replace: {
    level: "EXTREME",
    check: isOn,
    warning:
      "Replace Images is enabled! THIS WILL DELETE FILES ON YOUR COMPUTER! Only enable this willingly and cautiously!",
  },
  fill: {
    level: "MAJOR",
    check: isOn,
    warning: "Fill Drive is enabled! This will fill your hard drive with images!",
  },
  startOnLogon: {
    level: "MAJOR",
    check: isOn,
    warning: "Launch on PC Startup is enabled! This will run Edgeware when you start your computer!",
  },
  // The legacy item registry stores this key as "start_on_logon"; packs may
  // use either spelling.
  start_on_logon: {
    level: "MAJOR",
    check: isOn,
    warning: "Launch on PC Startup is enabled! This will run Edgeware when you start your computer!",
  },
  timerMode: {
    level: "MEDIUM",
    check: isOn,
    warning: "Panic Lockout is enabled! Panic cannot be used until a specific time! Make sure you know your Safeword!",
  },
  mitosisMode: {
    level: "MEDIUM",
    check: isOn,
    warning:
      "Mitosis Mode is enabled! With high popup rates, this could create a chain reaction, causing lag!",
  },
  showDiscord: {
    level: "MEDIUM",
    check: isOn,
    warning: "Show on Discord is enabled! This could lead to potential embarassment if you're on your main account!",
  },
  hibernateMin: {
    level: "MEDIUM",
    check: (v) => Number(v) < 30,
    warning:
      "You are running Hibernate Mode with a short minimum cooldown! You might experience lag if a bunch of hibernate modes overlap!",
  },
  hibernateMax: {
    level: "MEDIUM",
    check: (v) => Number(v) < 30,
    warning:
      "You are running Hibernate Mode with a short maximum cooldown! You might experience lag if a bunch of hibernate modes overlap!",
  },
  delay: {
    level: "MEDIUM",
    check: (v) => Number(v) < 2000,
  },
  wakeupActivity: {
    level: "MEDIUM",
    check: (v) => Number(v) >= 36,
  },
  panicDisabled: {
    level: "MINOR",
    check: isOn,
    warning: "Panic Hotkey is disabled! If you want to easily close Edgeware, read the tooltip in the Annoyance tab for other ways to panic!",
  },
  runOnSaveQuit: {
    level: "MINOR",
    check: isOn,
    warning: "Edgeware will run when you hit Yes on Save & Exit.",
  },
};

const LEVEL_ORDER: DangerLevel[] = ["EXTREME", "MAJOR", "MEDIUM", "MINOR"];

export interface DangerGroup {
  level: DangerLevel;
  warnings: string[];
}

export interface DangerReport {
  count: number;
  groups: DangerGroup[];
}

export function collectCorruptionDangers(
  levelConfigs: Array<Record<string, unknown> | null | undefined>
): DangerReport {
  const seen: Record<DangerLevel, Set<string>> = {
    EXTREME: new Set(),
    MAJOR: new Set(),
    MEDIUM: new Set(),
    MINOR: new Set(),
  };

  for (const config of levelConfigs) {
    if (!config) continue;
    for (const [key, value] of Object.entries(config)) {
      const rule = DANGER_REGISTRY[key];
      if (!rule || !rule.check(value)) continue;
      seen[rule.level].add(rule.warning ?? key);
    }
  }

  const groups: DangerGroup[] = LEVEL_ORDER.filter((level) => seen[level].size > 0).map(
    (level) => ({ level, warnings: [...seen[level]] })
  );
  const count = groups.reduce((sum, g) => sum + g.warnings.length, 0);
  return { count, groups };
}
