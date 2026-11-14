/**
 * @file AudioPopup — renders real pack audio for "audio" pops.
 *
 * Unlike image/video popups there is no visual content: a single hidden,
 * self-playing `<audio>` element streams the pack file through the
 * `packmedia://` protocol exactly once (legacy queues one source and stops
 * at end-of-stream), then closes the popup — which releases any scripted
 * on_stop callback waiting on this file. Volume follows the legacy model:
 * `audioVolume` is the target, `fadeInDuration` ramps up from silence, and
 * `fadeOutDuration` is scheduled to hit zero exactly at end-of-stream.
 * Exposed with stable data-testids so playback state can be asserted at the
 * element level in the Electron E2E layer.
 */

import { useCallback, useEffect, useRef } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { planAudioFades, targetVolume } from "./audioFade";

const TICK_MS = 16;

export interface AudioPopupProps {
  audioUrl: string;
  onClose?: () => void;
  /**
   * Pump-scare parity: close this window this many ms after mount regardless
   * of playback or timeout settings (legacy `try_pump_scare` = 2500).
   */
  forcedCloseMs?: number;
}

export function AudioPopup({ audioUrl, onClose, forcedCloseMs }: AudioPopupProps) {
  const audioVolume = useSettingsStore((s) => s.audioVolume);
  const fadeInDuration = useSettingsStore((s) => s.fadeInDuration);
  const fadeOutDuration = useSettingsStore((s) => s.fadeOutDuration);

  const closedRef = useRef(false);
  const close = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onClose?.();
  }, [onClose]);

  const rampRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeOutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rampTo = useCallback((el: HTMLAudioElement, to: number, durationMs: number) => {
    if (rampRef.current) clearInterval(rampRef.current);
    const from = el.volume;
    if (durationMs <= 0) {
      el.volume = to;
      return;
    }
    const steps = Math.max(1, Math.ceil(durationMs / TICK_MS));
    const delta = (to - from) / steps;
    let step = 0;
    rampRef.current = setInterval(() => {
      step += 1;
      if (step >= steps) {
        el.volume = to;
        if (rampRef.current) {
          clearInterval(rampRef.current);
          rampRef.current = null;
        }
        return;
      }
      el.volume = Math.min(1, Math.max(0, from + delta * step));
    }, TICK_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (rampRef.current) clearInterval(rampRef.current);
      if (fadeOutTimerRef.current) clearTimeout(fadeOutTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (forcedCloseMs === undefined) return;
    const t = setTimeout(close, forcedCloseMs);
    return () => clearTimeout(t);
  }, [forcedCloseMs, close]);

  const handleLoadedMetadata = useCallback(
    (el: HTMLAudioElement) => {
      const target = targetVolume(audioVolume);
      const plan = planAudioFades(el.duration * 1000, fadeInDuration, fadeOutDuration);
      if (plan.fadeInMs > 0) {
        el.volume = 0;
        rampTo(el, target, plan.fadeInMs);
      } else {
        el.volume = target;
      }
      if (plan.fadeOutMs > 0) {
        fadeOutTimerRef.current = setTimeout(() => rampTo(el, 0, plan.fadeOutMs), plan.fadeOutStartMs);
      }
    },
    [audioVolume, fadeInDuration, fadeOutDuration, rampTo]
  );

  return (
    <div
      data-testid="audio-popup"
      style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, overflow: "hidden" }}
    >
      <audio
        data-testid="audio-popup-audio"
        src={audioUrl}
        autoPlay
        onLoadedMetadata={(e) => handleLoadedMetadata(e.currentTarget)}
        onEnded={close}
        ref={(el) => {
          // Close the popup if the source fails hard, so a bad file can't leave a
          // zombie window open.
          if (!el || el.dataset.errorHandled === "true") return;
          el.addEventListener("error", () => {
            el.dataset.errorHandled = "true";
            close();
          });
        }}
      />
    </div>
  );
}
