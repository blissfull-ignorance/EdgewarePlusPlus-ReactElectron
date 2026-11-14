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

  // Main-process readers (popup geometry) must see settings changes at once,
  // not at the next autosave tick: every change is pushed into the main-side
  // cache. Persistence still runs on the autosave cadence.
  useEffect(() => {
    if (isPopupRoute) return;
    let last = "";
    const push = () => {
      const store = useSettingsStore.getState();
      if (!store.loaded) return;
      const record = collectSettingsValues(store);
      const json = JSON.stringify(record);
      if (json === last) return;
      last = json;
      window.api?.system.pushSettings?.(record);
    };
    push();
    return useSettingsStore.subscribe(push);
  }, [isPopupRoute]);
}
