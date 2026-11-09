import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

/**
 * Playback state — audio/video queue, current file, volume, progress.
 */

export interface PlaybackState {
  playingFiles: string[];
  queue: string[];
  currentFile: string | null;
  currentTime: number;
  volume: number;

  playFile: (file: string) => void;
  queueFile: (file: string) => void;
  dequeueNext: () => void;
  updateProgress: (currentTime: number) => void;
  setVolume: (volume: number) => void;
  stopAll: () => void;
  clearQueue: () => void;
}

export const usePlaybackStore = create<PlaybackState>()(
  devtools(
    persist(
      (set, get) => ({
        playingFiles: [],
        queue: [],
        currentFile: null,
        currentTime: 0,
        volume: 0.75,

        playFile: (file: string) =>
          set(() => ({
            playingFiles: [file],
            currentFile: file,
            currentTime: 0,
          })),

        queueFile: (file: string) =>
          set((s) => ({ queue: [...s.queue, file] })),

        dequeueNext: () => {
          const { queue } = get();
          if (queue.length === 0) return;
          const next = queue[0];
          set({ queue: queue.slice(1), playingFiles: [next], currentFile: next, currentTime: 0 });
        },

        updateProgress: (currentTime: number) => set({ currentTime }),

        setVolume: (volume: number) => set({ volume }),

        stopAll: () =>
          set({
            playingFiles: [],
            currentFile: null,
            currentTime: 0,
          }),

        clearQueue: () => set({ queue: [] }),
      }),
      { name: "edgeware-playback" }
    ),
    { name: "PlaybackStore" }
  )
);