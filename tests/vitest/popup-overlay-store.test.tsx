import { describe, expect, it, beforeEach } from "vitest";
import { screen, waitFor, cleanup, fireEvent } from "@testing-library/react";
import { usePopupOverlayStore } from "../../src/stores/popupOverlayStore";
import { useAppStore } from "../../src/stores/appStore";
import { InAppPopupOverlay } from "../../src/components/InAppPopupOverlay";
import { renderWithMantine } from "./setup";

describe("popupOverlayStore", () => {
  beforeEach(() => {
    usePopupOverlayStore.setState({ popups: [] });
  });

  it("starts with no popups", () => {
    expect(usePopupOverlayStore.getState().popups).toEqual([]);
  });

  it("addPopup adds an entry and returns its id", () => {
    const id = usePopupOverlayStore.getState().addPopup({ type: "image", mediaId: "img/foo.png" });
    expect(id).toBeTruthy();
    const { popups } = usePopupOverlayStore.getState();
    expect(popups).toHaveLength(1);
    expect(popups[0].id).toBe(id);
    expect(popups[0].type).toBe("image");
    expect(popups[0].mediaId).toBe("img/foo.png");
  });

  it("addPopup carries the hypno overlay reference onto the popup", () => {
    const id = usePopupOverlayStore.getState().addPopup({
      type: "image",
      mediaId: "img/foo.png",
      hypnoGif: "hypno/obedience.gif",
    });
    const popup = usePopupOverlayStore.getState().popups.find((p) => p.id === id);
    expect(popup?.hypnoGif).toBe("hypno/obedience.gif");
  });

  it("addPopup accepts prompt popups whose mediaId is the phrase text", () => {
    const id = usePopupOverlayStore.getState().addPopup({ type: "prompt", mediaId: "Type for me" });
    const popup = usePopupOverlayStore.getState().popups.find((p) => p.id === id);
    expect(popup).toBeDefined();
    expect(popup?.type).toBe("prompt");
    expect(popup?.mediaId).toBe("Type for me");
  });

  it("addPopup generates unique ids and viewport-bounded positions", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const id = usePopupOverlayStore.getState().addPopup({ type: "video", mediaId: `vid/v${i}.mp4` });
      ids.add(id);
    }
    expect(ids.size).toBe(5);

    const { popups } = usePopupOverlayStore.getState();
    for (const popup of popups) {
      expect(popup.position.x).toBeGreaterThanOrEqual(0);
      expect(popup.position.y).toBeGreaterThanOrEqual(0);
      expect(popup.position.width).toBeGreaterThan(0);
      expect(popup.position.height).toBeGreaterThan(0);
      expect(popup.position.x + popup.position.width).toBeLessThanOrEqual(window.innerWidth);
      expect(popup.position.y + popup.position.height).toBeLessThanOrEqual(window.innerHeight);
    }
  });

  it("removePopup removes only the matching popup", () => {
    const a = usePopupOverlayStore.getState().addPopup({ type: "image", mediaId: "a.png" });
    const b = usePopupOverlayStore.getState().addPopup({ type: "video", mediaId: "b.mp4" });
    const c = usePopupOverlayStore.getState().addPopup({ type: "image", mediaId: "c.png" });

    usePopupOverlayStore.getState().removePopup(b);
    const { popups } = usePopupOverlayStore.getState();
    expect(popups).toHaveLength(2);
    expect(popups.map((p) => p.id).sort()).toEqual([a, c].sort());
  });

  it("removePopup with unknown id leaves popups unchanged", () => {
    usePopupOverlayStore.getState().addPopup({ type: "image", mediaId: "a.png" });
    usePopupOverlayStore.getState().removePopup("does-not-exist");
    expect(usePopupOverlayStore.getState().popups).toHaveLength(1);
  });

  it("clearAll removes all popups", () => {
    usePopupOverlayStore.getState().addPopup({ type: "image", mediaId: "a.png" });
    usePopupOverlayStore.getState().addPopup({ type: "video", mediaId: "b.mp4" });
    usePopupOverlayStore.getState().clearAll();
    expect(usePopupOverlayStore.getState().popups).toEqual([]);
  });
});

describe("InAppPopupOverlay", () => {
  beforeEach(() => {
    cleanup();
    usePopupOverlayStore.setState({ popups: [] });
    useAppStore.setState({ popupsCount: 0 });
  });

  it("renders one overlay box per popup in the store", () => {
    renderWithMantine(<InAppPopupOverlay />);

    expect(screen.queryByTestId("in-app-popup")).toBeNull();

    usePopupOverlayStore.getState().addPopup({ type: "image", mediaId: "img/x.png" });
    usePopupOverlayStore.getState().addPopup({ type: "video", mediaId: "vid/y.mp4" });

    return waitFor(() => {
      expect(screen.getAllByTestId("in-app-popup")).toHaveLength(2);
    });
  });

  it("renders a prompt popup as a PromptDialog; a correct answer closes it", async () => {
    const { container } = renderWithMantine(<InAppPopupOverlay />);

    usePopupOverlayStore.getState().addPopup({ type: "prompt", mediaId: "Type for me" });

    await waitFor(() => {
      expect(screen.getByTestId("prompt-dialog")).toBeVisible();
      expect(screen.getByTestId("prompt-dialog")).toHaveTextContent("Type for me");
    });

    const input = container.querySelector<HTMLInputElement>('[data-testid="prompt-input"]');
    fireEvent.change(input!, { target: { value: "Type for me" } });
    fireEvent.click(screen.getByTestId("prompt-submit"));

    await waitFor(() => {
      expect(screen.queryByTestId("prompt-dialog")).toBeNull();
    });
    expect(usePopupOverlayStore.getState().popups).toEqual([]);
  });

  it("renders a hypno spiral over the in-app image popup", async () => {
    renderWithMantine(<InAppPopupOverlay />);

    usePopupOverlayStore.getState().addPopup({
      type: "image",
      mediaId: "img/foo.png",
      hypnoGif: "hypno/obedience.gif",
    });

    await waitFor(() => {
      const img = screen.getByTestId("hypno-overlay-img");
      expect(img).toBeVisible();
      expect(img.getAttribute("src")).toBe("packmedia://hypno/obedience.gif");
    });
  });

  it("closing a popup removes it from the store and decrements the popup count", async () => {
    renderWithMantine(<InAppPopupOverlay />);

    const id = usePopupOverlayStore.getState().addPopup({ type: "image", mediaId: "img/x.png" });
    useAppStore.getState().incrementPopups();

    await waitFor(() => {
      expect(screen.getAllByTestId("in-app-popup")).toHaveLength(1);
    });

    screen.getByTestId("popup-shell").click();

    expect(usePopupOverlayStore.getState().popups).toEqual([]);
    expect(useAppStore.getState().popupsCount).toBe(0);

    await waitFor(() => {
      expect(screen.queryByTestId("in-app-popup")).toBeNull();
    });
    expect(id).toBeTruthy();
  });
});
