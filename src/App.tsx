import { useMemo } from "react";
import { MantineProvider } from "@mantine/core";
import { MainAppPage } from "./pages/MainAppPage/MainAppPage";
import { PopupWindow, parsePopupRoute } from "./pages/PopupWindow/PopupWindow";
import { InAppPopupOverlay } from "./components/InAppPopupOverlay";
import { useSettingsStore } from "./stores/settingsStore";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { getTheme } from "./theme/themeConfig";
import { useAppBootstrap } from "./hooks/useAppBootstrap";
import { ToastStack } from "./features/notifications/ToastStack";

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
      <MainAppPage />
      <InAppPopupOverlay />
    </ErrorBoundary>
  );
}

function App() {
  const themeType = useSettingsStore((state) => state.themeType);

  return (
    <MantineProvider theme={getTheme(themeType)} forceColorScheme="dark">
      <Workspace />
      <ToastStack />
    </MantineProvider>
  );
}

export default App;
