import { describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "./setup";
import { VideoPopup } from "../../src/features/video/VideoPopup";

describe("VideoPopup", () => {
  it("renders video element with correct src", () => {
    const { container } = renderWithMantine(
      <VideoPopup
        videoUrl="test-video.mp4"
        onClose={() => {}}
      />
    );
    const video = container.querySelector<HTMLVideoElement>('[data-testid="video-popup-video"]');
    expect(video).not.toBeNull();
    expect(video!.src).toContain("test-video.mp4");
  });

  it("video has autoplay and loop attributes", () => {
    const { container } = renderWithMantine(
      <VideoPopup
        videoUrl="test-video.mp4"
        onClose={() => {}}
      />
    );
    const video = container.querySelector<HTMLVideoElement>('[data-testid="video-popup-video"]');
    expect(video!.hasAttribute("autoplay")).toBe(true);
    expect(video!.hasAttribute("loop")).toBe(true);
  });

  it("wraps content in PopupShell", () => {
    const { container } = renderWithMantine(
      <VideoPopup
        videoUrl="test.mp4"
        onClose={() => {}}
      />
    );
    const shell = container.querySelector('[data-testid="popup-shell"]');
    expect(shell).not.toBeNull();
  });

  it("calls onClose when video ends", () => {
    const onClose = vi.fn();
    const { container } = renderWithMantine(
      <VideoPopup
        videoUrl="test.mp4"
        onClose={onClose}
      />
    );
    const video = container.querySelector<HTMLVideoElement>('[data-testid="video-popup-video"]');
    video!.dispatchEvent(new Event("ended"));
    expect(onClose).toHaveBeenCalled();
  });
});
