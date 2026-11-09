/**
 * @file discordDat — Parser for the pack's `resource/discord.dat`.
 *
 * Legacy format: line 1 is the presence status text; an optional non-empty
 * line 2 names the artwork key registered under the Discord application.
 */
export function parseDiscordDat(content: string): { text: string; image: string | null } | null {
  const lines = String(content ?? "").split(/\r?\n/).map((l) => l.trim());
  const text = lines[0] ?? "";
  if (!text) return null;
  const image = lines.length > 1 && lines[1] ? lines[1] : null;
  return { text, image };
}
