import { IconDownload } from "@tabler/icons-react";
import { ConfigToggle } from "../../../Config";
import { useSettingsStore } from "../../../../stores";
import { SectionCard } from "../../../SectionCard";

export function BooruPanel() {
  const downloadEnabled = useSettingsStore((s) => s.downloadEnabled);

  return (
    <SectionCard
      icon={<IconDownload size={16} />}
      title="Booru Download Settings"
      description="Deprecated. Gelbooru now requires an API key on every request, so the downloader was removed."
    >
      <ConfigToggle
        label="Download Enabled"
        value={downloadEnabled}
        onChange={() => {}}
        blocked
        disabled
        description="No longer available. Kept only so old settings files load unchanged."
      />
    </SectionCard>
  );
}
