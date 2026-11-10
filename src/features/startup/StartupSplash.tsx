import { useEffect, useRef, useState } from "react";
import { Image } from "@mantine/core";

export interface StartupSplashProps {
  imageUrl: string;
  onFadeComplete: () => void;
}

const HOLD_MS = 1800;
const FADE_MS = 800;

/**
 * Startup splash: an opaque full-screen black backdrop with the pack (or
 * default) image, shown from the very first frame so the app UI behind it is
 * never visible. After a short hold it fades out to reveal the app.
 */
export function StartupSplash({ imageUrl, onFadeComplete }: StartupSplashProps) {
  const [fadingOut, setFadingOut] = useState(false);
  const [destroyed, setDestroyed] = useState(false);
  const onFadeCompleteRef = useRef(onFadeComplete);
  onFadeCompleteRef.current = onFadeComplete;

  useEffect(() => {
    const fadeTimer = setTimeout(() => setFadingOut(true), HOLD_MS);
    const doneTimer = setTimeout(() => {
      setDestroyed(true);
      onFadeCompleteRef.current();
    }, HOLD_MS + FADE_MS + 60);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(doneTimer);
    };
  }, []);

  if (destroyed) return null;

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
        opacity: fadingOut ? 0 : 1,
        transition: fadingOut ? `opacity ${FADE_MS}ms ease-out` : undefined,
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
