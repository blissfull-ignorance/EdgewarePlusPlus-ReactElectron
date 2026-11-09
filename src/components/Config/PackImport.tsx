import { useCallback } from "react";
import type { FileWithPath } from "@mantine/dropzone";
import { Dropzone } from "@mantine/dropzone";
import { Alert, Button, Group, Progress, Text } from "@mantine/core";
import {
  IconAlertCircle,
  IconFileZip,
  IconFolderPlus,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { SectionCard } from "../SectionCard";

interface PackImportProps {
  onDrop: (file: File | FileWithPath) => Promise<void>;
  onImportFromDisk: () => void;
  onAddFolder: () => void;
  importing: boolean;
  progress: number | null;
  error: string | null;
  warning: string | null;
}

const PackImport = ({
  onDrop,
  onImportFromDisk,
  onAddFolder,
  importing,
  progress,
  error,
  warning,
}: PackImportProps) => {
  const handleDrop = useCallback(
    async (files: FileWithPath[]) => {
      if (files.length === 0) return;
      await onDrop(files[0]);
    },
    [onDrop]
  );

  return (
    <SectionCard
      icon={<IconFileZip size={16} />}
      title="Import New Pack"
      description="Drop a pack zip into the library, or pick one from disk."
    >
      <Dropzone
        onDrop={handleDrop}
        maxSize={500 * 1024 * 1024}
        accept={["application/zip", ".zip"]}
        disabled={importing}
        className="ewpp-dropzone"
        radius="md"
        data-testid="pack-dropzone"
        styles={{ inner: { minHeight: 120, padding: "16px" } }}
      >
        <Group justify="center" gap="lg" wrap="wrap" style={{ minHeight: 72 }}>
          <Dropzone.Accept>
            <IconX size={40} stroke={1.4} color="var(--mantine-color-red-5)" />
          </Dropzone.Accept>
          <Dropzone.Reject>
            <IconX size={40} stroke={1.4} color="var(--mantine-color-red-5)" />
          </Dropzone.Reject>
          <Dropzone.Idle>
            <IconUpload size={40} stroke={1.4} color="var(--mantine-primary-color-filled)" />
          </Dropzone.Idle>

          <div>
            <Text size="md" fw={600}>
              Drag and drop .zip file here
            </Text>
            <Text size="xs" c="dimmed" mt={2}>
              or use a button below
            </Text>
          </div>
        </Group>

        {importing ? (
          <Group
            justify="center"
            gap="sm"
            mt="xs"
            align="center"
            wrap="nowrap"
            style={{ width: "100%", padding: "0 12px" }}
          >
            <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
              Extracting pack…
            </Text>
            <Progress
              value={progress ?? 0}
              data-testid="pack-import-progress"
              style={{ flex: 1, minWidth: 80 }}
            />
            {progress !== null ? (
              <Text size="sm" c="dimmed" style={{ flexShrink: 0 }}>
                {progress}%
              </Text>
            ) : null}
          </Group>
        ) : null}
      </Dropzone>

      <Group mt="sm" wrap="wrap" gap="sm">
        <Button
          leftSection={<IconFileZip size={15} />}
          onClick={onImportFromDisk}
          disabled={importing}
          fw={600}
          data-testid="pack-import-zip-button"
        >
          Import from file…
        </Button>
        <Button
          variant="default"
          leftSection={<IconFolderPlus size={15} />}
          onClick={onAddFolder}
          disabled={importing}
          data-testid="pack-add-folder-button"
        >
          Add existing pack folder…
        </Button>
      </Group>

      {error ? (
        <Alert color="red" mt="sm" icon={<IconAlertCircle size={16} />} data-testid="pack-import-error">
          {error}
        </Alert>
      ) : null}

      {warning ? (
        <Alert color="yellow" mt="sm" icon={<IconAlertCircle size={16} />} data-testid="pack-folder-warning">
          {warning}
        </Alert>
      ) : null}
    </SectionCard>
  );
};

export { PackImport };
