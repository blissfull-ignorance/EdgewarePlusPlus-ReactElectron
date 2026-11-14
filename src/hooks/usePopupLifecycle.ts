/**
 * @file usePopupLifecycle — Manages popup spawning and cleanup.
 *
 * Provides spawnPopup, closePopup, and closeAll for the renderer to
 * create/close BrowserWindow popups via IPC. Mitosis triggering lives in
 * the effect-based useMitosis hook, not here.
 */
import { useCallback, useEffect } from "react";
import { useAppStore } from "../stores/appStore";
import { maybeOpenWebOnClose } from "../features/popup/webOnClose";
import { registerOpenPopup, unregisterOpenPopup } from "../features/popup/openPopups";

export interface PopupInstance {
  id: string;
  type: "image" | "video" | "subliminal" | "prompt";
  mediaId: string;
}

export function usePopupLifecycle() {
  const incrementPopups = useAppStore((s) => s.incrementPopups);
  const decrementPopups = useAppStore((s) => s.decrementPopups);

  const spawnPopup = useCallback(
      async (
        type: "image" | "video" | "audio" | "subliminal" | "prompt",
        mediaId: string,
        hypnoGif?: string,
        pumpScare?: boolean
      ): Promise<string | null> => {
      if (!window.api) return null;

      try {
        const result = await window.api.popup.create(type, mediaId, hypnoGif, pumpScare);
        if (!result || !result.id) {
          console.error("[usePopupLifecycle] popup:create returned no id");
          return null;
        }
        registerOpenPopup(result.id, type);
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
      // Only renderer-spawned popups own a count slot; script-spawned
      // windows closing must not erode the popup count.
      if (unregisterOpenPopup(id)) {
        decrementPopups();
        // Web-on-close belongs to the session: a Stop-driven mass close
        // must not launch browsers.
        if (useAppStore.getState().isRunning) maybeOpenWebOnClose();
      }
    });
    return unsubscribe;
  }, [decrementPopups]);

  const closePopup = useCallback(
    async (id: string) => {
      if (!window.api) return;

      try {
        await window.api.popup.closePopup(id);
        if (unregisterOpenPopup(id)) decrementPopups();
      } catch (err) {
        console.error("[usePopupLifecycle] Failed to close popup:", err);
        if (unregisterOpenPopup(id)) decrementPopups();
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

  return {
    spawnPopup,
    closePopup,
    closeAll,
  };
}
