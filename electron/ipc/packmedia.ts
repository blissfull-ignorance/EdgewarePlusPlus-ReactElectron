/**
 * @file packmedia — Custom `packmedia://` protocol that streams real pack media.
 *
 * Popup windows and in-app overlays reference pack media (image/video/audio) by a
 * bare filename. This module registers a privileged standard scheme plus a
 * `protocol.handle` route that resolves each request strictly inside the active
 * pack's media subdirectory, so a file outside the pack can never be served.
 * Pack-relative paths are confined by `resolvePackMediaPath`;
 * missing/unreadable files yield 404 rather than a crash so a bad file cannot take
 * down the popup loop.
 */
import { protocol } from "electron";
import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { logger } from "../utils/logger";
import {
  PACK_MEDIA_SCHEME,
  parseByteRange,
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
      const packRoot = currentPackDir() ?? "";

      let rel: string;
      try {
        rel = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
      } catch {
        return notFound();
      }

      let filePath = resolvePackMediaPath(packRoot, url.host, rel);
      const confineRoot = path.join(path.resolve(packRoot), url.host);
      if (!filePath || !confineRoot) return notFound();

      // Symlink-aware confinement: a pack (or cache) file that resolves
      // outside its own subtree is refused, never served.
      let real: string;
      try {
        real = fs.realpathSync(filePath);
        const subRoot = fs.realpathSync(confineRoot);
        if (real !== subRoot && !real.startsWith(subRoot + path.sep)) return notFound();
      } catch {
        return notFound();
      }

      let stat: fs.Stats;
      try {
        stat = fs.statSync(real);
      } catch {
        return notFound();
      }
      if (!stat.isFile()) return notFound();

      filePath = real;

      const etag = `"${stat.size.toString(16)}-${Math.round(stat.mtimeMs).toString(16)}"`;
      const baseHeaders: Record<string, string> = {
        "content-type": contentTypeForFile(filePath),
        // Revalidate every visit: unchanged files answer as a bare 304, so
        // gallery grids do not re-transfer or re-decode megabytes, while
        // creator edits (new mtime/size) are picked up immediately.
        "cache-control": "no-cache",
        "accept-ranges": "bytes",
        etag,
        "access-control-allow-origin": "*",
      };
      if (request.headers.get("if-none-match") === etag) {
        return new Response(null, { status: 304, headers: baseHeaders });
      }

      // Byte-range serving: <video> seeks with Range requests (an mp4's
      // index sits at the file end), and without 206 support playback and
      // even metadata thumbnails fail.
      const range = parseByteRange(request.headers.get("range"), stat.size);
      if (range === "unsatisfiable") {
        return new Response(null, {
          status: 416,
          headers: { ...baseHeaders, "content-range": `bytes */${stat.size}` },
        });
      }
      if (range) {
        const { start, end } = range;
        const stream = Readable.toWeb(
          fs.createReadStream(filePath, { start, end })
        ) as unknown as ReadableStream;
        return new Response(stream, {
          status: 206,
          headers: {
            ...baseHeaders,
            "content-length": String(end - start + 1),
            "content-range": `bytes ${start}-${end}/${stat.size}`,
          },
        });
      }

      const stream = Readable.toWeb(fs.createReadStream(filePath)) as unknown as ReadableStream;
      return new Response(stream, {
        status: 200,
        headers: { ...baseHeaders, "content-length": String(stat.size) },
      });
    } catch (err) {
      logger.error("[PackMedia] Failed to serve media:", err);
      return notFound();
    }
  });
  logger.info(`[PackMedia] Registered ${PACK_MEDIA_SCHEME}:// protocol`);
}
