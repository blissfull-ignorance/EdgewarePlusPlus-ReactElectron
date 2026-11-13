import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { renderWithMantine } from "./setup";
import { GalleryPanel } from "../../src/features/gallery/GalleryPanel";
import { useSettingsStore } from "../../src/stores/settingsStore";
import { useAppStore } from "../../src/stores/appStore";

const api = () =>
  (window as unknown as { api: { pack: { listGallery: ReturnType<typeof vi.fn> } } }).api.pack;

const result = {
  entries: [
    { file: "free.png", kind: "image" as const, moods: [] },
    { file: "locked.png", kind: "image" as const, moods: ["locked"] },
    { file: "voice.wav", kind: "audio" as const, moods: ["voice"] },
    { file: "clip.mp4", kind: "video" as const, moods: ["locked", "voice"] },
  ],
  moods: ["locked", "voice"],
  activeMoods: ["voice"],
  favourites: [],
};

beforeEach(() => {
  api().listGallery.mockReset().mockResolvedValue(result);
  useSettingsStore.setState({ packPath: "/packs/demo" });
  // Snapshot mood badges only count while a session runs.
  useAppStore.setState({ isRunning: true });
});

afterEach(() => useAppStore.setState({ isRunning: false }));

afterEach(cleanup);

describe("GalleryPanel", () => {
  it("lists every file with its mood tags and lock state", async () => {
    renderWithMantine(<GalleryPanel />);
    await waitFor(() => expect(screen.getByTestId("gallery-card-free.png")).toBeInTheDocument());

    expect(screen.getByTestId("gallery-card-locked.png")).toBeInTheDocument();
    expect(screen.getByTestId("gallery-card-voice.wav")).toBeInTheDocument();
    expect(screen.getByTestId("gallery-card-clip.mp4")).toBeInTheDocument();

    // Lock state badges: locked mood chip shows "locked", active one "active".
    expect(screen.getByTestId("gallery-chip-locked")).toHaveTextContent("locked");
    expect(screen.getByTestId("gallery-chip-voice")).toHaveTextContent("active");
    expect(screen.getByTestId("gallery-badge-clip.mp4-locked")).toHaveTextContent("locked");
    expect(screen.getByTestId("gallery-badge-clip.mp4-voice")).toHaveTextContent("voice");
  });

  it("filters by mood chip", async () => {
    renderWithMantine(<GalleryPanel />);
    await waitFor(() => expect(screen.getByTestId("gallery-card-free.png")).toBeInTheDocument());

    screen.getByTestId("gallery-mood-locked").click();
    await waitFor(() =>
      expect(screen.queryByTestId("gallery-card-free.png")).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("gallery-card-locked.png")).toBeInTheDocument();
    expect(screen.getByTestId("gallery-card-clip.mp4")).toBeInTheDocument();
    expect(screen.queryByTestId("gallery-card-voice.wav")).not.toBeInTheDocument();
  });

  it("filters to untagged default content", async () => {
    renderWithMantine(<GalleryPanel />);
    await waitFor(() => expect(screen.getByTestId("gallery-card-free.png")).toBeInTheDocument());

    screen.getByTestId("gallery-mood-default").click();
    await waitFor(() =>
      expect(screen.queryByTestId("gallery-card-locked.png")).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("gallery-card-free.png")).toBeInTheDocument();
  });

  it("shows the empty state for a pack without media", async () => {
    api().listGallery.mockResolvedValue({ entries: [], moods: [], activeMoods: [], favourites: [] });
    renderWithMantine(<GalleryPanel />);
    await waitFor(() =>
      expect(screen.getByText("The active pack ships no media files.")).toBeInTheDocument()
    );
  });

  it("reloads when the active pack changes", async () => {
    renderWithMantine(<GalleryPanel />);
    await waitFor(() => expect(api().listGallery).toHaveBeenCalledTimes(1));
    useSettingsStore.setState({ packPath: "/packs/other" });
    await waitFor(() => expect(api().listGallery).toHaveBeenCalledTimes(2));
  });
  it("stars a file through the bridge and filters to favourites", async () => {
    api().setFavourite.mockReset().mockResolvedValue(["img/free.png"]);
    renderWithMantine(<GalleryPanel />);
    await waitFor(() => expect(screen.getByTestId("gallery-card-free.png")).toBeInTheDocument());

    screen.getByTestId("gallery-star-free.png").click();
    await waitFor(() => expect(api().setFavourite).toHaveBeenCalledWith("img/free.png", true));

    screen.getByTestId("gallery-chip-favourites").click();
    await waitFor(() =>
      expect(screen.queryByTestId("gallery-card-locked.png")).not.toBeInTheDocument()
    );
    expect(screen.getByTestId("gallery-card-free.png")).toBeInTheDocument();
  });
});
