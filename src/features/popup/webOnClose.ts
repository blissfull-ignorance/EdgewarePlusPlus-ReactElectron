/**
 * @file webOnClose — legacy `Popup.try_web_open` parity.
 *
 * When the "web on popup close" toggle is enabled, closing any popup rolls with
 * (100 - webChance) / 2 and, on success, opens a random pack web URL in the
 * system browser without spawning a window — exactly as the original app did.
 */
import { useSettingsStore } from "../../stores/settingsStore";
import { roll } from "../../utils/roll";
import { logger } from "../../utils/logger";

export function maybeOpenWebOnClose(): void {
  const api = typeof window !== "undefined" ? window.api : undefined;
  if (!api?.pack?.randomWeb || !api?.system?.openExternal) return;

  const settings = useSettingsStore.getState();
  if (!settings.webPopup) return;
  if (!roll((100 - settings.webMod) / 2)) return;

  void (async () => {
    try {
      const url = await api.pack.randomWeb();
      if (url) {
        await api.system.openExternal(url);
      }
    } catch (err) {
      logger.warn("[webOnClose] Failed to open pack web url:", err);
    }
  })();
}
