import { describe, expect, it } from "vitest";
import path from "node:path";
import { autostartFilePath, buildAutostartEntry, AUTOSTART_FILE_NAME } from "../../electron/utils/autostart";

describe("autostartFilePath", () => {
  it("points into the XDG autostart directory", () => {
    expect(autostartFilePath("/home/ana")).toBe(
      path.join("/home/ana", ".config", "autostart", AUTOSTART_FILE_NAME)
    );
  });
});

describe("buildAutostartEntry", () => {
  const content = buildAutostartEntry("/opt/Edgeware++/edgewareplusplus");

  it("is a valid Desktop Entry with the exec path quoted", () => {
    expect(content).toContain("[Desktop Entry]");
    expect(content).toContain('Exec="/opt/Edgeware++/edgewareplusplus"');
    expect(content).toContain("Type=Application");
    expect(content).toContain("X-GNOME-Autostart-enabled=true");
  });

  it("ends with a newline so the file is POSIX-complete", () => {
    expect(content.endsWith("\n")).toBe(true);
  });
});
