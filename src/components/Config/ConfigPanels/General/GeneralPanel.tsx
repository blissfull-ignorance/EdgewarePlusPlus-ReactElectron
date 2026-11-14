import { useCallback, useState } from "react";
import type { FileRejection, FileWithPath } from "@mantine/dropzone";
import { Stack, Tabs, Text } from "@mantine/core";
import {
  IconAlertCircle,
  IconCircleCheck,
  IconFileStack,
  IconInfoCircle,
  IconPackage,
  IconPlayerPlay,
  type Icon,
} from "@tabler/icons-react";
import { StartPanel } from "./StartPanel";
import { InfoPanel } from "./InfoPanel";
import { PresetsPanel } from "./PresetsPanel";
import { PackList } from "../../PackList";
import { PackImport } from "../../PackImport";
import { useSettingsStore } from "../../../../stores";
import { usePackDiscovery } from "../../../../hooks/usePackDiscovery";
import { lastSegment } from "../../../../utils/packPath";
import { showToast, updateToast } from "../../../../features/notifications/toastStore";

const GENERAL_TABS: { value: string; label: string; icon: Icon }[] = [
  { value: "start", label: "Start", icon: IconPlayerPlay },
  { value: "info", label: "Pack Info", icon: IconInfoCircle },
  { value: "packs", label: "Pack Management", icon: IconPackage },
  { value: "presets", label: "Presets", icon: IconFileStack },
];

export interface GeneralPanelProps {
  tab?: string;
  onTabChange?: (tab: string) => void;
}

