import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { _electron, type ElectronApplication, type Page } from "@playwright/test";
import electronExecutable from "electron";

const REPO_ROOT = path.resolve(__dirname, "..", "..", "..");
const DIST_MAIN = path.join(REPO_ROOT, "dist-electron", "main.js");
const MEDIA_FIXTURE = path.join(REPO_ROOT, "tests", "e2e", "fixtures", "Real Test Pack");

export const HARNESS_ENV = { EDGWARE_STUB_BROWSER: "1", EDGWARE_PANIC_SKIP_WALLPAPER: "1" };

/** 1x1 red PNG. */
export const PNG_1PX = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

export interface UIPackOptions {
  name?: string;
  fillerImages?: number;
  preset?: Record<string, unknown> | null;
  corruption?: Record<string, unknown> | null;
}

/** Mood-tagged pack (locked mood on locked.png) with optional preset/corruption/config. */
export function writeUIPack(packsDir: string, opts: UIPackOptions = {}): string {
  const name = opts.name ?? "UI Stress Pack";
  const packDir = path.join(packsDir, name);
  mkdirSync(path.join(packDir, "img"), { recursive: true });
  mkdirSync(path.join(packDir, "aud"), { recursive: true });
  mkdirSync(path.join(packDir, "vid"), { recursive: true });
  copyFileSync(path.join(MEDIA_FIXTURE, "img", "applelw.png"), path.join(packDir, "img", "free.png"));
  copyFileSync(path.join(MEDIA_FIXTURE, "img", "globelw.png"), path.join(packDir, "img", "locked.png"));
  copyFileSync(path.join(MEDIA_FIXTURE, "aud", "think.wav"), path.join(packDir, "aud", "voice.wav"));
  copyFileSync(path.join(MEDIA_FIXTURE, "vid", "tempest.mp4"), path.join(packDir, "vid", "clip.mp4"));
  for (let i = 1; i <= (opts.fillerImages ?? 0); i++) {
    writeFileSync(path.join(packDir, "img", `filler-${String(i).padStart(2, "0")}.png`), PNG_1PX);
  }
  writeFileSync(
    path.join(packDir, "info.json"),
    JSON.stringify({ name, id: name.toLowerCase().replace(/\W+/g, "-"), creator: "e2e", version: "1.0" })
  );
  writeFileSync(
    path.join(packDir, "index.json"),
    JSON.stringify({
      default: { maxClicks: 1, captions: ["c"], denial: [], subliminals: [], notifications: [], prompts: [], popupClose: "Close" },
      moods: [{ mood: "locked", captions: ["lc"], web: [], webArgs: [], media: ["locked.png"] }],
    })
  );
  if (opts.corruption !== null) {
    writeFileSync(
      path.join(packDir, "corruption.json"),
      JSON.stringify(
        opts.corruption ?? {
          moods: { "1": { add: ["locked"], remove: [] }, "2": { add: [], remove: [] } },
          wallpapers: {},
          config: { "1": { delay: 4000 }, "2": { delay: 500, panicDisabled: 1 } },
        }
      )
    );
  }
  if (opts.preset !== null) {
    writeFileSync(
      path.join(packDir, "config.json"),
      JSON.stringify(opts.preset ?? { delay: 3000, corruptionTrigger: "Timed", corruptionTime: 2 })
    );
  }
  return packDir;
}

/** Second pack with a single unmistakable image, for pack-switch workflows. */
export function writeAltPack(packsDir: string): string {
  const packDir = path.join(packsDir, "UI Alt Pack");
  mkdirSync(path.join(packDir, "img"), { recursive: true });
  writeFileSync(path.join(packDir, "img", "bravo.png"), PNG_1PX);
  writeFileSync(
    path.join(packDir, "info.json"),
    JSON.stringify({ name: "UI Alt Pack", id: "ui-alt", creator: "e2e", version: "2.0" })
  );
  writeFileSync(
    path.join(packDir, "index.json"),
    JSON.stringify({ default: { maxClicks: 1, captions: ["alt"], denial: [], subliminals: [], notifications: [], prompts: [], popupClose: "Close" } })
  );
  return packDir;
}

export async function storeValue<T = unknown>(window: Page, key: string): Promise<T> {
  return window.evaluate(
    (k) =>
      (window as unknown as { __settingsStore: { getState: () => Record<string, unknown> } }).__settingsStore.getState()[
        k
      ] as T,
    key
  );
}

export async function rawLaunch(state: { dir: string }, extraEnv: Record<string, string> = {}): Promise<ElectronApplication> {
  return _electron.launch({
    executablePath: electronExecutable,
    args: [DIST_MAIN],
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: "http://localhost:5173",
      EDGWARE_USER_DATA_DIR: state.dir,
      ...extraEnv,
    },
  });
}

export async function rawQuit(app: ElectronApplication): Promise<void> {
  try {
    await app.evaluate(({ app }) => app.quit());
  } catch {
    /* already gone */
  }
  await new Promise<void>((resolve) => {
    const proc = app.process();
    if (proc.exitCode !== null || proc.killed) return resolve();
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      resolve();
    }, 12000);
    proc.once("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

export function popupWindows(app: ElectronApplication): Page[] {
  return app.windows().filter((w) => w.url().includes("/popup/"));
}
