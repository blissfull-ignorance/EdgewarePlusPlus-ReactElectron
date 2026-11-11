import { useCallback, useEffect, useState } from "react";
import { Button, Group } from "@mantine/core";
import { IconPlayerPlay, IconPlayerStop } from "@tabler/icons-react";
import { useAppStore } from "../../stores/appStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { usePopupOverlayStore } from "../../stores/popupOverlayStore";
import { MetadataPanel } from "../../components/MetadataPanel/MetadataPanel";
import { ConfigSaveStatus } from "../../components/Config/ConfigSaveStatus";
import { ConfigPage } from "../../components/Config/ConfigPage";
import { ErrorBoundary } from "../../components/ErrorBoundary";
import { AppFrame, type MainView } from "../../components/shell/AppFrame";
import { GalleryPanel } from "../../features/gallery/GalleryPanel";
import { useRoll, type PopupType } from "../../hooks/useRoll";
import { usePopupLifecycle } from "../../hooks/usePopupLifecycle";
import { useMitosis, type MitosisSpawn } from "../../features/mitosis/useMitosis";
import { selectMedia, type SelectedMedia } from "../../features/popup/selectMedia";
import { SafewordModal } from "../../features/panic/SafewordModal";
import { collectCorruptionDangers, type DangerReport } from "../../features/corruption/danger";
import { CorruptionDangerModal } from "../../features/corruption/CorruptionDangerModal";
import { useCorruptionRuntime } from "../../hooks/useCorruptionRuntime";
import { useCorruptionStore } from "../../stores/corruptionStore";
import { useWallpaperRotation } from "../../hooks/useWallpaperRotation";
import { toKeyboardCode } from "../../../electron/utils/panicKeys";
import { useSchedule } from "../../hooks/useSchedule";
import { DEFAULT_HYPNO_ASSET } from "../../features/popup/resolveMediaUrl";
import { clearOpenPopups, canOpenPopup, registerOpenPopup } from "../../features/popup/openPopups";
import { roll } from "../../utils/roll";
import { logger } from "../../utils/logger";