export function GeneralPanel({ tab = "start", onTabChange }: GeneralPanelProps) {
  const packs = usePackDiscovery((s) => s.packs);
  const refreshPacks = usePackDiscovery((s) => s.refreshPacks);
  const packPath = useSettingsStore((s) => s.packPath);
  const setRaw = useSettingsStore((s) => s.setRaw);
  const save = useSettingsStore((s) => s.save);

  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [folderWarning, setFolderWarning] = useState<string | null>(null);

  const handleSelectPack = useCallback(
    async (path: string) => {
      try {
        setRaw({ packPath: path });
        await save();
        showToast({
          id: "pack-selected",
          title: `Now using ${lastSegment(path)}`,
          color: "teal",
          icon: <IconCircleCheck size={18} />,
          duration: 2500,
        });
      } catch (err) {
        showToast({
          id: "pack-select-error",
          title: "Couldn't switch pack",
          description: err instanceof Error ? err.message : "Unknown error",
          color: "red",
          icon: <IconAlertCircle size={18} />,
          duration: 6000,
        });
      }
    },
    [setRaw, save]
  );

  const runImport = useCallback(
    async (filePath: string) => {
      setImporting(true);
      setImportError(null);
      setFolderWarning(null);
      setImportProgress(null);

      const importId = showToast({
        id: "pack-import",
        title: "Importing pack…",
        loading: true,
        color: "blue",
        duration: 0,
      });

      const unsubscribe = window.api.system.onImportProgress((progress) => {
        if (progress.total > 0) {
          setImportProgress(Math.min(100, Math.round((100 * progress.done) / progress.total)));
        }
      });

      try {
        const imported = await window.api.system.importPack(filePath);
        await refreshPacks();
        setRaw({ packPath: imported.path });
        await save();
        updateToast(importId, {
          loading: false,
          duration: 6000,
          color: "teal",
          icon: <IconCircleCheck size={18} />,
          title: `Imported ${imported.name}`,
          description: "Selected as the active pack.",
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setImportError(message);
        updateToast(importId, {
          loading: false,
          duration: 10000,
          color: "red",
          icon: <IconAlertCircle size={18} />,
          title: "Import failed",
          description: message,
        });
      } finally {
        unsubscribe();
        setImporting(false);
        setImportProgress(null);
      }
    },
    [refreshPacks, setRaw, save]
  );

  const handleDroppedFile = useCallback(
    async (file: File | FileWithPath) => {
      if (!file.name.toLowerCase().endsWith(".zip") && file.type !== "application/zip") {
        const message = "Only .zip files can be imported.";
        setImportError(message);
        showToast({
          id: "pack-import-error",
          title: "Import failed",
          description: message,
          color: "red",
          icon: <IconAlertCircle size={18} />,
          duration: 8000,
        });
        return;
      }      const filePath = window.api.system.getPathForFile(file as File);
      if (!filePath) {
        const message =
          "Could not resolve the file path for the dropped file. Use “Import from file…” to pick a zip from disk instead.";
        setImportError(message);
        showToast({
          id: "pack-import-error",
          title: "Import failed",
          description: message,
          color: "red",
          icon: <IconAlertCircle size={18} />,
          duration: 10000,
        });
        return;
      }
      await runImport(filePath);
    },
    [runImport]
  );

  // The dropzone's accept filter routes non-zip drops to onReject, so the
  // visible refusal must live here too — otherwise a bad drop is a silent
  // no-op with only a momentary icon flicker.
  const handleRejectedDrop = useCallback(
    (rejections: FileRejection[]) => {
      const first = rejections[0];
      if (!first) return;
      const tooLarge = first.errors.some((e) => e.code === "file-too-large");
      const message = tooLarge
        ? "Pack zips must be smaller than 500 MB."
        : "Only .zip files can be imported.";
      setImportError(message);
      showToast({
        id: "pack-import-error",
        title: "Import failed",
        description: message,
        color: "red",
        icon: <IconAlertCircle size={18} />,
        duration: 8000,
      });
    },
    []
  );

  const handleImportFromDisk = useCallback(async () => {
    let result: { cancelled: boolean; filePaths: string[] };
    try {
      result = await window.api.system.selectZip();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setImportError(message);
      showToast({
        id: "pack-import-error",
        title: "Import failed",
        description: `The file picker could not be opened (${message})`,
        color: "red",
        icon: <IconAlertCircle size={18} />,
        duration: 10000,
      });
      return;
    }
    if (result.cancelled) return;
    const first = result.filePaths[0];
    if (!first) {
      const message = "No file was selected.";
      setImportError(message);
      showToast({
        id: "pack-import-error",
        title: "Import failed",
        description: message,
        color: "red",
        icon: <IconAlertCircle size={18} />,
        duration: 8000,
      });
      return;
    }
    await runImport(first);
  }, [runImport]);

  const handleAddFolder = useCallback(async () => {
    setFolderWarning(null);
    let result: { cancelled: boolean; folderPath?: string };
    try {
      result = await window.api.system.selectPackFolder();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setFolderWarning(message);
      showToast({
        id: "pack-folder-error",
        title: "Could not add pack folder",
        description: `The folder picker could not be opened (${message})`,
        color: "red",
        icon: <IconAlertCircle size={18} />,
        duration: 10000,
      });
      return;
    }
    if (result.cancelled || !result.folderPath) return;

    let check: {
      ok: boolean;
      error?: string;
      warning?: string;
      name?: string;
      version?: string;
      creator?: string;
    };
    try {
      check = await window.api.system.validatePackFolder(result.folderPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setFolderWarning(message);
      showToast({
        id: "pack-folder-error",
        title: "Could not add pack folder",
        description: message,
        color: "red",
        icon: <IconAlertCircle size={18} />,
        duration: 10000,
      });
      return;
    }
    if (!check.ok) {
      const message = check.error ?? "That folder could not be added.";
      setFolderWarning(message);
      showToast({
        id: "pack-folder-error",
        title: "Could not add pack folder",
        description: message,
        color: "red",
        icon: <IconAlertCircle size={18} />,
        duration: 10000,
      });
      return;
    }

    const current = useSettingsStore.getState().packFolders ?? [];
    setRaw({ packFolders: [...new Set([...current, result.folderPath])] });
    await save();
    await refreshPacks();

    const displayName = check.name ?? lastSegment(result.folderPath);
    if (check.warning) {
      showToast({
        id: "pack-folder-added",
        title: `Added ${displayName}`,
        description: check.warning,
        color: "yellow",
        icon: <IconAlertCircle size={18} />,
        duration: 12000,
      });
    } else {
      showToast({
        id: "pack-folder-added",
        title: `Added ${displayName}`,
        color: "teal",
        icon: <IconCircleCheck size={18} />,
        duration: 4000,
      });
    }
  }, [setRaw, save, refreshPacks]);

  const handleInitPack = useCallback(async () => {
    setFolderWarning(null);
    let picked: { cancelled: boolean; folderPath?: string };
    try {
      picked = await window.api.system.selectPackInitFolder();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setFolderWarning(message);
      showToast({
        id: "pack-init-error",
        title: "Could not open the folder picker",
        description: message,
        color: "red",
        icon: <IconAlertCircle size={18} />,
        duration: 10000,
      });
      return;
    }
    if (picked.cancelled || !picked.folderPath) return;
    const init = await window.api.pack.initPack(picked.folderPath);
    if (!init.ok || !init.path) {
      const message = init.error ?? "That folder could not be initialized.";
      setFolderWarning(message);
      showToast({
        id: "pack-init-error",
        title: "Could not initialize the pack",
        description: message,
        color: "red",
        icon: <IconAlertCircle size={18} />,
        duration: 10000,
      });
      return;
    }
    const current = useSettingsStore.getState().packFolders ?? [];
    setRaw({ packFolders: [...new Set([...current, init.path])], packPath: init.path });
    await save();
    await refreshPacks();
    showToast({
      id: "pack-init-done",
      title: `Created ${lastSegment(init.path)}`,
      description: "The empty pack is selected. Add media files and design it in Mood tagging and Script designer.",
      color: "teal",
      icon: <IconCircleCheck size={18} />,
      duration: 8000,
    });
  }, [setRaw, save, refreshPacks]);

  const handleOpenLibrary = useCallback(async () => {
    await window.api.system.openPackLibrary();
  }, []);

  return (
    <Stack gap="md">
      <Text size="lg" fw={700}>
        General Settings
      </Text>

      <Tabs value={tab} onChange={(value) => onTabChange?.(value ?? tab)}>
        <Tabs.List mb="md">
          {GENERAL_TABS.map(({ value, label, icon: TabIcon }) => (
            <Tabs.Tab key={value} value={value} leftSection={<TabIcon size={15} />}>
              {label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value="start" pt={0}>
          <StartPanel />
        </Tabs.Panel>

        <Tabs.Panel value="info" pt={0}>
          <InfoPanel />
        </Tabs.Panel>

        <Tabs.Panel value="packs" pt={0}>
          <Stack gap="md">
            <PackImport
              onDrop={handleDroppedFile}
              onReject={handleRejectedDrop}
              onImportFromDisk={() => void handleImportFromDisk()}
              onAddFolder={() => void handleAddFolder()}
              onInitPack={() => void handleInitPack()}
              importing={importing}
              progress={importProgress}
              error={importError}
              warning={folderWarning}
            />
            <PackList
              packs={packs}
              currentPackPath={packPath ?? undefined}
              onSelectPack={handleSelectPack}
              onOpenLibrary={() => void handleOpenLibrary()}
            />
          </Stack>
        </Tabs.Panel>

        <Tabs.Panel value="presets" pt={0}>
          <PresetsPanel />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}
