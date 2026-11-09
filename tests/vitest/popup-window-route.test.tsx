import { describe, expect, it, beforeEach, vi } from "vitest";
import { screen, waitFor, cleanup } from "@testing-library/react";
import { parsePopupRoute, PopupWindow } from "../../src/pages/PopupWindow/PopupWindow";
import { renderWithMantine } from "./setup";

describe("parsePopupRoute", () => {
  it("parses a valid image route", () => {
    expect(parsePopupRoute("#/popup/image/foo.png/popup-123")).toEqual({
      type: "image",
      mediaId: "foo.png",
      popupId: "popup-123",
    });
  });

  it("parses a valid video route", () => {
    expect(parsePopupRoute("#/popup/video/bar.mp4/popup-abc")).toEqual({
      type: "video",
      mediaId: "bar.mp4",
      popupId: "popup-abc",
    });
  });

  it("decodes encoded media ids (slashes, spaces)", () => {
    const route = parsePopupRoute("#/popup/image/sub%20dir%2Ffile%20name.png/popup-9");
    expect(route?.mediaId).toBe("sub dir/file name.png");
  });

  it("returns null for the main window (empty hash)", () => {
    expect(parsePopupRoute("")).toBeNull();
  });

  it("returns null for unrelated hashes", () => {
    expect(parsePopupRoute("#/settings")).toBeNull();
    expect(parsePopupRoute("#/popup")).toBeNull();
  });

  it("returns null when the popup id is missing", () => {
    expect(parsePopupRoute("#/popup/image/foo.png")).toBeNull();
  });

  it("returns null for truly unsupported popup types", () => {
    expect(parsePopupRoute("#/popup/flash/foo/1")).toBeNull();
  });

  it("parses an audio popup route (task 21: real audio pops)", () => {
    expect(parsePopupRoute("#/popup/audio/think.wav/1")).toEqual({
      type: "audio",
      mediaId: "think.wav",
      popupId: "1",
    });
  });

  it("parses the hypno overlay carried in the id segment (?h=)", () => {
    expect(parsePopupRoute("#/popup/image/foo.png/popup-1?h=hypno%2Fobedience.gif")).toEqual({
      type: "image",
      mediaId: "foo.png",
      popupId: "popup-1",
      hypnoGif: "hypno/obedience.gif",
    });
  });

  it("parses the built-in default spiral as the overlay", () => {
    expect(parsePopupRoute("#/popup/video/bar.mp4/popup-2?h=default_hypno.gif")).toEqual({
      type: "video",
      mediaId: "bar.mp4",
      popupId: "popup-2",
      hypnoGif: "default_hypno.gif",
    });
  });

  it("parses a prompt route whose text is the media id", () => {
    expect(parsePopupRoute(`#/popup/prompt/${encodeURIComponent("Type for me")}/popup-7`)).toEqual({
      type: "prompt",
      mediaId: "Type for me",
      popupId: "popup-7",
    });
  });
});

describe("PopupWindow", () => {
  beforeEach(() => {
    cleanup();
    window.api.popup.closePopup = vi.fn().mockResolvedValue(undefined);
  });

  it("renders an image popup and closes via IPC with the route id", async () => {
    renderWithMantine(
      <PopupWindow route={{ type: "image", mediaId: "img/foo.png", popupId: "popup-42" }} />
    );

    await waitFor(() => {
      expect(screen.getByTestId("popup-shell")).toBeVisible();
    });

    screen.getByTestId("close-button").click();

    expect(window.api.popup.closePopup).toHaveBeenCalledWith("popup-42");
  });

  it("renders a closable fallback shell for prompt routes", () => {
    renderWithMantine(
      <PopupWindow route={{ type: "prompt", mediaId: "p1", popupId: "popup-9" }} />
    );

    expect(screen.getByTestId("popup-shell")).toBeVisible();
    screen.getByTestId("close-button").click();

    expect(window.api.popup.closePopup).toHaveBeenCalledWith("popup-9");
  });

  it("renders a closable audio popup (visible shell, not an invisible window)", async () => {
    renderWithMantine(
      <PopupWindow route={{ type: "audio", mediaId: "aud/think.wav", popupId: "popup-a1" }} />
    );

    await waitFor(() => {
      expect(screen.getByTestId("popup-shell")).toBeVisible();
    });
    expect(screen.queryByTestId("audio-popup-chip")).not.toBeNull();
    expect(screen.queryByTestId("audio-popup-audio")).not.toBeNull();

    screen.getByTestId("close-button").click();
    expect(window.api.popup.closePopup).toHaveBeenCalledWith("popup-a1");
  });
});
