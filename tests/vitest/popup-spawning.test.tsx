import { describe, expect, it, beforeEach, vi } from "vitest";
import { act, renderHook, screen, waitFor, cleanup } from "@testing-library/react";
import { MainAppPage } from "../../src/pages/MainAppPage/MainAppPage";
import { usePopupLifecycle } from "../../src/hooks/usePopupLifecycle";
import { useAppStore } from "../../src/stores/appStore";
import { registerOpenPopup } from "../../src/features/popup/openPopups";
import { useSettingsStore } from "../../src/stores/settingsStore";
import { usePopupOverlayStore } from "../../src/stores/popupOverlayStore";
import { renderWithMantine } from "./setup";

function resetStores() {
  cleanup();
  useAppStore.setState({ isRunning: false, popupsCount: 0, hibernateActive: false });
  usePopupOverlayStore.setState({ popups: [] });
  useSettingsStore.setState({
    popupRenderMode: "electron",
    popupMod: 0,
    vidMod: 0,
    audioMod: 0,
    promptMod: 0,
    capPopChance: 0,
    subliminalsChance: 0,
    webMod: 0,
    delay: 100,
    mitosisMode: 0,
    mitosisStrength: 0,
    buttonless: 0,
    multiClick: 0,
    timeoutPopups: 0,
    denialChance: 0,
    movingChance: 0,
    showCaptions: 0,
  });
  window.api.pack.randomImage = vi.fn().mockResolvedValue("img/foo.png");
  window.api.pack.randomVideo = vi.fn().mockResolvedValue("vid/bar.mp4");
  window.api.pack.randomAudio = vi.fn().mockResolvedValue("aud/baz.ogg");
  window.api.popup.create = vi
    .fn()
    .mockImplementation((_type, _mediaId) => Promise.resolve({ id: `popup-test-${Date.now()}` }));
  window.api.popup.closePopup = vi.fn().mockResolvedValue(undefined);
  window.api.popup.closeAll = vi.fn().mockResolvedValue(undefined);
  window.api.popup.onClosed = vi.fn().mockImplementation((callback: (id: string) => void) => {
    (window as unknown as Record<string, unknown>).__onPopupClosed = callback;
    return () => {
      (window as unknown as Record<string, unknown>).__onPopupClosed = undefined;
    };
  });
}

