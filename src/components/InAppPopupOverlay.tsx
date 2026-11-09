/**
 * @file InAppPopupOverlay — renders in-app popups on top of the main window.
 *
 * Each popup is an absolutely positioned box; the transform on the box makes
 * it the containing block for PopupShell's fixed positioning, so each popup
 * is confined to its own region of the viewport.
 */
import { useAppStore } from "../stores/appStore";
import { usePopupOverlayStore } from "../stores/popupOverlayStore";
import { ImagePopup } from "../features/image/ImagePopup";
import { VideoPopup } from "../features/video/VideoPopup";
import { AudioPopup } from "../features/audio/AudioPopup";
import { PromptDialog } from "../features/prompt/PromptDialog";
import { resolvePackMediaUrl, type MediaDir } from "../features/popup/resolveMediaUrl";
import { maybeOpenWebOnClose } from "../features/popup/webOnClose";
import { unregisterOpenPopup } from "../features/popup/openPopups";

const POPUP_DIR: Record<string, MediaDir | null> = {
  image: "img",
  video: "vid",
  audio: "aud",
};

export function InAppPopupOverlay() {
  const popups = usePopupOverlayStore((s) => s.popups);
  const removePopup = usePopupOverlayStore((s) => s.removePopup);

  const handleClose = (id: string) => {
    removePopup(id);
    unregisterOpenPopup(id);
    useAppStore.getState().decrementPopups();
    maybeOpenWebOnClose();
  };

  return (
    <div
      data-testid="in-app-popup-overlay"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: "none",
        zIndex: 1100,
      }}
    >
      {popups.map((popup) => {
        const dir = POPUP_DIR[popup.type];
        const mediaUrl = dir ? resolvePackMediaUrl(popup.mediaId, dir) : popup.mediaId;

        if (popup.type === "audio") {
          return (
            <div key={popup.id} data-testid="in-app-popup" data-popup-id={popup.id}>
              <AudioPopup audioUrl={mediaUrl} onClose={() => handleClose(popup.id)} />
            </div>
          );
        }

        return (
          <div
            key={popup.id}
            data-testid="in-app-popup"
            data-popup-id={popup.id}
            style={{
              position: "absolute",
              left: popup.position.x,
              top: popup.position.y,
              width: popup.position.width,
              height: popup.position.height,
              pointerEvents: "auto",
              background: "var(--mantine-color-dark-9)",
              borderRadius: 12,
              border: "1px solid var(--mantine-color-dark-5)",
              boxShadow: "0 24px 64px rgba(0, 0, 0, 0.55)",
              overflow: "hidden",
              transform: "translateZ(0)",
            }}
          >
            {popup.type === "image" && (
              <ImagePopup
                imageUrl={mediaUrl}
                onClose={() => handleClose(popup.id)}
                mediaWidth={popup.position.width}
                mediaHeight={popup.position.height}
                hypnoGif={popup.hypnoGif}
              />
            )}
            {popup.type === "video" && (
              <VideoPopup
                videoUrl={mediaUrl}
                onClose={() => handleClose(popup.id)}
                mediaWidth={popup.position.width}
                mediaHeight={popup.position.height}
                hypnoGif={popup.hypnoGif}
              />
            )}
            {popup.type === "prompt" && (
              <PromptDialog
                command={popup.mediaId}
                expectedAnswer={popup.mediaId}
                onClose={() => handleClose(popup.id)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
