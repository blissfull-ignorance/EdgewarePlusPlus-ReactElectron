import { useEffect } from "react";
import { collectSettingsValues, useSettingsStore } from "../stores/settingsStore";
import { usePackDiscoveryStore } from "./usePackDiscovery";
import { useSettingsToasts } from "./useSettingsToasts";

/**
 * App-level side effects: settings load, pack discovery, autosave and
 * save-result toasts. Runs once per window (main window or popup route).
 */
export function useAppBootstrap(isPopupRoute: boolean) {
  useSettingsToasts();

  useEffect(() => {
    const init = async () => {
      await useSettingsStore.getState().load();
      if (isPopupRoute) return;
      if (useSettingsStore.getState().desktopIcons === 1) {
        void window.api?.system.createDesktopIcons({}).catch(() => undefined);
      }
      await usePackDiscoveryStore.getState().refreshPacks();
    };
    init();
  }, [isPopupRoute]);

  // Quit must not drop settings changed inside the autosave window: flush
  // synchronously while the window unloads.
  useEffect(() => {
    if (isPopupRoute) return;
    const flush = () => {
      const store = useSettingsStore.getState();
      if (!store.dirty) return;
      window.api?.system.flushSettings(collectSettingsValues(store));
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, [isPopupRoute]);

  useEffect(() => {
    if (isPopupRoute) return;
    const interval = setInterval(() => {
      const store = useSettingsStore.getState();
      if (store.dirty) void store.save();
    }, 5000);
    return () => clearInterval(interval);
  }, [isPopupRoute]);
}