describe("usePopupLifecycle spawning (Electron mode)", () => {
  beforeEach(resetStores);

  it("spawnPopup calls IPC popup:create with type and media and increments count", async () => {
    const { result } = renderHook(() => usePopupLifecycle());

    await act(async () => {
      await result.current.spawnPopup("image", "img/foo.png");
    });

    expect(window.api.popup.create).toHaveBeenCalledWith("image", "img/foo.png", undefined);
    expect(useAppStore.getState().popupsCount).toBe(1);
  });

  it("spawnPopup forwards a hypno GIF to the popup window when provided", async () => {
    const { result } = renderHook(() => usePopupLifecycle());

    await act(async () => {
      await result.current.spawnPopup("image", "img/foo.png", "hypno/spiral.gif");
    });

    expect(window.api.popup.create).toHaveBeenCalledWith("image", "img/foo.png", "hypno/spiral.gif");
  });

  it("spawnPopup returns null and does not increment when IPC fails", async () => {
    window.api.popup.create = vi.fn().mockRejectedValue(new Error("IPC failure"));
    const { result } = renderHook(() => usePopupLifecycle());

    let id: string | null = "unset";
    await act(async () => {
      id = await result.current.spawnPopup("video", "vid/bar.mp4");
    });

    expect(id).toBeNull();
    expect(useAppStore.getState().popupsCount).toBe(0);
  });

  it("closeAll calls IPC popup:closeAll", async () => {
    const { result } = renderHook(() => usePopupLifecycle());

    await act(async () => {
      await result.current.closeAll();
    });

    expect(window.api.popup.closeAll).toHaveBeenCalledTimes(1);
  });

  it("popup:closed IPC event decrements the popup count", async () => {
    renderHook(() => usePopupLifecycle());

    act(() => {
      registerOpenPopup("popup-1", "image");
      registerOpenPopup("popup-2", "video");
      useAppStore.getState().incrementPopups();
      useAppStore.getState().incrementPopups();
    });
    expect(useAppStore.getState().popupsCount).toBe(2);

    const onClosed = window as unknown as { __onPopupClosed?: (id: string) => void };
    expect(onClosed.__onPopupClosed).toBeTypeOf("function");

    // A close for an id the renderer never spawned (script popup) must not
    // erode the count.
    act(() => {
      onClosed.__onPopupClosed!("popup-lua");
    });
    expect(useAppStore.getState().popupsCount).toBe(2);

    act(() => {
      onClosed.__onPopupClosed!("popup-1");
    });
    expect(useAppStore.getState().popupsCount).toBe(1);

    act(() => {
      onClosed.__onPopupClosed!("popup-2");
    });
    expect(useAppStore.getState().popupsCount).toBe(0);
  });

  it("Stop-driven mass close never launches web-on-close browsers", async () => {
    renderHook(() => usePopupLifecycle());
    useSettingsStore.setState({ webPopup: 1, webMod: -100 }); // roll((100-(-100))/2)=roll(100): always fires
    window.api.pack.randomWeb = vi.fn().mockResolvedValue("https://x.example/");
    window.api.system.openExternal = vi.fn().mockResolvedValue(undefined);

    const onClosed = window as unknown as { __onPopupClosed?: (id: string) => void };
    act(() => registerOpenPopup("popup-w", "image"));

    // Stopped: the closed event must not open anything.
    act(() => onClosed.__onPopupClosed!("popup-w"));
    await waitFor(() => expect(useAppStore.getState().popupsCount).toBe(0));
    expect(window.api.system.openExternal).not.toHaveBeenCalled();

    // Running: the same event rolls and opens.
    act(() => {
      useAppStore.getState().start();
      registerOpenPopup("popup-w2", "image");
      onClosed.__onPopupClosed!("popup-w2");
    });
    await waitFor(() => expect(window.api.system.openExternal).toHaveBeenCalledWith("https://x.example/"));
  });

  it("a second close of the same id does not decrement twice", async () => {
    const { result } = renderHook(() => usePopupLifecycle());
    act(() => {
      registerOpenPopup("popup-d", "image");
      useAppStore.getState().incrementPopups();
    });

    await act(async () => {
      await result.current.closePopup("popup-d");
      await result.current.closePopup("popup-d");
    });
    expect(useAppStore.getState().popupsCount).toBe(0);
  });

  it("spawnPopup returns null and does not increment when IPC resolves without an id", async () => {
    window.api.popup.create = vi.fn().mockResolvedValue({});
    const { result } = renderHook(() => usePopupLifecycle());

    let id: string | null = "unset";
    await act(async () => {
      id = await result.current.spawnPopup("image", "img/foo.png");
    });

    expect(id).toBeNull();
    expect(useAppStore.getState().popupsCount).toBe(0);
  });
});

