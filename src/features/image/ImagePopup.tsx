import { useState, useEffect, useMemo } from "react";
import { Text, Center } from "@mantine/core";
import { PopupShell } from "../../components/PopupShell/PopupShell";
import { useSettingsStore } from "../../stores/settingsStore";
import { usePopupMovement } from "../../hooks/usePopupMovement";
import { useRandomClicksToClose } from "../../hooks/useRandomClicksToClose";
import { HypnoOverlay } from "../subliminal/HypnoOverlay";
import { computeContainedFrame } from "../popup/mediaFrame";
import { roll } from "../../utils/roll";

export interface ImagePopupProps {
  imageUrl: string;
  caption?: string;
  onClose?: () => void;
  /** Alt+close handler: blacklist the shown pack file. */
  onBlacklist?: () => void;
  mediaWidth?: number;
  mediaHeight?: number;
  /** Optional spiral GIF to lay over the image. */
  hypnoGif?: string;
}

export function ImagePopup({
  imageUrl,
  caption,
  onClose,
  onBlacklist,
  mediaWidth = 640,
  mediaHeight = 480,
  hypnoGif,
}: ImagePopupProps) {
  const denialChance = useSettingsStore((s) => s.denialChance);
  const showCaptions = useSettingsStore((s) => s.showCaptions);
  const buttonless = useSettingsStore((s) => s.buttonless);
  const multiClick = useSettingsStore((s) => s.multiClick);
  const timeoutPopups = useSettingsStore((s) => s.timeoutPopups);
  const popupTimeout = useSettingsStore((s) => s.popupTimeout);
  const clickthrough = useSettingsStore((s) => s.clickthroughPopups);
  const lkScaling = useSettingsStore((s) => s.lkScaling);
  const lkToggle = useSettingsStore((s) => s.lkToggle);
  const mediaFile = imageUrl.split("?")[0].split("/").pop() || undefined;
  const clicksToClose = useRandomClicksToClose(multiClick, mediaFile);
  const movingChance = useSettingsStore((s) => s.movingChance);
  const movingSpeed = useSettingsStore((s) => s.movingSpeed);

  const [denied, setDenied] = useState(false);
  const [movingEnabled, setMovingEnabled] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number } | null>(null);
  const [captionText, setCaptionText] = useState<string | undefined>();

  const frame = useMemo(
    () =>
      naturalSize
        ? computeContainedFrame(mediaWidth, mediaHeight, naturalSize.w, naturalSize.h)
        : null,
    [naturalSize, mediaWidth, mediaHeight]
  );

  useEffect(() => {
    if (roll(denialChance)) {
      setDenied(true);
    }
  }, []);

  useEffect(() => {
    setMovingEnabled(roll(movingChance));
  }, []);

  useEffect(() => {
    if (showCaptions && caption) {
      setCaptionText(caption);
    }
  }, [showCaptions, caption]);

  const { currentPosition } = usePopupMovement({
    enabled: movingEnabled,
    speed: movingSpeed,
    popupWidth: mediaWidth,
    popupHeight: mediaHeight,
  });

  return (
    <PopupShell
      onClose={onClose}
      onBlacklist={onBlacklist}
      buttonless={buttonless > 0}
      clicksToClose={clicksToClose}
      clickthroughEnabled={clickthrough > 0}
      timeoutMs={timeoutPopups > 0 ? popupTimeout * 1000 : 0}
      opacity={lkToggle === 1 && lkScaling > 0 ? lkScaling / 100 : 1}
    >
      <div
        style={{
          position: "absolute",
          top: currentPosition?.y ?? 0,
          left: currentPosition?.x ?? 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          height: "100%",
        }}
      >
        {captionText && (
          <Text
            data-testid="image-caption"
            size="sm"
            c="white"
            ta="center"
            style={{
              position: "absolute",
              top: 8,
              left: 0,
              right: 0,
              backgroundColor: "rgba(0,0,0,0.6)",
              padding: "4px 8px",
              zIndex: 5,
            }}
          >
            {captionText}
          </Text>
        )}

        <Center
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            height: "100%",
            filter: denied ? "blur(8px)" : undefined,
          }}
        >
          <img
            data-testid="image-popup-img"
            src={imageUrl}
            alt=""
            onLoad={(e) => {
              setImageLoaded(true);
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
              }
            }}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: imageLoaded ? "block" : "none",
            }}
          />
        </Center>
      </div>
      <HypnoOverlay gif={hypnoGif} frame={frame} />
    </PopupShell>
  );
}
