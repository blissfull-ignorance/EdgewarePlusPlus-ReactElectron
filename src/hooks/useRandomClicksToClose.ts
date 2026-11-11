/**
 * @file useRandomClicksToClose — legacy `Popup.try_multi_click` parity.
 *
 * When the multi-click toggle is on, each popup needs random.randint(1, mood.max_clicks)
 * click(s) to close, where the mood comes from the pack's media-to-mood mapping
 * (falling back to the default mood). Fetches the pack index once per popup.
 */
import { useEffect, useState } from "react";

export function clicksForIndex(idx: Record<string, unknown> | null, fileName?: string): number {
  const d = idx?.["default"] as Record<string, unknown> | undefined;
  let maxClicks = typeof d?.["maxClicks"] === "number" ? (d.maxClicks as number) : 1;

  if (fileName && idx) {
    const mediaMoods = idx["mediaMoods"] as Record<string, string[]> | undefined;
    const moods = (idx["moods"] ?? []) as Array<Record<string, unknown>>;
    const moodNames = mediaMoods?.[fileName] ?? [];
    const mood = moods.find((m) => moodNames.includes(m["name"] as string));
    if (mood && typeof mood["maxClicks"] === "number") {
      maxClicks = mood.maxClicks as number;
    }
  }

  maxClicks = Math.max(1, Math.min(maxClicks, 100));
  return 1 + Math.floor(Math.random() * maxClicks);
}

export function useRandomClicksToClose(multiClickEnabled: number, fileName?: string): number {
  const [clicks, setClicks] = useState(0);

  useEffect(() => {
    if (multiClickEnabled <= 0) {
      setClicks(0);
      return;
    }
    let live = true;
    const fn = window.api?.pack?.loadIndex;
    if (typeof fn !== "function") {
      setClicks(1);
      return;
    }
    void fn()
      .then((idx) => {
        if (live) setClicks(clicksForIndex(idx, fileName));
      })
      .catch(() => {
        if (live) setClicks(1);
      });
    return () => {
      live = false;
    };
  }, [multiClickEnabled, fileName]);

  return clicks;
}
