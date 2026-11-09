/**
 * @file packmedia — Custom `packmedia://` protocol that streams real pack media.
 *
 * Popup windows and in-app overlays reference pack media (image/video/audio) by a
 * bare filename. This module registers a privileged standard scheme plus a
 * `protocol.handle` route that resolves each request strictly inside the active
 * pack's media subdirectory, so a file outside the pack can never be served
 * (task 21 A21.5). Pack-relative paths are confined by `resolvePackMediaPath`;
 * missing/unreadable files yield 404 rather than a crash so a bad file cannot take
 * down the popup loop (A21.6).
 */
import { protocol } from "electron";
import fs from "node:fs";
import { Readable } from "node:stream";
import { logger } from "../utils/logger";
import {
  PACK_MEDIA_SCHEME,
  resolvePackMediaPath,
  contentTypeForFile,
} from "../utils/mediaGuard";
import { currentPackDir } from "./pack";

/**
 * Mark the `packmedia` scheme as a standard, secure, fetch-API, streaming scheme.
 * This MUST run before the app is ready; call it once at module load in main.ts.
 */
export function configurePackMediaScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: PACK_MEDIA_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true,
      },
    },
  ]);
}

function notFound(): Response {
  return new Response("Not Found", {
    status: 404,
    headers: { "content-type": "text/plain", "access-control-allow-origin": "*" },
  });
}

/**
 * Register the `protocol.handle` route serving pack media. Call once on app ready,
 * before any window is created so popup windows can load their media immediately.
 */
export function registerPackMediaProtocol(): void {
  protocol.handle(PACK_MEDIA_SCHEME, (request) => {
    try {
      const url = new URL(request.url);
      const packRoot = currentPackDir();

      let rel: string;
      try {
        rel = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      } catch {
        return notFound();
      }

      const filePath = resolvePackMediaPath(packRoot, url.host, rel);
      if (!filePath) return notFound();

      let stat: fs.Stats;
      try {
        stat = fs.statSync(filePath);
      } catch {
        return notFound();
      }
      if (!stat.isFile()) return notFound();

      const stream = Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream;
      return new Response(stream, {
        status: 200,
        headers: {
          "content-type": contentTypeForFile(filePath),
          "cache-control": "no-store",
          "accept-ranges": "bytes",
          "content-length": String(stat.size),
          "access-control-allow-origin": "*",
        },
      });
    } catch (err) {
      logger.error("[PackMedia] Failed to serve media:", err);
      return notFound();
    }
  });
  logger.info(`[PackMedia] Registered ${PACK_MEDIA_SCHEME}:// protocol`);
}
