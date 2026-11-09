/**
 * @file autostart — Linux login autostart via an XDG autostart entry.
 *
 * `app.setLoginItemSettings` covers macOS and Windows; on Linux the
 * convention is a `.desktop` file in `~/.config/autostart/`. The builders are
 * pure so the file content and location can be unit-tested without a home
 * directory.
 */
import path from "node:path";

export const AUTOSTART_FILE_NAME = "edgewareplusplus.desktop";

export function autostartFilePath(homeDir: string): string {
  return path.join(homeDir, ".config", "autostart", AUTOSTART_FILE_NAME);
}

export function buildAutostartEntry(execPath: string): string {
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Name=Edgeware++",
    "Comment=Edgeware++ cross-platform",
    `Exec="${execPath}"`,
    "Terminal=false",
    "X-GNOME-Autostart-enabled=true",
    "",
  ].join("\n");
}
