import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { Center } from "@mantine/core";
import { PopupShell } from "../../components/PopupShell/PopupShell";
import { useSettingsStore } from "../../stores/settingsStore";
import { usePopupMovement } from "../../hooks/usePopupMovement";
import { useRandomClicksToClose } from "../../hooks/useRandomClicksToClose";
import { HypnoOverlay } from "../subliminal/HypnoOverlay";
import { computeContainedFrame } from "../popup/mediaFrame";
import { roll } from "../../utils/roll";

export interface VideoPopupProps {
  videoUrl: string;
  onClose?: () => void;
  mediaWidth?: number;
  mediaHeight?: number;
  /** Optional spiral GIF to lay over the video. */
  hypnoGif?: string;
}

export function VideoPopup({
  videoUrl,
  onClose,
  mediaWidth = 640,
  mediaHeight = 480,
  hypnoGif,
}: VideoPopupProps) {
  const videoVolume = useSettingsStore((s) => s.videoVolume / 100);
  const buttonless = useSettingsStore((s) => s.buttonless);
  const multiClick = useSettingsStore((s) => s.multiClick);
  const timeoutPopups = useSettingsStore((s) => s.timeoutPopups);
  const popupTimeout = useSettingsStore((s) => s.popupTimeout);
  const clickthrough = useSettingsStore((s) => s.clickthroughPopups);
  const lkScaling = useSettingsStore((s) => s.lkScaling);
  const movingChance = useSettingsStore((s) => s.movingChance);
  const movingSpeed = useSettingsStore((s) => s.movingSpeed);
  const denialChance = useSettingsStore((s) => s.denialChance);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [denied, setDenied] = useState(false);
  const [movingEnabled, setMovingEnabled] = useState(false);
  const mediaFile = videoUrl.split("?")[0].split("/").pop() || undefined;
  const clicksToClose = useRandomClicksToClose(multiClick, mediaFile);

  useEffect(() => {
    if (roll(denialChance)) {
      setDenied(true);
    }
  }, []);

  useEffect(() => {
    setMovingEnabled(roll(movingChance));
  }, []);

  const [videoLoaded, setVideoLoaded] = useState(false);

  useEffect(() => {
    if (videoRef.current && videoRef.current.volume !== videoVolume) {
      videoRef.current.volume = videoVolume;
    }
  }, [videoVolume]);

  const frame = useMemo(
    () =>
      videoLoaded
        ? computeContainedFrame(mediaWidth, mediaHeight, videoRef.current?.videoWidth ?? 0, videoRef.current?.videoHeight ?? 0)
        : null,
    [videoLoaded, mediaWidth, mediaHeight]
  );

  const handleVideoLoad = useCallback(() => {
    setVideoLoaded(true);
  }, []);


  const handleEnded = useCallback(() => {
    onClose?.();
  }, [onClose]);

  const { currentPosition: videoPosition } = usePopupMovement({
    enabled: movingEnabled,
    speed: movingSpeed,
    popupWidth: mediaWidth,
    popupHeight: mediaHeight,
  });

  return (
    <PopupShell
      onClose={onClose}
      buttonless={buttonless > 0}
      clicksToClose={clicksToClose}
      clickthroughEnabled={clickthrough > 0}
      timeoutMs={timeoutPopups > 0 ? popupTimeout * 1000 : 0}
      opacity={lkScaling > 0 ? lkScaling / 100 : 1}
    >
      <div
        style={{
          position: "absolute",
          top: videoPosition?.y ?? 0,
          left: videoPosition?.x ?? 0,
          width: "100%",
          height: "100%",
        }}
      >
        <Center
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
            loop
            muted={false}
            onEnded={handleEnded}
            onLoadedMetadata={handleVideoLoad}
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
