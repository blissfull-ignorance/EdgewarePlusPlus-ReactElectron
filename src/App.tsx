import { useMemo, useState, useEffect } from "react";
import { MantineProvider } from "@mantine/core";
import { MainAppPage } from "./pages/MainAppPage/MainAppPage";
import { PopupWindow, parsePopupRoute } from "./pages/PopupWindow/PopupWindow";
import { InAppPopupOverlay } from "./components/InAppPopupOverlay";
import { useSettingsStore } from "./stores/settingsStore";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getTheme, isLightTheme } from "./theme/themeConfig";
import { useAppBootstrap } from "./hooks/useAppBootstrap";
import { ToastStack } from "./features/notifications/ToastStack";
import { StartupSplash } from "./features/startup/StartupSplash";
import defaultSplash from "./assets/default_loading_splash.png";

function Workspace() {
  const popupRoute = useMemo(() => parsePopupRoute(window.location.hash), []);
  useAppBootstrap(popupRoute !== null);

  if (popupRoute) {
    return (
      <ErrorBoundary>
        <PopupWindow route={popupRoute} />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <MainSplash />
      <MainAppPage />
      <InAppPopupOverlay />
    </ErrorBoundary>
  );
}

/**
 * Legacy startup splash: a full-screen image opaque from the first frame,
 * held briefly then faded out, shown once per app start when the
 * startup-splash setting is on. The pack may override the image with
 * loading_splash.{png,gif,jpg,jpeg,bmp} at its root or in resource/.
 */
function MainSplash() {
  const loaded = useSettingsStore((s) => s.loaded);
  const showLoadingFlair = useSettingsStore((s) => s.showLoadingFlair);
  const [packSplash, setPackSplash] = useState<string | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let alive = true;
    void window.api?.pack
      .splashImage()
      .then((url) => {
        if (alive) setPackSplash(url);
      })
      .catch(() => {
        if (alive) setPackSplash(null);
      });
    return () => {
      alive = false;
    };
  }, []);

  // Shown from first paint (the setting defaults to on); a loaded setting of
  // off dismisses it before any image appears.
  if (dismissed || (loaded && showLoadingFlair !== 1)) return null;
  return (
    <StartupSplash
      imageUrl={packSplash ? `data:${packSplash}` : defaultSplash}
      onFadeComplete={() => setDismissed(true)}
    />
  );
}

function App() {
  const themeType = useSettingsStore((state) => state.themeType);
  const themeNoConfig = useSettingsStore((state) => state.themeNoConfig);
  // Legacy themeNoConfig: the app chrome stays on the Original theme no
  // matter what theme the pack or user selects.
  const effectiveTheme = themeNoConfig === 1 ? "original" : themeType;

  return (
    <MantineProvider
      theme={getTheme(effectiveTheme)}
      forceColorScheme={isLightTheme(effectiveTheme) ? "light" : "dark"}
    >
      <Workspace />
      <ToastStack />
    </MantineProvider>
  );
}

export default App;
