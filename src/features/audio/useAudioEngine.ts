import { useEffect, useRef, useCallback } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import { usePlaybackStore } from "../../stores/playbackStore";
import { computeFadeInSteps, computeFadeOutSteps } from "../../utils/leet";

export interface AudioPlayer {
  id: string;
  file: string;
  element: HTMLAudioElement;
  currentVolume: number;
}

export function useAudioEngine() {
  const maxAudio = useSettingsStore((s) => s.maxAudio);
  const audioVolume = useSettingsStore((s) => s.audioVolume / 100);
  const fadeInDuration = useSettingsStore((s) => s.fadeInDuration);
  const fadeOutDuration = useSettingsStore((s) => s.fadeOutDuration);
  const playingFiles = usePlaybackStore((s) => s.playingFiles);
  const playFile = usePlaybackStore((s) => s.playFile);
  const stopAll = usePlaybackStore((s) => s.stopAll);

  const playersRef = useRef<AudioPlayer[]>([]);
  const fadeIntervalsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const cleanup = useCallback((id: string) => {
    const interval = fadeIntervalsRef.current.get(id);
    if (interval) {
      clearInterval(interval);
      fadeIntervalsRef.current.delete(id);
    }
    const idx = playersRef.current.findIndex((p) => p.id === id);
    if (idx >= 0) {
      const player = playersRef.current[idx];
      player.element.pause();
      player.element.src = "";
      player.element.remove();
      playersRef.current.splice(idx, 1);
    }
  }, []);

  const fadeIn = useCallback(
    (id: string) => {
      const player = playersRef.current.find((p) => p.id === id);
      if (!player) return;

      const steps = computeFadeInSteps(fadeInDuration, audioVolume);
      let stepIndex = 0;

      const interval = setInterval(() => {
        if (stepIndex >= steps.length) {
          clearInterval(interval);
          fadeIntervalsRef.current.delete(id);
          return;
        }
        player.element.volume = steps[stepIndex];
        player.currentVolume = steps[stepIndex];
        stepIndex++;
      }, 1000 / 60);

      fadeIntervalsRef.current.set(id, interval);
    },
    [fadeInDuration, audioVolume]
  );

  const fadeOut = useCallback(
    (id: string) => {
      const player = playersRef.current.find((p) => p.id === id);
      if (!player) return;

      const steps = computeFadeOutSteps(fadeOutDuration, player.currentVolume);
      let stepIndex = 0;

      const interval = setInterval(() => {
        if (stepIndex >= steps.length) {
          clearInterval(interval);
          fadeIntervalsRef.current.delete(id);
          cleanup(id);
          return;
        }
        player.element.volume = steps[stepIndex];
        player.currentVolume = steps[stepIndex];
        stepIndex++;
      }, 1000 / 60);

      fadeIntervalsRef.current.set(id, interval);
    },
    [fadeOutDuration, cleanup]
  );

  const playAudio = useCallback(
    (file: string): boolean => {
      if (playersRef.current.length >= maxAudio) {
        return false;
      }

      const id = `audio-${Date.now()}-${Math.random()}`;
      const audio = new Audio(file);
      audio.volume = 0;

      const player: AudioPlayer = { id, file, element: audio, currentVolume: 0 };
      playersRef.current.push(player);
      playFile(file);

      audio.play().catch(() => {
        cleanup(id);
      });

      fadeIn(id);
      return true;
    },
    [maxAudio, playFile, fadeIn, cleanup]
  );

  const stopAudio = useCallback(
    (id: string) => {
      fadeOut(id);
    },
    [fadeOut]
  );

  const stopAllAudio = useCallback(() => {
    const ids = playersRef.current.map((p) => p.id);
    for (const id of ids) {
      fadeOut(id);
    }
    stopAll();
  }, [fadeOut, stopAll]);

  useEffect(() => {
    const staleFiles = playersRef.current
      .filter((p) => !playingFiles.includes(p.file))
      .map((p) => p.id);
    for (const id of staleFiles) {
      cleanup(id);
    }
  }, [playingFiles, cleanup]);

  useEffect(() => {
    return () => {
      for (const [id, interval] of fadeIntervalsRef.current) {
        clearInterval(interval);
        const player = playersRef.current.find((p) => p.id === id);
        if (player) {
          player.element.pause();
          player.element.remove();
        }
      }
      playersRef.current = [];
      fadeIntervalsRef.current.clear();
    };
  }, []);

  return {
    playAudio,
    stopAudio,
    stopAllAudio,
    activePlayersCount: playersRef.current.length,
  };
}
