/**
 * @file useCloseLabel — Resolves the active pack's custom close-button label.
 *
 * The original app rendered a single corner button whose text comes from the pack
 * (captions `subtext`, e.g. "I submit <3") rather than an X. We fetch it once via
 * IPC and fall back to a neutral word in environments where no pack/IPC exists
 * (browser-layer tests, before a pack is selected).
 */
import { useEffect, useState } from "react";

export function useCloseLabel(fallback = "Close"): string {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    const fn = window.api?.pack?.closeLabel;
    if (typeof fn !== "function") return;
    fn()
      .then((l) => {
        if (live && typeof l === "string" && l.trim()) setLabel(l);
      })
      .catch(() => {
        /* keep fallback */
      });
    return () => {
      live = false;
    };
  }, []);

  return label ?? fallback;
}
