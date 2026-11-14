import { _electron, expect, test } from "@playwright/test";
import electronExecutable from "electron";
import {
  cleanupTempState,
  createTempState,
  DIST_MAIN,
  ensureElectronBuild,
  launchApp,
  quitApp,
} from "./launch";

/**
 * One runtime per userData directory: a second launch must exit immediately
 * (no parallel popup session, no config race) while the first instance keeps
 * serving.
 */
test("a second launch against the same userData exits while the first instance stays alive", async () => {
  ensureElectronBuild();
  const state = createTempState();
  const running = await launchApp(state);
  let second: Awaited<ReturnType<typeof _electron.launch>> | null = null;
  try {
    let secondExited = false;
    try {
      second = await _electron.launch({
        executablePath: electronExecutable,
        args: [DIST_MAIN],
        env: {
          ...process.env,
          VITE_DEV_SERVER_URL: "http://localhost:5173",
          EDGWARE_USER_DATA_DIR: state.dir,
        },
      });
      const proc = second.process();
      await Promise.race([
        new Promise<void>((resolve) => proc.once("exit", () => resolve())),
        new Promise<void>((resolve) => setTimeout(resolve, 15000)),
      ]);
      secondExited = proc.exitCode !== null || proc.killed;
    } catch {
      // Dying during or before the protocol handshake is still an exit.
      secondExited = true;
    }

    expect(secondExited).toBe(true);

    // The first instance is untouched and still responsive.
    expect(await running.window.evaluate(() => 1 + 1)).toBe(2);
    await expect(running.window.locator("[data-testid='metadata-panel']")).toBeVisible();
  } finally {
    if (second) await second.close().catch(() => undefined);
    await quitApp(running);
    cleanupTempState(state);
  }
});
