/**
 * @file preloadGuard — decides how the renderer boots from the bridge state.
 *
 * The shipped fallback stub exists so the dev server and browser-layer tests
 * run without Electron. Inside Electron a missing `window.api` means the
 * preload never ran — a broken install, not a browser — so the stub must not
 * install there: it would present a silently dead app as a working one.
 */

export type BootDecision = "app" | "stub" | "fatal";

/** The Electron renderer UA carries "Electron"; plain browsers never do. */
export function isElectronRenderer(userAgent: string): boolean {
  return userAgent.includes("Electron");
}

export function bootstrapDecision(isElectron: boolean, hasApi: boolean): BootDecision {
  if (hasApi) return "app";
  return isElectron ? "fatal" : "stub";
}

export function PreloadFailureScreen() {
  return (
    <div
      data-testid="preload-failure"
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 12,
        background: "#14161c",
        color: "#e8eaf0",
        fontFamily: "system-ui, sans-serif",
        textAlign: "center",
        padding: 24,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700 }}>Edgeware++ failed to start</div>
      <div style={{ maxWidth: 460, opacity: 0.8 }}>
        The application bridge (preload) did not load, so this window cannot reach
        the app backend. Reinstall the app or report this if it persists.
      </div>
    </div>
  );
}
