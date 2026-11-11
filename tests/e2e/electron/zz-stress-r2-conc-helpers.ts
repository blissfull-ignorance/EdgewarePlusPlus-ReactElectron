/** Shared probes for round-2 concurrency/storm stress specs (throwaway). */
import type { ElectronApplication, Page } from "@playwright/test";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { TempState } from "./launch";

export interface WinSnap {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Disp {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function popupWins(app: ElectronApplication): Page[] {
  return app.windows().filter((w) => w.url().includes("/popup/"));
}

export async function snapPopups(app: ElectronApplication): Promise<WinSnap[]> {
  return app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()
      .filter((w) => !w.isDestroyed() && w.webContents.getURL().includes("/popup/"))
      .map((w) => {
        const b = w.getBounds();
        return {
          url: w.webContents.getURL(),
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
        };
      })
  );
}

export async function primaryDisplay(app: ElectronApplication): Promise<Disp> {
  return app.evaluate(({ screen }) => screen.getPrimaryDisplay().bounds);
}

/** Windows with NaN bounds or no intersection at all with the display. */
export function badBounds(snaps: WinSnap[], disp: Disp): WinSnap[] {
  return snaps.filter((s) => {
    if (![s.x, s.y, s.width, s.height].every(Number.isFinite)) return true;
    const inside =
      s.x < disp.x + disp.width &&
      s.x + s.width > disp.x &&
      s.y < disp.y + disp.height &&
      s.y + s.height > disp.y;
    return !inside;
  });
}

export async function rendererPopupCount(window: Page): Promise<number> {
  const text = await window.locator("[data-testid='popup-count']").textContent();
  const m = /(\d+)/.exec(text ?? "");
  return m ? Number(m[1]) : -1;
}

export function readMainLog(state: TempState): string {
  const dir = path.join(state.dir, "logs");
  if (!existsSync(dir)) return "";
  return readdirSync(dir)
    .filter((f) => f.endsWith(".log"))
    .map((f) => {
      try {
        return readFileSync(path.join(dir, f), "utf-8");
      } catch {
        return "";
      }
    })
    .join("\n");
}

export function countStubbedBrowserOpens(state: TempState): number {
  return (readMainLog(state).match(/Browser open stubbed/g) ?? []).length;
}

/** Duplicate a PCM wav's data chunk until it is at least `seconds` long. */
export function makeLongWav(src: string, dest: string, seconds: number): void {
  const buf = readFileSync(src);
  if (buf.toString("ascii", 0, 4) !== "RIFF") throw new Error("not a RIFF wav");
  let off = 12;
  let dataOff = -1;
  let dataSize = 0;
  let byteRate = 0;
  while (off + 8 <= buf.length) {
    const id = buf.toString("ascii", off, off + 4);
    const size = buf.readUInt32LE(off + 4);
    if (id === "fmt ") byteRate = buf.readUInt32LE(off + 8 + 8);
    if (id === "data") {
      dataOff = off + 8;
      dataSize = size;
      break;
    }
    off += 8 + size + (size % 2);
  }
  if (dataOff < 0 || byteRate <= 0) throw new Error("no data/fmt chunk");
  const reps = Math.max(1, Math.ceil((seconds * byteRate) / dataSize));
  const chunk = buf.subarray(dataOff, dataOff + dataSize);
  const out = Buffer.concat([buf.subarray(0, dataOff), Buffer.concat(Array(reps).fill(chunk))]);
  out.writeUInt32LE(4 + out.length - 8, 4);
  out.writeUInt32LE(chunk.length * reps, dataOff - 4);
  writeFileSync(dest, out);
}

export function writeEvidence(file: string, data: unknown): void {
  const dir = path.join(process.cwd(), "work", "stress");
  try {
    readdirSync(dir);
  } catch {
    return;
  }
  writeFileSync(path.join(dir, file), JSON.stringify(data, null, 2));
}

export const STORM_BASE = {
  popupRenderMode: "electron",
  showLoadingFlair: 0,
  promptMod: 0,
  webMod: 0,
  notificationChance: 0,
  denialChance: 0,
  corruptionMode: 0,
  hibernateMode: 0,
  singleMode: 0,
  lkToggle: 0,
  maxAudio: 1,
  maxVideos: 10,
} as const;

export { existsSync };