export function MainAppPage() {
  const [view, setView] = useState<MainView>("status");
  const [configTab, setConfigTab] = useState("general");
  const [generalTab, setGeneralTab] = useState("start");
  const isRunning = useAppStore((s) => s.isRunning);
  const start = useAppStore((s) => s.start);
  const stop = useAppStore((s) => s.stop);
  const saveStatus = useSettingsStore((s) => s.saveStatus);
  const saveErrorMessage = useSettingsStore((s) => s.saveErrorMessage);

  const addInAppPopup = useCallback(
    (media: {
      mediaId: string;
      mediaType: "image" | "video" | "audio" | "prompt" | "caption";
      hypnoGif?: string;
    }) => {
      const id = usePopupOverlayStore.getState().addPopup({ type: media.mediaType, mediaId: media.mediaId, hypnoGif: media.hypnoGif });
      useAppStore.getState().incrementPopups();
      return id;
    },
    []
  );

  const { spawnPopup, closeAll } = usePopupLifecycle();

  const dispatchMedia = useCallback(
    async (media: SelectedMedia | null) => {
      if (!media || !useAppStore.getState().isRunning) return;
      // Web pops do not open a window: like the original app they just launch a
      // pack url in the system's default browser.
      if (media.mediaType === "web") {
        void window.api?.system.openExternal(media.url).catch(() => undefined);
        return;
      }
      const popType = media.mediaType === "audio-only" ? "audio" : media.mediaType;
      // Carries the pack file name, or (for prompt pops) the phrase text itself.
      let ref = media.mediaType === "prompt" ? media.text : media.mediaId;
      // Legacy booru integration: on image pops the downloader coin-flips a
      // Gelbooru fetch that replaces the pack image; any failure keeps the
      // pack media in place.
      if (popType === "image" && useSettingsStore.getState().downloadEnabled === 1) {
        try {
          const booruUrl = await window.api?.booru.fetchImage(useSettingsStore.getState().tagList);
          if (booruUrl) ref = booruUrl;
        } catch (err) {
          logger.error("[MainAppPage] Booru fetch failed, using pack media:", err);
        }
      }
      // A spiral overlay may ride on top of an image/video pop, independently rolled
      // so it actually sits over the media rather than competing for a spawn slot.
      // Packs without a hypno/ dir still get the built-in default spiral (legacy behaviour).
      let hypnoGif: string | undefined;
      if ((popType === "image" || popType === "video") && roll(useSettingsStore.getState().subliminalsChance)) {
        try {
          hypnoGif = (await window.api?.pack.randomHypnoGif()) ?? DEFAULT_HYPNO_ASSET;
        } catch (err) {
          logger.error("[MainAppPage] Failed to pick hypno overlay:", err);
        }
      }
      const limits = useSettingsStore.getState();
      if (!canOpenPopup(popType, limits)) {
        logger.warn(`[MainAppPage] ${popType} pop refused: concurrency cap (${limits.maxAudio}/${limits.maxVideos}) reached`);
        return;
      }

      let id: string | null = null;
      if (limits.popupRenderMode === "electron") {
        id = await spawnPopup(popType, ref, hypnoGif);
      } else {
        id = addInAppPopup({ mediaId: ref, mediaType: popType, hypnoGif });
      }
      if (id) registerOpenPopup(id, popType);
    },
    [spawnPopup, addInAppPopup]
  );

  const spawnTextPopup = useCallback(async () => {
    if (!useAppStore.getState().isRunning) return;
    let text: string | null = null;
    try {
      text = (await window.api?.pack.randomSubliminalText()) ?? null;
    } catch (err) {
      logger.error("[MainAppPage] Failed to pick subliminal text:", err);
      return;
    }
    if (!text) {
      logger.warn("[MainAppPage] caption pop skipped: pack defines no subliminal or caption text");
      return;
    }
    const limits = useSettingsStore.getState();
    const id =
      limits.popupRenderMode === "electron"
        ? await spawnPopup("subliminal", text)
        : addInAppPopup({ mediaId: text, mediaType: "caption" });
    if (id) registerOpenPopup(id, "caption");
  }, [spawnPopup, addInAppPopup]);

  const spawnNotification = useCallback(async () => {
    if (!useAppStore.getState().isRunning) return;
    try {
      const text = (await window.api?.pack.randomNotificationText()) ?? null;
      if (!text) {
        logger.warn("[MainAppPage] notification skipped: pack defines no notification or caption text");
        return;
      }
      const s = useSettingsStore.getState();
      const info = (await window.api?.pack.loadInfo()) as { name?: string } | null;
      const title = info?.name || "Edgeware++";
      let attachment: string | undefined;
      if (roll(s.notificationImageChance) && s.packPath) {
        const img = (await window.api?.pack.randomImage()) ?? null;
        if (img) attachment = `${String(s.packPath).replace(/\/+$/, "")}/img/${img}`;
      }
      await window.api?.system.sendNotification(title, text, attachment);
    } catch (err) {
      logger.error("[MainAppPage] notification failed:", err);
    }
  }, []);

  const onSpawn = useCallback(
    (type: PopupType) => {
      // The legacy subliminal popup carries text, not media: it bypasses
      // media selection and the per-type media caps entirely.
      if (type === "caption") {
        void spawnTextPopup();
        return;
      }
      if (type === "notification") {
        void spawnNotification();
        return;
      }
      selectMedia(type)
        .then(dispatchMedia)
        .catch((err) => logger.error("[MainAppPage] Failed to select popup media:", err));
    },
    [dispatchMedia, spawnTextPopup, spawnNotification]
  );

  useRoll({ onSpawn });

  const onMitosisSpawns = useCallback(
    (spawns: MitosisSpawn[]) => {
      for (const spawn of spawns) {
        selectMedia(spawn.type)
          .then(dispatchMedia)
          .catch((err) => logger.error("[MainAppPage] Mitosis media selection failed:", err));
      }
    },
    [dispatchMedia]
  );

  useMitosis({ onSpawn: onMitosisSpawns });

  const handleStop = useCallback(() => {
    stop();
    usePopupOverlayStore.getState().clearAll();
    clearOpenPopups();
    // Kill the Lua session before closing popups: a live session would react
    // to the closes (on_stop chains) and keep spawning after "Stop".
    void window.api?.scripting.stop().catch(() => undefined);
    void closeAll();
  }, [stop, closeAll]);

  const openPackManager = useCallback(() => {
    setConfigTab("general");
    setGeneralTab("packs");
    setView("config");
  }, []);

  const [safewordOpen, setSafewordOpen] = useState(false);
  useEffect(() => {
    const unsubscribe = window.api?.panic.onBlocked(() => setSafewordOpen(true));
    return () => unsubscribe?.();
  }, []);

  const [dangerReport, setDangerReport] = useState<DangerReport | null>(null);

  // Legacy panic_key: an in-window panic hotkey (needs app focus), separate
  // from the globalPanicButton system hotkey handled in the main process.
  const panicButton = useSettingsStore((s) => s.panicButton);
  useEffect(() => {
    const code = toKeyboardCode(panicButton);
    if (!code) return;
    const onKey = (e: Event) => {
      const ke = e as { code?: string; target?: unknown };
      if (ke.code !== code) return;
      const t = ke.target as { tagName?: string; isContentEditable?: boolean } | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable === true)) {
        return;
      }
      void window.api?.panic.trigger();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panicButton]);

  useCorruptionRuntime(isRunning);
  useWallpaperRotation(isRunning);

  // Legacy run_script: a pack that ships script.lua drives its own scripted
  // corruption session; start it with the runtime.
  const startRuntime = useCallback(() => {
    if (useAppStore.getState().isRunning) return;
    start();
    void (async () => {
      try {
        if (await window.api?.pack.hasScript()) {
          // A Stop during the await above must not be undone by the script:
          // IPC is FIFO per window, so skipping the call here (or ordering it
          // before any later stop) keeps the session dead.
          if (!useAppStore.getState().isRunning) return;
          const ok = await window.api?.scripting.runLua("script.lua");
          if (!ok) logger.warn("[MainAppPage] pack script.lua did not run");
        }
      } catch (err) {
        logger.error("[MainAppPage] pack script failed:", err);
      }
    })();
  }, [start]);

  // Mirror the corruption moods into the main process so pack content
  // resolvers gate mood-tagged media and text (legacy active-mood pools).
  const activeMoods = useCorruptionStore((s) => s.activeMoods);
  useEffect(() => {
    void window.api?.pack.setActiveMoods(activeMoods).catch(() => undefined);
  }, [activeMoods]);

  // Legacy corruption_danger_check: full-permission corruption must disclose
  // the dangerous settings the pack can flip before the runtime starts. The
  // audit reads the pack's raw corruption.json so even blocked keys surface.
  const handleStart = useCallback(() => {
    if (useAppStore.getState().isRunning) return;
    const s = useSettingsStore.getState();
    if (s.showDiscord === 1) {
      void window.api?.pack
        .discord()
        .then((d) => {
          if (d) void window.api?.system.setDiscordPresence(d.text, d.image ?? "");
        })
        .catch((err) => logger.warn("[MainAppPage] Discord presence failed:", err));
    }
    if (s.corruptionMode === 1 && s.corruptionFullPerm === 1) {
      void window.api?.pack
        .loadCorruption()
        .then((raw) => {
          const configMaps = Object.values(
            (raw?.config ?? {}) as Record<string, Record<string, unknown>>
          );
          const report = collectCorruptionDangers(configMaps);
          if (report.count > 0) {
            setDangerReport(report);
            return;
          }
          startRuntime();
        })
        .catch((err) => {
          logger.error("[MainAppPage] corruption danger check failed:", err);
          startRuntime();
        });
      return;
    }
    startRuntime();
  }, [startRuntime]);

  // Scheduled sessions take the same path as the Start button (danger
  // disclosure + pack script), not a bare store start.
  useSchedule(isRunning, handleStart);

  return (
    <>
    <AppFrame
      view={view}
      onViewChange={setView}
      actions={
        <Group gap="sm" align="center" wrap="nowrap">
          <ConfigSaveStatus status={saveStatus} errorMessage={saveErrorMessage ?? undefined} />
          <Button
            data-testid="start-stop-button"
            leftSection={isRunning ? <IconPlayerStop size={16} /> : <IconPlayerPlay size={16} />}
            variant="filled"
            color={isRunning ? "red" : undefined}
            fw={600}
            onClick={isRunning ? handleStop : handleStart}
          >
            {isRunning ? "Stop" : "Start"}
          </Button>
        </Group>
      }
    >
      {view === "status" ? (
        <MetadataPanel onOpenPackManager={openPackManager} />
      ) : view === "gallery" ? (
        <ErrorBoundary fallbackTitle="Gallery Error">
          <GalleryPanel />
        </ErrorBoundary>
      ) : (
        <ErrorBoundary fallbackTitle="Settings Error">
          <ConfigPage
            tab={configTab}
            onTabChange={setConfigTab}
            generalTab={generalTab}
            onGeneralTabChange={setGeneralTab}
          />
        </ErrorBoundary>
      )}
      </AppFrame>
      <SafewordModal opened={safewordOpen} onClose={() => setSafewordOpen(false)} />
      <CorruptionDangerModal
        opened={dangerReport !== null}
        report={dangerReport}
        onProceed={() => {
          setDangerReport(null);
          startRuntime();
        }}
        onCancel={() => setDangerReport(null)}
      />
    </>
  );
}
