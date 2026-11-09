import { useEffect } from "react";
import { useSettingsStore } from "../stores/settingsStore";
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

  useEffect(() => {
    if (isPopupRoute) return;
    const interval = setInterval(() => {
      const store = useSettingsStore.getState();
      if (store.dirty) void store.save();
    }, 5000);
    return () => clearInterval(interval);
  }, [isPopupRoute]);
}
