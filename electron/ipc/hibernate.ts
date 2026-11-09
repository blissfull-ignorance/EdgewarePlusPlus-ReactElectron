import { ipcMain, BrowserWindow } from "electron";
import { logger } from "../utils/logger";

// Hibernate handler — manages the scheduler for burst-based popup spawning

let hibernateTimer: ReturnType<typeof setTimeout> | null = null;
let hibernateActive = false;
let currentBurstTimers: ReturnType<typeof setTimeout>[] = [];

function clearAllTimers(): void {
  if (hibernateTimer) {
    clearTimeout(hibernateTimer);
    hibernateTimer = null;
  }
  for (const timer of currentBurstTimers) {
    clearTimeout(timer);
  }
  currentBurstTimers = [];
  hibernateActive = false;
}

function scheduleBurst(type: string, durationInSec: number): void {
  clearAllTimers();
  hibernateActive = true;

  const numPopups = Math.max(1, Math.round(durationInSec / 2));
  const burstDuration = durationInSec * 1000;

  let intervals: number[] = [];
  switch (type) {
    case "Spaced": {
      const interval = burstDuration / numPopups;
      intervals = Array.from({ length: numPopups }, () => interval);
      break;
    }
    case "Glitch": {
      const breakpoints = Array.from({ length: numPopups - 1 }, () => Math.random() * burstDuration);
      breakpoints.sort((a, b) => a - b);
      let prev = 0;
      for (const bp of breakpoints) {
        intervals.push(bp - prev);
        prev = bp;
      }
      intervals.push(burstDuration - prev);
      break;
    }
    case "Ramp": {
      const weights: number[] = [];
      let weightSum = 0;
      for (let i = 0; i < numPopups; i++) {
        const progress = numPopups > 1 ? i / (numPopups - 1) : 0;
        const weight = Math.pow(1 - progress, 2);
        weights.push(weight);
        weightSum += weight;
      }
      intervals = weights.map((w) => (w / weightSum) * burstDuration);
      break;
    }
    case "Pump-Scare": {
      const interval = burstDuration / numPopups;
      intervals = Array.from({ length: numPopups }, () => Math.max(50, interval * 0.05));
      break;
    }
    case "Chaos": {
      const chaosTypes = ["Spaced", "Glitch", "Ramp", "Pump-Scare"];
      const selectedType = chaosTypes[Math.floor(Math.random() * chaosTypes.length)];
      scheduleBurst(selectedType, durationInSec);
      return;
    }
    case "Original":
    default:
      intervals = Array.from({ length: numPopups }, () => 0);
      break;
  }

  let cumulativeDelay = 0;
  for (let i = 0; i < intervals.length; i++) {
    const delay = cumulativeDelay;
    cumulativeDelay += intervals[i];

    const timer = setTimeout(() => {
      if (hibernateActive) {
        const mainWin = BrowserWindow.getAllWindows()[0];
        if (mainWin && !mainWin.isDestroyed()) {
          mainWin.webContents.send("hibernate:spawnPopup", i);
        }
      }
    }, delay);

    currentBurstTimers.push(timer);
  }

  const endTimer = setTimeout(() => {
    hibernateActive = false;
    const mainWin = BrowserWindow.getAllWindows()[0];
    if (mainWin && !mainWin.isDestroyed()) {
      mainWin.webContents.send("hibernate:burstEnd");
    }
  }, cumulativeDelay + 500);

  currentBurstTimers.push(endTimer);

  logger.info(`[Hibernate] Burst started: type=${type} popups=${numPopups} duration=${durationInSec}s`);
}

function skipHibernate(): void {
  clearAllTimers();
  logger.info("[Hibernate] Skipped");
}

function registerHandlers(): void {
  ipcMain.handle("hibernate:start", async (_event, type: string, durationInSec: number): Promise<void> => {
    try {
      scheduleBurst(type, durationInSec);
    } catch (err) {
      logger.error("[Hibernate] Failed to start burst:", err);
    }
  });

  ipcMain.handle("hibernate:stop", async (): Promise<void> => {
    clearAllTimers();
    logger.info("[Hibernate] Stopped");
  });

  ipcMain.handle("hibernate:status", async (): Promise<{ active: boolean }> => {
    return { active: hibernateActive };
  });

  ipcMain.handle("hibernate:skip", async (): Promise<void> => {
    skipHibernate();
  });
}

export { registerHandlers, skipHibernate };
