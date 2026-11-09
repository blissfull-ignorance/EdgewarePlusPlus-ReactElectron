import { useState, useEffect, useRef, useCallback } from "react";
import { useSettingsStore } from "../stores/settingsStore";
import { computeNextPosition, Position, Direction } from "../utils/movement";

export interface UsePopupMovementOptions {
  enabled?: boolean;
  speed?: number;
  popupWidth: number;
  popupHeight: number;
}

export function usePopupMovement({
  enabled = false,
  speed: speedOverride,
  popupWidth,
  popupHeight,
}: UsePopupMovementOptions) {
  const movingSpeed = useSettingsStore((s) => s.movingSpeed);
  const speed = speedOverride ?? movingSpeed;
  const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
  const directionRef = useRef<Direction>({
    dx: Math.random() > 0.5 ? 1 : -1,
    dy: Math.random() > 0.5 ? 1 : -1,
  });
  const positionRef = useRef<Position>({ x: 0, y: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const screenRef = useRef<{ width: number; height: number }>({
    width: typeof window !== "undefined" ? window.innerWidth : 1920,
    height: typeof window !== "undefined" ? window.innerHeight : 1080,
  });

  useEffect(() => {
    const handleResize = () => {
      screenRef.current = {
        width: window.innerWidth,
        height: window.innerHeight,
      };
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const tick = useCallback(() => {
    const result = computeNextPosition(
      positionRef.current,
      directionRef.current,
      speed,
      popupWidth,
      popupHeight,
      screenRef.current.width,
      screenRef.current.height
    );
    positionRef.current = result.position;
    directionRef.current = result.direction;
    setCurrentPosition({ ...result.position });
  }, [speed, popupWidth, popupHeight]);

  useEffect(() => {
    if (!enabled) return;

    intervalRef.current = setInterval(tick, 16);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, tick]);

  return { currentPosition };
}
