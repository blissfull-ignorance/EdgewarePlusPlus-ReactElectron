import { describe, expect, it, beforeEach } from "vitest";
import { screen, cleanup, fireEvent } from "@testing-library/react";
import { HypnoOverlay } from "../../src/features/subliminal/HypnoOverlay";
import { renderWithMantine } from "./setup";
import { useSettingsStore } from "../../src/stores/settingsStore";
import { DEFAULT_HYPNO_ASSET } from "../../src/features/popup/resolveMediaUrl";

describe("HypnoOverlay", () => {
  beforeEach(() => {
    cleanup();
    useSettingsStore.setState({ subliminalsAlpha: 20 });
  });

  it("renders nothing without a gif", () => {
    renderWithMantine(<HypnoOverlay />);
    expect(screen.queryByTestId("hypno-overlay")).toBeNull();
  });

  it("lays a pack spiral (subdir-qualified) over the popup via packmedia://hypno/", () => {
    renderWithMantine(<HypnoOverlay gif="hypno/obedience.gif" />);
    const img = screen.getByTestId("hypno-overlay-img");
    expect(img.getAttribute("src")).toBe("packmedia://hypno/obedience.gif");
  });

  it("anchors a bare filename under the hypno subdir", () => {
    renderWithMantine(<HypnoOverlay gif="spiral.gif" />);
    const img = screen.getByTestId("hypno-overlay-img");
    expect(img.getAttribute("src")).toBe("packmedia://hypno/spiral.gif");
  });

  it("serves legacy-pack spirals from the subliminals/ subdir", () => {
    renderWithMantine(<HypnoOverlay gif="subliminals/old-spiral.gif" />);
    const img = screen.getByTestId("hypno-overlay-img");
    expect(img.getAttribute("src")).toBe("packmedia://subliminals/old-spiral.gif");
  });

  it("loads the built-in default spiral as a plain app asset when the pack has none", () => {
    renderWithMantine(<HypnoOverlay gif={DEFAULT_HYPNO_ASSET} />);
    const img = screen.getByTestId("hypno-overlay-img");
    expect(img.getAttribute("src")).toBe(DEFAULT_HYPNO_ASSET);
  });

  it("applies the configured subliminalsAlpha as the overlay opacity", () => {
    useSettingsStore.setState({ subliminalsAlpha: 50 });
    renderWithMantine(<HypnoOverlay gif="hypno/obedience.gif" />);
    expect(screen.getByTestId("hypno-overlay")).toHaveStyle("opacity: 0.5");
  });

  it("keeps pointer events on the underlying media (overlay is see-through to clicks)", () => {
    renderWithMantine(<HypnoOverlay gif="hypno/obedience.gif" />);
    expect(screen.getByTestId("hypno-overlay")).toHaveStyle("pointer-events: none");
  });

  it("clips the spiral to the base media frame and uses cover fit when a frame is given", () => {
    renderWithMantine(
      <HypnoOverlay gif="hypno/obedience.gif" frame={{ x: 50, y: 40, width: 300, height: 150 }} />
    );
    const box = screen.getByTestId("hypno-overlay");
    expect(box).toHaveStyle("left: 50px");
    expect(box).toHaveStyle("top: 40px");
    expect(box).toHaveStyle("width: 300px");
    expect(box).toHaveStyle("height: 150px");
    expect(box).toHaveStyle("overflow: hidden");
    const img = screen.getByTestId("hypno-overlay-img");
    expect(img).toHaveStyle("object-fit: cover");
  });

  it("falls back to the full popup box (cover-clipped at the edge) without a decoded frame", () => {
    renderWithMantine(<HypnoOverlay gif="hypno/obedience.gif" frame={null} />);
    const box = screen.getByTestId("hypno-overlay");
    expect(box).toHaveStyle("inset: 0px");
    expect(box).toHaveStyle("overflow: hidden");
    expect(screen.getByTestId("hypno-overlay-img")).toHaveStyle("object-fit: cover");
  });

  it("hides itself when the spiral source fails to load", () => {
    const { container } = renderWithMantine(<HypnoOverlay gif="hypno/broken.gif" />);
    const el = container.querySelector("[data-testid='hypno-overlay-img']")!;
    fireEvent(el, new Event("error"));
    expect(container.querySelector("[data-testid='hypno-overlay']")).toBeNull();
  });
});
