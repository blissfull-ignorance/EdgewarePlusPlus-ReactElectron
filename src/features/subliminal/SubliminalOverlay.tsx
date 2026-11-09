import { useEffect, useState } from "react";
import { Text } from "@mantine/core";
import { computeSubliminalAlpha } from "../../utils/leet";
import { useSettingsStore } from "../../stores/settingsStore";

export interface SubliminalOverlayProps {
  text: string;
  timeoutMs?: number;
  onClose?: () => void;
}

export function SubliminalOverlay({ text, timeoutMs, onClose }: SubliminalOverlayProps) {
  const subliminalsAlpha = useSettingsStore((s) => s.subliminalsAlpha / 100);
  const [visible, setVisible] = useState(true);
  const alphaValue = computeSubliminalAlpha(subliminalsAlpha);
  const timeout = timeoutMs ?? Math.max(100, 500);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, timeout);

    return () => clearTimeout(timer);
  }, [timeout, onClose]);

  if (!visible) return null;

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
      }}
    >
      <Text
        data-testid="subliminal-text"
        size="xl"
        fw={700}
        ta="center"
        style={{
          color: `rgba(255, 255, 255, ${alphaValue / 255})`,
          userSelect: "none",
          textShadow: "0 0 4px rgba(0,0,0,0.8)",
        }}
      >
        {text}
      </Text>
    </div>
  );
}