describe("MainAppPage popup spawning", () => {
  beforeEach(resetStores);

  it("In-App mode: roll tick adds a popup to the overlay store", async () => {
    useSettingsStore.setState({ popupRenderMode: "inapp", popupMod: 100 });
    renderWithMantine(<MainAppPage />);

    act(() => {
      useAppStore.getState().start();
    });

    await waitFor(
      () => {
        expect(usePopupOverlayStore.getState().popups.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 }
    );
    expect(usePopupOverlayStore.getState().popups[0].type).toBe("image");
    expect(usePopupOverlayStore.getState().popups[0].mediaId).toBe("img/foo.png");
    expect(useAppStore.getState().popupsCount).toBeGreaterThanOrEqual(1);
  });

  it("Electron mode: roll tick spawns popup via IPC", async () => {
    useSettingsStore.setState({ popupMod: 100 });
    renderWithMantine(<MainAppPage />);

    act(() => {
      useAppStore.getState().start();
    });

    await waitFor(
      () => {
        expect(window.api.popup.create).toHaveBeenCalledWith("image", "img/foo.png", undefined);
      },
      { timeout: 3000 }
    );
    expect(useAppStore.getState().popupsCount).toBeGreaterThanOrEqual(1);
  });

  it("Electron mode: a rolled hypno overlay rides along with the image spawn", async () => {
    useSettingsStore.setState({
      popupRenderMode: "electron",
      popupMod: 100,
      subliminalsChance: 100,
    });
    window.api.pack.randomHypnoGif = vi.fn().mockResolvedValue("hypno/spiral.gif");
    renderWithMantine(<MainAppPage />);

    act(() => {
      useAppStore.getState().start();
    });

    await waitFor(
      () => {
        expect(window.api.popup.create).toHaveBeenCalledWith("image", "img/foo.png", "hypno/spiral.gif");
      },
      { timeout: 3000 }
    );
  });

  it("Electron mode: falls back to the built-in default spiral when the pack has no hypno media", async () => {
    useSettingsStore.setState({
      popupRenderMode: "electron",
      popupMod: 100,
      subliminalsChance: 100,
    });
    window.api.pack.randomHypnoGif = vi.fn().mockResolvedValue(null);
    renderWithMantine(<MainAppPage />);

    act(() => {
      useAppStore.getState().start();
    });

    await waitFor(
      () => {
        expect(window.api.popup.create).toHaveBeenCalledWith("image", "img/foo.png", "default_hypno.gif");
      },
      { timeout: 3000 }
    );
  });

  it("In-App mode: a rolled hypno overlay is stored with the popup", async () => {
    useSettingsStore.setState({
      popupRenderMode: "inapp",
      popupMod: 100,
      subliminalsChance: 100,
    });
    window.api.pack.randomHypnoGif = vi.fn().mockResolvedValue("hypno/spiral.gif");
    renderWithMantine(<MainAppPage />);

    act(() => {
      useAppStore.getState().start();
    });

    await waitFor(
      () => {
        expect(usePopupOverlayStore.getState().popups.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 3000 }
    );
    const imagePop = usePopupOverlayStore
      .getState()
      .popups.find((p) => p.type === "image");
    expect(imagePop?.hypnoGif).toBe("hypno/spiral.gif");
  });

  it("stop clears in-app popups, resets count, and calls closeAll", async () => {
    useSettingsStore.setState({ popupRenderMode: "inapp" });
    renderWithMantine(<MainAppPage />);

    act(() => {
      useAppStore.getState().start();
    });

    act(() => {
      usePopupOverlayStore.getState().addPopup({ type: "image", mediaId: "img/a.png" });
      usePopupOverlayStore.getState().addPopup({ type: "video", mediaId: "vid/b.mp4" });
      useAppStore.getState().incrementPopups();
      useAppStore.getState().incrementPopups();
    });
    expect(useAppStore.getState().popupsCount).toBe(2);

    screen.getByTestId("start-stop-button").click();

    expect(usePopupOverlayStore.getState().popups).toEqual([]);
    expect(useAppStore.getState().popupsCount).toBe(0);
    expect(window.api.popup.closeAll).toHaveBeenCalledTimes(1);
  });

  it("In-App mode: an in-flight spawn that resolves after Stop is discarded", async () => {
    useSettingsStore.setState({ popupRenderMode: "inapp", popupMod: 100 });

    let resolveMedia: (value: string | null) => void = () => {};
    window.api.pack.randomImage = vi.fn().mockImplementation(
      () =>
        new Promise<string | null>((resolve) => {
          resolveMedia = resolve;
        })
    );

    renderWithMantine(<MainAppPage />);

    act(() => {
      useAppStore.getState().start();
    });

    await waitFor(() => {
      expect(window.api.pack.randomImage).toHaveBeenCalled();
    });

    act(() => {
      useAppStore.getState().stop();
    });

    act(() => {
      resolveMedia("img/foo.png");
    });

    await new Promise((r) => setTimeout(r, 100));

    expect(usePopupOverlayStore.getState().popups).toHaveLength(0);
    expect(useAppStore.getState().popupsCount).toBe(0);
  });
});

describe("mitosis spawning", () => {
  beforeEach(resetStores);

  it("mitosis trigger spawns N popups (N = mitosisStrength)", async () => {
    useSettingsStore.setState({
      popupRenderMode: "inapp",
      mitosisMode: 1,
      mitosisStrength: 3,
    });
    renderWithMantine(<MainAppPage />);

    act(() => {
      useAppStore.getState().start();
      useAppStore.getState().incrementPopups();
    });

    act(() => {
      useAppStore.getState().decrementPopups();
    });

    await waitFor(
      () => {
        expect(usePopupOverlayStore.getState().popups).toHaveLength(3);
      },
      { timeout: 3000 }
    );
    expect(useAppStore.getState().popupsCount).toBe(3);
  });

  it("mitosis does not trigger while stopped", async () => {
    useSettingsStore.setState({
      popupRenderMode: "inapp",
      mitosisMode: 1,
      mitosisStrength: 2,
    });
    renderWithMantine(<MainAppPage />);

    act(() => {
      useAppStore.getState().start();
      useAppStore.getState().incrementPopups();
    });

    // stop() resets popupsCount to 0 and isRunning to false in a single atomic
    // set, so the mitosis trigger (fires at count 0) sees isRunning already false.
    act(() => {
      useAppStore.getState().stop();
    });

    await new Promise((r) => setTimeout(r, 300));

    expect(usePopupOverlayStore.getState().popups).toHaveLength(0);
    expect(useAppStore.getState().popupsCount).toBe(0);
  });
});
