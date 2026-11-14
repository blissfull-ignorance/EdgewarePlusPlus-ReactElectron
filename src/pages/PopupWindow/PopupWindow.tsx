/**
 * @file PopupWindow — content route for spawned Electron popup windows.
 *
 * Popup BrowserWindows load the app with a hash route of the form
 * `#/popup/:type/:mediaId/:popupId`. When the route matches, the app
 * renders only the popup media (image/video) instead of the main UI,
 * and closing the popup calls popup:closePopup with the window's ID.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Text } from "@mantine/core";
import { IconMusic } from "@tabler/icons-react";
import { ImagePopup } from "../../features/image/ImagePopup";
import { VideoPopup } from "../../features/video/VideoPopup";
import { AudioPopup } from "../../features/audio/AudioPopup";
import { PromptDialog } from "../../features/prompt/PromptDialog";
import { SubliminalOverlay } from "../../features/subliminal/SubliminalOverlay";
import { PopupShell } from "../../components/PopupShell/PopupShell";
import { resolvePackMediaUrl, type MediaDir } from "../../features/popup/resolveMediaUrl";
import { useSettingsStore } from "../../stores/settingsStore";
import { roll } from "../../utils/roll";

/**
 * Popup windows are small fixed-size BrowserWindows; the media inside must be
 * framed to the real window size (movement bounds + overlay clipping), not the
 * component's default 640x480 assumption.
 */
function usePopupViewport() {
  const [size, setSize] = useState(() => ({
    width: typeof window !== "undefined" ? window.innerWidth : 400,
    height: typeof window !== "undefined" ? window.innerHeight : 300,
  }));

  useEffect(() => {
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return size;
}

export interface PopupRoute {
  // "subliminal" is the text popup route (mediaId carries the phrase);
  // hypno is an overlay on image/video pops, not a route of its own.
  type: "image" | "video" | "audio" | "subliminal" | "prompt";
  mediaId: string;
  popupId: string;
  /** Optional spiral GIF to overlay on top of image/video pops. */
  hypnoGif?: string;
  /** Legacy pump-scare: this pop force-closes shortly after opening. */
  pumpScare?: boolean;
}

// Legacy pump-scare: popups spawned by a pump-scare burst close 2.5 s after
// opening, whatever the timeout settings say (popup.py try_pump_scare).
const PUMP_SCARE_CLOSE_MS = 2500;

const POPUP_DIR: Record<PopupRoute["type"], MediaDir | null> = {
  image: "img",
  video: "vid",
  audio: "aud",
  subliminal: null,
  prompt: null,
};

export function parsePopupRoute(hash: string): PopupRoute | null {
  const match = hash.match(/^#\/popup\/(image|video|audio|subliminal|prompt)\/([^/]+)\/(.+)$/);
  if (!match) return null;
  // The id segment may carry a trailing `?h=<gif>&ps=1` (spiral overlay,
  // pump-scare force-close) inside the hash.
  // Malformed percent-encoding (a hand-typed hash) must not blank the
  // window: keep the raw segment instead of throwing during render.
  const safeDecode = (s: string): string => {
    try {
      return decodeURIComponent(s);
    } catch {
      return s;
    }
  };
  const idPart = match[3];
  const qIdx = idPart.indexOf("?");
  const popupId = qIdx >= 0 ? idPart.slice(0, qIdx) : idPart;
  let hypnoGif: string | undefined;
  let pumpScare = false;
  if (qIdx >= 0) {
    const query = idPart.slice(qIdx + 1);
    const h = query.match(/(?:^|&)h=([^&]*)/);
    if (h?.[1]) hypnoGif = safeDecode(h[1]);
    pumpScare = /(?:^|&)ps=1(?:&|$)/.test(query);
  }
  return {
    type: match[1] as PopupRoute["type"],
    mediaId: safeDecode(match[2]),
    popupId,
    hypnoGif,
    pumpScare: pumpScare || undefined,
  };
}

export function PopupWindow({ route }: { route: PopupRoute }) {
  const handleClose = useCallback(() => {
    void window.api?.popup.closePopup(route.popupId);
  }, [route.popupId]);
  const handleBlacklist = useCallback(() => {
    void window.api?.pack.blacklist(route.mediaId);
    void window.api?.popup.closePopup(route.popupId);
  }, [route.mediaId, route.popupId]);
  const viewport = usePopupViewport();
  const lkScaling = useSettingsStore((s) => s.lkScaling);
  const lkOpacity = lkScaling > 0 ? lkScaling / 100 : 1;

  // Legacy try_move: roll once per media popup whether this window drifts
  // across the display. The roll waits for loaded settings — the default
  // movingChance of 0 would otherwise always win the race on startup.
  const settingsLoaded = useSettingsStore((s) => s.loaded);
  const movingChance = useSettingsStore((s) => s.movingChance);
  const moveRolledRef = useRef(false);
  useEffect(() => {
    if (!settingsLoaded || moveRolledRef.current) return;
    if (route.type !== "image" && route.type !== "video") return;
    moveRolledRef.current = true;
    if (roll(movingChance)) {
      void window.api?.popup.startMoving(route.popupId).catch(() => undefined);
    }
  }, [settingsLoaded, movingChance, route.type, route.popupId]);

  const dir = POPUP_DIR[route.type];
  const mediaUrl = dir ? resolvePackMediaUrl(route.mediaId, dir) : route.mediaId;

  if (route.type === "subliminal") {
    return <SubliminalOverlay text={route.mediaId} onClose={handleClose} />;
  }

  if (route.type === "image") {
    return (
      <ImagePopup
        imageUrl={mediaUrl}
        onClose={handleClose}
        onBlacklist={handleBlacklist}
        hypnoGif={route.hypnoGif}
        popupId={route.popupId}
        mediaWidth={viewport.width}
        mediaHeight={viewport.height}
        forcedTimeoutMs={route.pumpScare ? PUMP_SCARE_CLOSE_MS : undefined}
      />
    );
  }

  if (route.type === "video") {
    return (
      <VideoPopup
        videoUrl={mediaUrl}
        onClose={handleClose}
        onBlacklist={handleBlacklist}
        hypnoGif={route.hypnoGif}
        popupId={route.popupId}
        mediaWidth={viewport.width}
        mediaHeight={viewport.height}
        forcedTimeoutMs={route.pumpScare ? PUMP_SCARE_CLOSE_MS : undefined}
      />
    );
  }

  if (route.type === "audio") {
    // Audio pops are a small chip with a music symbol, not a media window;
    // the shell keeps it closable while the file streams invisibly.
    return (
      <PopupShell onClose={handleClose} onBlacklist={handleBlacklist} opacity={lkOpacity} buttonless>
        <div
          data-testid="audio-popup-chip"
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderRadius: 10,
            backgroundColor: "rgba(14, 17, 25, 0.92)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            color: "white",
          }}
        >
          <IconMusic size={16} />
          <Text size="xs" fw={600}>
            Audio
          </Text>
        </div>
        <AudioPopup audioUrl={mediaUrl} onClose={handleClose} />
      </PopupShell>
    );
  }

  if (route.type === "prompt") {
    return (
      <PromptDialog command={route.mediaId} expectedAnswer={route.mediaId} onClose={() => handleClose()} />
    );
  }

  return (
    <PopupShell onClose={handleClose}>
      <Text c="white" size="sm">
        {route.type} popup
      </Text>
    </PopupShell>
  );
}
