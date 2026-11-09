/**
 * @file usePopupLifecycle — Manages popup spawning and cleanup.
 *
 * Provides spawnPopup, closePopup, and closeAll for the renderer to
 * create/close BrowserWindow popups via IPC. When all popups are closed
 * while mitosisMode is active, fires onMitosisSpawn to restart sparring.
 */
import { useCallback, useEffect, useRef } from "react";
import { useAppStore } from "../stores/appStore";
import { useSettingsStore } from "../stores/settingsStore";
import { maybeOpenWebOnClose } from "../features/popup/webOnClose";
import { unregisterOpenPopup } from "../features/popup/openPopups";

export interface PopupInstance {
  id: string;
  type: "image" | "video" | "subliminal" | "prompt";
  mediaId: string;
}

export interface UsePopupLifecycleOptions {
  // Invoked at render time, which is fragile — prefer the effect-based
  // useMitosis trigger for new code.
  /** Called when mitosis should spawn additional popups after all popups close */
  onMitosisSpawn?: () => void;
}

export function usePopupLifecycle(options: UsePopupLifecycleOptions = {}) {
  const { onMitosisSpawn } = options;
  const prevCountRef = useRef(0);

  const incrementPopups = useAppStore((s) => s.incrementPopups);
  const decrementPopups = useAppStore((s) => s.decrementPopups);
  const popupsCount = useAppStore((s) => s.popupsCount);
  const mitosisMode = useSettingsStore((s) => s.mitosisMode);

  const spawnPopup = useCallback(
      async (type: "image" | "video" | "audio" | "subliminal" | "prompt", mediaId: string, hypnoGif?: string): Promise<string | null> => {
      if (!window.api) return null;

      try {
        const result = await window.api.popup.create(type, mediaId, hypnoGif);
        if (!result || !result.id) {
          console.error("[usePopupLifecycle] popup:create returned no id");
          return null;
        }
        incrementPopups();
        return result.id;
      } catch (err) {
        console.error("[usePopupLifecycle] Failed to spawn popup:", err);
        return null;
      }
    },
    [incrementPopups]
  );

  useEffect(() => {
    if (!window.api) return;
    const unsubscribe = window.api.popup.onClosed((id: string) => {
      unregisterOpenPopup(id);
      decrementPopups();
      maybeOpenWebOnClose();
    });
    return unsubscribe;
  }, [decrementPopups]);

  const closePopup = useCallback(
    async (id: string) => {
      if (!window.api) return;

      try {
        await window.api.popup.closePopup(id);
        decrementPopups();
      } catch (err) {
        console.error("[usePopupLifecycle] Failed to close popup:", err);
        decrementPopups();
      }
    },
    [decrementPopups]
  );

  const closeAll = useCallback(async () => {
    if (!window.api) return;

    try {
      await window.api.popup.closeAll();
    } catch (err) {
      console.error("[usePopupLifecycle] Failed to close all popups:", err);
    }
  }, []);

  if (mitosisMode && prevCountRef.current > 0 && popupsCount === 0 && onMitosisSpawn) {
    onMitosisSpawn();
  }
  prevCountRef.current = popupsCount;

  return {
    spawnPopup,
    closePopup,
    closeAll,
  };
}
