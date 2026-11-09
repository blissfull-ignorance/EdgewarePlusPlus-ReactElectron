/**
 * @file discord — Discord rich presence via the local Discord client.
 *
 * Uses the same application id as the legacy Python app. Presence is
 * best-effort: when no Discord client is reachable the login attempt fails
 * and we log — the runtime continues, exactly like the legacy behavior.
 */
import { Client } from "@xhayper/discord-rpc";
import { logger } from "../utils/logger";

const CLIENT_ID = "820204081410736148";

let client: Client | null = null;
let loggedIn = false;

export async function setDiscordPresence(text: string, imageId: string): Promise<void> {
  try {
    if (!client) {
      client = new Client({ clientId: CLIENT_ID });
      client.on("error", (err) => {
        logger.warn("[Discord] presence error:", err instanceof Error ? err.message : err);
      });
    }
    if (!loggedIn) {
      await client.login();
      loggedIn = true;
    }
    await client.user?.setActivity({
      state: text || "Edgeware++",
      largeImageKey: imageId || undefined,
      largeImageText: "Edgeware++",
      startTimestamp: Math.floor(Date.now() / 1000),
    });
    logger.info(`[Discord] presence updated: "${text}"`);
  } catch (err) {
    loggedIn = false;
    logger.warn("[Discord] presence unavailable:", err instanceof Error ? err.message : err);
  }
}

export function destroyDiscord(): void {
  try {
    client?.destroy();
  } catch {
    /* already gone */
  }
  client = null;
  loggedIn = false;
}
