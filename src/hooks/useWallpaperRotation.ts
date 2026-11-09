/**
 * @file useWallpaperRotation — drives desktop wallpaper rotation while the
 * runtime runs (legacy `handle_wallpaper`).
 *
 * With rotation on, a wallpaper from the `wallpaperDat` list is applied every
 * `wallpaperTimer` ± `wallpaperVariance` ms, never repeating the previous
 * pick while other candidates exist. Files are pack-relative. A missing or
 * empty list disables rotation with a single warning.
 */
import { useEffect, useRef } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { nextWallpaperPick, parseWallpaperDat, rotationDelay } from "../features/wallpaper/rotation";
import { logger } from "../utils/logger";

export function useWallpaperRotation(active: boolean): void {
  const previousRef = useRef<string | null>(null);

  useEffect(() => {
    if (!active) return;
    const s0 = useSettingsStore.getState();
    if (s0.rotateWallpaper !== 1) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let warnedEmpty = false;

    const scheduleNext = () => {
      const s = useSettingsStore.getState();
      const files = parseWallpaperDat(String(s.wallpaperDat ?? ""));
      if (files.length === 0) {
        if (!warnedEmpty) {
          warnedEmpty = true;
          logger.warn("[wallpaperRotation] rotation is on but no wallpapers are configured — rotation idle");
        }
        return;
      }
      timer = setTimeout(rotate, rotationDelay(s.wallpaperTimer, s.wallpaperVariance));
    };

    const rotate = async () => {
      if (cancelled) return;
      const s = useSettingsStore.getState();
      const files = parseWallpaperDat(String(s.wallpaperDat ?? ""));
      const pick = nextWallpaperPick(files, previousRef.current);
      if (pick && s.packPath) {
        const root = String(s.packPath).replace(/\/+$/, "");
        try {
          await window.api?.system.setWallpaper(`${root}/${pick}`);
          previousRef.current = pick;
        } catch (err) {
          logger.error("[wallpaperRotation] wallpaper change failed:", err);
        }
      }
      if (!cancelled) scheduleNext();
    };

    scheduleNext();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active]);
}
