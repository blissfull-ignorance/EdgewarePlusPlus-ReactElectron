import { SimpleGrid } from "@mantine/core";
import { IconDownload } from "@tabler/icons-react";
import { ConfigField, ConfigToggle } from "../../../Config";
import { useSettingsStore } from "../../../../stores";
import { SectionCard } from "../../../SectionCard";

export function BooruPanel() {
  const setRaw = useSettingsStore((s) => s.setRaw);
  const downloadEnabled = useSettingsStore((s) => s.downloadEnabled);
  const tagList = useSettingsStore((s) => s.tagList);

  return (
    <SectionCard
      icon={<IconDownload size={16} />}
      title="Booru Download Settings"
      description="Pull extra media from Gelbooru."
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
        <ConfigToggle
          label="Download Enabled"
          value={downloadEnabled}
          onChange={(val) => setRaw({ downloadEnabled: val })}
          description="Enable downloading images from Gelbooru"
        />

        <ConfigField
          label="Tag List"
          value={tagList}
          onChange={(val) => setRaw({ tagList: val })}
          description="Comma-separated list of tags for image download"
        />
      </SimpleGrid>
    </SectionCard>
  );
}
