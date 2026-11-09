/**
 * @file SubliminalOverlay — the legacy subliminal text popup.
 *
 * A short pack phrase (from the `subliminals` lists, falling back to captions)
 * shown centered, large and semi-transparent, then destroyed after
 * `capPopTimer` ms. Rendered inside a dedicated transparent popup window in
 * electron mode and directly over the main window in in-app mode.
 *
 * Sizing follows the legacy geometry: font ≈ min(monitor)/10 and wrap ≈
 * monitor/1.5, expressed in viewport units because the popup window covers
 * that region. Alpha is `capPopOpacity` used directly (100 = fully opaque).
 */
import { useEffect, useState } from "react";
import { useSettingsStore } from "../../stores/settingsStore";

export interface SubliminalOverlayProps {
  text: string;
  /** Overrides the configured `capPopTimer` (ms). */
  timeoutMs?: number;
  onClose?: () => void;
}

export function SubliminalOverlay({ text, timeoutMs, onClose }: SubliminalOverlayProps) {
  const opacity = useSettingsStore((s) => s.capPopOpacity) / 100;
  const configuredTimer = useSettingsStore((s) => s.capPopTimer);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!text) return;
    const timeout = Math.max(100, timeoutMs ?? configuredTimer);
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, timeout);
    return () => clearTimeout(timer);
  }, [text, timeoutMs, configuredTimer, onClose]);

  if (!text || !visible) return null;

  return (
    <div
      data-testid="subliminal-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        zIndex: 9998,
        opacity,
      }}
    >
      <div
        data-testid="subliminal-text"
        style={{
          color: "white",
          textAlign: "center",
          fontWeight: 700,
          fontSize: "min(10vw, 10vh)",
          maxWidth: "66vw",
          lineHeight: 1.2,
          textShadow: "0 2px 12px rgba(0,0,0,0.9)",
          userSelect: "none",
          whiteSpace: "pre-wrap",
        }}
      >
        {text}
      </div>
    </div>
  );
}
