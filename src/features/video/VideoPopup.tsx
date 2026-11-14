import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { Center } from "@mantine/core";
import { PopupShell } from "../../components/PopupShell/PopupShell";
import { useSettingsStore } from "../../stores/settingsStore";
import { useRandomClicksToClose } from "../../hooks/useRandomClicksToClose";
import { HypnoOverlay } from "../subliminal/HypnoOverlay";
import { computeContainedFrame } from "../popup/mediaFrame";
import { nextVideoAction, videoLoopAttribute } from "./loop";
import { roll } from "../../utils/roll";

export interface VideoPopupProps {
  videoUrl: string;
  onClose?: () => void;
  /** Alt+close handler: blacklist the shown pack file. */
  onBlacklist?: () => void;
  mediaWidth?: number;
  mediaHeight?: number;
  /** Optional spiral GIF to lay over the video. */
  hypnoGif?: string;
  /** Popup window ID: the window is resized to fit the video once measured. */
  popupId?: string;
  /** Legacy pump-scare: auto-close this many ms after open, ignoring timeout settings. */
  forcedTimeoutMs?: number;
}

export function VideoPopup({
  videoUrl,
  onClose,
  onBlacklist,
  mediaWidth = 640,
  mediaHeight = 480,
  hypnoGif,
  popupId,
  forcedTimeoutMs,
}: VideoPopupProps) {
  const videoVolume = useSettingsStore((s) => s.videoVolume / 100);
  const buttonless = useSettingsStore((s) => s.buttonless);
  const multiClick = useSettingsStore((s) => s.multiClick);
  const timeoutPopups = useSettingsStore((s) => s.timeoutPopups);
  const popupTimeout = useSettingsStore((s) => s.popupTimeout);
  const clickthrough = useSettingsStore((s) => s.clickthroughPopups);
  const lkScaling = useSettingsStore((s) => s.lkScaling);
  const lkToggle = useSettingsStore((s) => s.lkToggle);
  const denialChance = useSettingsStore((s) => s.denialChance);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [denied, setDenied] = useState(false);
  const mediaFile = videoUrl.split("?")[0].split("/").pop() || undefined;
  const clicksToClose = useRandomClicksToClose(multiClick, mediaFile);

  useEffect(() => {
    if (roll(denialChance)) {
      setDenied(true);
    }
  }, []);

  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (videoRef.current && videoRef.current.volume !== videoVolume) {
      videoRef.current.volume = videoVolume;
    }
  }, [videoVolume]);

  const frame = useMemo(
    () =>
      naturalSize
        ? computeContainedFrame(mediaWidth, mediaHeight, naturalSize.w, naturalSize.h)
        : null,
    [naturalSize, mediaWidth, mediaHeight]
  );

  const handleVideoLoad = useCallback(() => {
    const el = videoRef.current;
    if (el && el.videoWidth > 0 && el.videoHeight > 0) {
      setNaturalSize({ w: el.videoWidth, h: el.videoHeight });
      if (popupId) {
        void window.api?.popup
          .sizeToMedia(popupId, el.videoWidth, el.videoHeight, lkToggle === 1)
          .catch(() => undefined);
      }
    }
  }, [popupId, lkToggle]);

  const playsRef = useRef(0);
  const videoLoopInf = useSettingsStore((s) => s.videoLoopInf);
  const videoLoopCount = useSettingsStore((s) => s.videoLoopCount);

  const handleEnded = useCallback(() => {
    playsRef.current += 1;
    if (nextVideoAction(playsRef.current, videoLoopInf, videoLoopCount) === "close") {
      onClose?.();
      return;
    }
    const el = videoRef.current;
    if (el && videoLoopInf !== 1) {
      el.currentTime = 0;
      try {
        void el.play().catch(() => undefined);
      } catch {
        /* environments without media playback (jsdom) */
      }
    }
  }, [onClose, videoLoopInf, videoLoopCount]);

  return (
    <PopupShell
      onClose={onClose}
      onBlacklist={onBlacklist}
      buttonless={buttonless > 0}
      clicksToClose={clicksToClose}
      clickthroughEnabled={clickthrough > 0}
      timeoutMs={forcedTimeoutMs ?? (timeoutPopups > 0 ? popupTimeout : 0)}
      opacity={lkToggle === 1 && lkScaling > 0 ? lkScaling / 100 : 1}
    >
      <div style={{ width: "100%", height: "100%" }}>
        <Center
          // Clicking anywhere on the popup counts as a close click; the
          // pack's maxClicks decides how many clicks are needed (one when
          // multi-click mode is off). The close button stays as an
          // affordance until buttonless or multi-click hides it.
          style={{
            width: "100%",
            height: "100%",
            filter: denied ? "blur(8px)" : undefined,
          }}
        >
          <video
            data-testid="video-popup-video"
            ref={videoRef}
            src={videoUrl}
            autoPlay
            loop={videoLoopAttribute(videoLoopInf)}
            muted={false}
            onEnded={handleEnded}
            onLoadedMetadata={handleVideoLoad}
            onError={() => onClose?.()}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
            }}
          />
        </Center>
      </div>
      <HypnoOverlay gif={hypnoGif} frame={frame} />
    </PopupShell>
  );
}
