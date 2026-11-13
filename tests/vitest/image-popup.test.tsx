import { describe, expect, it, vi } from "vitest";
import { renderWithMantine } from "./setup";
import { ImagePopup } from "../../src/features/image/ImagePopup";
import { useSettingsStore } from "../../src/stores/settingsStore";

describe("ImagePopup", () => {
  it("renders image element with correct src", () => {
    const { container } = renderWithMantine(
      <ImagePopup
        imageUrl="test-image.png"
        onClose={() => {}}
      />
    );
    const img = container.querySelector<HTMLImageElement>('[data-testid="image-popup-img"]');
    expect(img).not.toBeNull();
    expect(img!.src).toContain("test-image.png");
  });

  it("renders caption when provided and showCaptions is enabled", () => {
    useSettingsStore.setState({ showCaptions: 1 });
    const { container } = renderWithMantine(
      <ImagePopup
        imageUrl="test.png"
        caption="Test caption"
        onClose={() => {}}
      />
    );
    const caption = container.querySelector('[data-testid="image-caption"]');
    expect(caption).not.toBeNull();
    expect(caption!.textContent).toBe("Test caption");
  });

  it("hides the caption when showCaptions is disabled", () => {
    useSettingsStore.setState({ showCaptions: 0 });
    const { container } = renderWithMantine(
      <ImagePopup imageUrl="test.png" caption="Test caption" onClose={() => {}} />
    );
    expect(container.querySelector('[data-testid="image-caption"]')).toBeNull();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const { container } = renderWithMantine(
      <ImagePopup
        imageUrl="test.png"
        onClose={onClose}
      />
    );
    const closeBtn = container.querySelector('[data-testid="close-button"]');
    closeBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(onClose).toHaveBeenCalled();
  });
});
