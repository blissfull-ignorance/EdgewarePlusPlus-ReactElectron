import { useState, useEffect, useCallback, useRef } from "react";
import { Image } from "@mantine/core";

export interface StartupSplashProps {
  imageUrl: string;
  onFadeComplete: () => void;
}

export function StartupSplash({ imageUrl, onFadeComplete }: StartupSplashProps) {
  const [opacity, setOpacity] = useState(0);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isDestroyed, setIsDestroyed] = useState(false);
  const onFadeCompleteRef = useRef(onFadeComplete);

  onFadeCompleteRef.current = onFadeComplete;

  const fadeStep = 16;
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
    if (cleanupTimeoutRef.current) {
      clearTimeout(cleanupTimeoutRef.current);
      cleanupTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const fadeDuration = 2000;
    const steps = fadeDuration / fadeStep;
    const delta = 1 / steps;

    fadeIntervalRef.current = setInterval(() => {
      if (!mounted) return;
      setOpacity((prev) => {
        const next = Math.min(1, prev + delta);
        if (next >= 1) {
          clearInterval(fadeIntervalRef.current!);
          fadeIntervalRef.current = null;

          cleanupTimeoutRef.current = setTimeout(() => {
            if (!mounted) return;
            setIsFadingOut(true);

            fadeIntervalRef.current = setInterval(() => {
              if (!mounted) return;
              setOpacity((prev2) => {
                const next2 = Math.max(0, prev2 - delta);
                if (next2 <= 0) {
                  clearInterval(fadeIntervalRef.current!);
                  fadeIntervalRef.current = null;
                  onFadeCompleteRef.current();
                  setIsDestroyed(true);
                }
                return next2;
              });
            }, fadeStep);
          }, 2000);
        }
        return next;
      });
    }, fadeStep);

    return () => {
      mounted = false;
      cleanup();
    };
  }, [cleanup]);

  if (isDestroyed) return null;

  return (
    <div
      data-testid="startup-splash"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "black",
        opacity,
        transition: isFadingOut ? "opacity 0.1s linear" : undefined,
        zIndex: 9999,
      }}
    >
      <Image
        data-testid="splash-image"
        src={imageUrl}
        fit="contain"
        style={{
          maxWidth: "100%",
          maxHeight: "100%",
        }}
      />
    </div>
  );
}
