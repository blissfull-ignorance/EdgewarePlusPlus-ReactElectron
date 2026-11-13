import { useEffect, useState, type ReactNode } from "react";
import { Group, Title, Badge, Text, UnstyledButton } from "@mantine/core";
import { IconLayoutDashboard, IconSettings, IconPhoto, IconWand } from "@tabler/icons-react";
import defaultAppIcon from "../../assets/app_icon.png";
import { useSettingsStore } from "../../stores/settingsStore";

export type MainView = "status" | "config" | "gallery" | "creator";

interface NavItemProps {
  active: boolean;
  label: string;
  icon: ReactNode;
  testId: string;
  onClick: () => void;
}

function NavItem({ active, label, icon, testId, onClick }: NavItemProps) {
  return (
    <UnstyledButton
      data-testid={testId}
      data-active={active ? "true" : undefined}
      className={`ewpp-nav-item${active ? " ewpp-nav-item-active" : ""}`}
      onClick={onClick}
    >
      {icon}
      <span>{label}</span>
    </UnstyledButton>
  );
}

interface AppFrameProps {
  view: MainView;
  onViewChange: (view: MainView) => void;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppFrame({ view, onViewChange, actions, children }: AppFrameProps) {
  const [appIcon, setAppIcon] = useState<string | null>(null);
  const packPath = useSettingsStore((s) => s.packPath);

  // The pack owns the header logo and the window/dock icon; both follow the
  // active pack, including switches made while the app runs.
  useEffect(() => {
    let alive = true;
    void window.api?.pack
      .iconImage()
      .then((url) => {
        if (alive && url) setAppIcon(url);
      })
      .catch(() => undefined);
    void window.api?.pack.refreshAppIcon().catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [packPath]);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <header
        style={{
          flexShrink: 0,
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: "0 20px",
          backgroundColor: "var(--mantine-color-dark-8)",
          borderBottom: "1px solid var(--mantine-color-dark-5)",
          position: "relative",
          // Keep the top toolbar (incl. Start/Stop) above in-app popups (zIndex 1100),
          // so a popup overlapping the header can never trap the user unable to Stop.
          zIndex: 1200,
        }}
      >
        <Group gap="sm" align="center" wrap="nowrap">
          <img
            src={appIcon ? `data:${appIcon}` : defaultAppIcon}
            alt=""
            data-testid="app-icon"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              objectFit: "contain",
              display: "block",
              flexShrink: 0,
            }}
          />
          <Title order={1} data-testid="app-title" style={{ lineHeight: 1.1 }}>
            Edgeware++
          </Title>
          <Badge variant="subtle" size="sm" fw={500} style={{ marginLeft: 2 }}>
            cross-platform
          </Badge>
        </Group>
        {actions}
      </header>

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        <nav
          data-testid="main-tabs"
          aria-label="Main navigation"
          style={{
            flexShrink: 0,
            width: 212,
            display: "flex",
            flexDirection: "column",
            gap: 4,
            padding: 12,
            backgroundColor: "var(--mantine-color-dark-8)",
            borderRight: "1px solid var(--mantine-color-dark-5)",
          }}
        >
          <NavItem
            active={view === "status"}
            label="Status"
            icon={<IconLayoutDashboard size={18} />}
            testId="main-tab-status"
            onClick={() => onViewChange("status")}
          />
          <NavItem
            active={view === "config"}
            label="Config"
            icon={<IconSettings size={18} />}
            testId="main-tab-config"
            onClick={() => onViewChange("config")}
          />
          <NavItem
            active={view === "gallery"}
            label="Gallery"
            icon={<IconPhoto size={18} />}
            testId="main-tab-gallery"
            onClick={() => onViewChange("gallery")}
          />
          <NavItem
            active={view === "creator"}
            label="Creator"
            icon={<IconWand size={18} />}
            testId="main-tab-creator"
            onClick={() => onViewChange("creator")}
          />
          <div style={{ marginTop: "auto", padding: "0 4px" }}>
            <Text size="xs" c="dimmed">
              Settings autosave in the background.
            </Text>
          </div>
        </nav>

        <main
          data-testid="app-content"
          style={{
            flex: 1,
            minWidth: 0,
            overflowY: "auto",
            overflowX: "hidden",
            padding: 24,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
