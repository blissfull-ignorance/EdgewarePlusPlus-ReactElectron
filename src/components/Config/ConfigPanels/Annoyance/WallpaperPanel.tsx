import { SimpleGrid } from "@mantine/core";
import { IconDeviceDesktop } from "@tabler/icons-react";
import { ConfigSlider, ConfigToggle } from "../../../Config";
import { useSettingsStore } from "../../../../stores";
import { SectionCard } from "../../../SectionCard";

export function WallpaperPanel() {
  const setRaw = useSettingsStore((s) => s.setRaw);
  const rotateWallpaper = useSettingsStore((s) => s.rotateWallpaper);
  const wallpaperTimer = useSettingsStore((s) => s.wallpaperTimer);
  const wallpaperVariance = useSettingsStore((s) => s.wallpaperVariance);

  return (
    <SectionCard
      icon={<IconDeviceDesktop size={16} />}
      title="Wallpaper Settings"
      description="Desktop wallpaper rotation."
    >
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" verticalSpacing="lg">
        <ConfigToggle
          label="Rotate Wallpaper"
          value={rotateWallpaper}
          onChange={(val) => setRaw({ rotateWallpaper: val })}
          description="Automatically change the desktop wallpaper while running. Corruption packs cannot override this."
        />

        <ConfigSlider
          label="Wallpaper Timer"
          value={wallpaperTimer}
          onChange={(val) => setRaw({ wallpaperTimer: val })}
          min={0}
          max={86400000}
          step={1000}
          description="Interval between wallpaper changes (ms)"
        />

        <ConfigSlider
          label="Wallpaper Variance"
          value={wallpaperVariance}
          onChange={(val) => setRaw({ wallpaperVariance: val })}
          min={0}
          max={86400000}
          step={1000}
          description="Random variance in timer (ms)"
        />
      </SimpleGrid>
    </SectionCard>
  );
}
