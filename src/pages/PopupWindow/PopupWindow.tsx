/**
 * @file PopupWindow — content route for spawned Electron popup windows.
 *
 * Popup BrowserWindows load the app with a hash route of the form
 * `#/popup/:type/:mediaId/:popupId`. When the route matches, the app
 * renders only the popup media (image/video) instead of the main UI,
 * and closing the popup calls popup:closePopup with the window's ID.
 */
import { useCallback, useEffect, useState } from "react";
import { Text, Paper } from "@mantine/core";
import { IconMusic } from "@tabler/icons-react";
import { ImagePopup } from "../../features/image/ImagePopup";
import { VideoPopup } from "../../features/video/VideoPopup";
import { AudioPopup } from "../../features/audio/AudioPopup";
import { PromptDialog } from "../../features/prompt/PromptDialog";
import { SubliminalOverlay } from "../../features/subliminal/SubliminalOverlay";
import { PopupShell } from "../../components/PopupShell/PopupShell";
import { resolvePackMediaUrl, type MediaDir } from "../../features/popup/resolveMediaUrl";
import { useSettingsStore } from "../../stores/settingsStore";

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
}

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
  // The id segment may carry a trailing `?h=<gif>` (spiral overlay) inside the hash.
  const idPart = match[3];
  const qIdx = idPart.indexOf("?");
  const popupId = qIdx >= 0 ? idPart.slice(0, qIdx) : idPart;
  let hypnoGif: string | undefined;
  if (qIdx >= 0) {
    const match = idPart.slice(qIdx + 1).match(/(?:^|&)h=([^&]*)/);
    if (match?.[1]) hypnoGif = decodeURIComponent(match[1]);
  }
  return {
    type: match[1] as PopupRoute["type"],
    mediaId: decodeURIComponent(match[2]),
    popupId,
    hypnoGif,
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
        mediaWidth={viewport.width}
        mediaHeight={viewport.height}
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
        mediaWidth={viewport.width}
        mediaHeight={viewport.height}
      />
    );
  }

  if (route.type === "audio") {
    // Audio pops have no visual of their own; without a shell this would be an
    // invisible, unclosable always-on-top window — so give the popup a small
    // visible, closable surface while the file keeps streaming.
    return (
      <PopupShell onClose={handleClose} onBlacklist={handleBlacklist} opacity={lkOpacity}>
        <Paper
          data-testid="audio-popup-chip"
          withBorder
          radius="md"
          p="xs"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            backgroundColor: "rgba(14, 17, 25, 0.92)",
            borderColor: "var(--mantine-color-dark-5)",
            color: "white",
          }}
        >
          <IconMusic size={16} />
          <Text size="sm" fw={600}>
            Audio
          </Text>
        </Paper>
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
