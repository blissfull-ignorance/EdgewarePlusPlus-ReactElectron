/**
 * @file AudioPopup — renders real pack audio for "audio" pops.
 *
 * Unlike image/video popups there is no visual content: a single hidden,
 * self-playing `<audio>` element streams the pack file through the `packmedia://`
 * protocol and loops until the popup is closed (Stop or closeAll). Exposed with
 * stable data-testids so playback state can be asserted at the element level in
 * the Electron E2E layer (task 21 A21.4).
 */

export interface AudioPopupProps {
  audioUrl: string;
  onClose?: () => void;
}

export function AudioPopup({ audioUrl, onClose }: AudioPopupProps) {
  return (
    <div
      data-testid="audio-popup"
      style={{ position: "absolute", top: 0, left: 0, width: 1, height: 1, overflow: "hidden" }}
    >
      <audio
        data-testid="audio-popup-audio"
        src={audioUrl}
        autoPlay
        loop
        ref={(el) => {
          // Close the popup if the source fails hard, so a bad file can't leave a
          // zombie window open (task 21 A21.6).
          if (!el || el.dataset.errorHandled === "true") return;
          el.addEventListener("error", () => {
            el.dataset.errorHandled = "true";
            onClose?.();
          });
        }}
      />
    </div>
  );
}
