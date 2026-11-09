import { create } from "zustand";
import { logger } from "../utils/logger";
import { useSettingsStore } from "../stores/settingsStore";
import type { PackListing } from "../types/pack";

interface PackDiscoveryStore {
  packs: PackListing[];
  isLoading: boolean;
  error: string | null;
  refreshPacks: () => Promise<void>;
}

export const usePackDiscoveryStore = create<PackDiscoveryStore>((set) => ({
  packs: [],
  isLoading: false,
  error: null,
  refreshPacks: async () => {
    set({ isLoading: true, error: null });
    try {
      const packs = await window.api?.system.listPacks();
      set({ packs: packs ?? [], isLoading: false });

      const settingsState = useSettingsStore.getState();
      if (!settingsState.packPath && packs.length > 0) {
        settingsState.setRaw({ packPath: packs[0].path });
        await settingsState.save();
      }
    } catch (err) {
      logger.error("[usePackDiscovery] refreshPacks failed:", err);
      set({ isLoading: false });
    }
  },
}));

export function usePackDiscovery<T>(selector: (state: PackDiscoveryStore) => T): T {
  return usePackDiscoveryStore(selector);
}
