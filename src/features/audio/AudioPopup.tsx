/**
 * @file AudioPopup — renders real pack audio for "audio" pops.
 *
 * Unlike image/video popups there is no visual content: a single hidden,
 * self-playing `<audio>` element streams the pack file through the
 * `packmedia://` protocol exactly once (legacy queues one source and stops
 * at end-of-stream), then closes the popup — which releases any scripted
 * on_stop callback waiting on this file. Exposed with stable data-testids so
 * playback state can be asserted at the element level in the Electron E2E
 * layer.
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
        onEnded={() => onClose?.()}
        ref={(el) => {
          // Close the popup if the source fails hard, so a bad file can't leave a
          // zombie window open.
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
