import fs from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import yauzl from "yauzl";

export interface PackIdentity {
  name: string;
  version?: string;
  creator?: string;
}

export interface ImportProgress {
  done: number;
  total: number;
}

/**
 * Turn an arbitrary string (zip file name, renderer-supplied value) into a
 * safe directory name: path separators and absolute-path characters are
 * neutralized, `..` sequences removed, control characters stripped, whitespace
 * collapsed. Unicode and spaces are preserved.
 */
export function sanitizePackName(raw: string): string {
  const base = path.basename(raw);
  const withoutZipExt = base.replace(/\.zip$/i, "");
  let name = withoutZipExt
    .replace(/[/\\]/g, "_")
    .replace(/\.{2,}/g, ".")
    .replace(/\p{Cc}/gu, "");
  name = name.replace(/\s+/g, " ").trim();
  return name.length > 0 ? name : "Imported Pack";
}

/**
 * Resolve a non-colliding destination path under the library. A pack with the
 * same name already imported is stored as `<name> (2)`, `<name> (3)`, ...
 */
export function uniqueDestPath(libraryDir: string, baseName: string): string {
  let candidate = path.join(libraryDir, baseName);
  let counter = 2;
  while (fs.existsSync(candidate)) {
    candidate = path.join(libraryDir, `${baseName} (${counter})`);
    counter += 1;
  }
  return candidate;
}

/**
 * Legacy nesting quirk: some pack zips wrap their content in a single top-level
 * directory. If every file entry sits under one shared top-level directory
 * (and at least one entry has sub-path segments), that prefix is unwrapped so
 * the pack lands at the expected depth.
 */
export function detectUnwrapPrefix(fileEntries: string[]): string | null {
  if (fileEntries.length === 0) return null;
  const prefixed = fileEntries.filter((entry) => entry.includes("/"));
  if (prefixed.length === 0) return null;
  const tops = new Set(prefixed.map((entry) => entry.split("/")[0]));
  if (tops.size !== 1) return null;
  const top = [...tops][0];
  const allUnder = fileEntries.every((entry) => entry === top || entry.startsWith(`${top}/`));
  return allUnder ? top : null;
}

/**
 * Zip-slip guard: an archive entry is safe only if, resolved against the
 * destination, it stays inside the destination. Absolute entries, `..`
 * sequences and similar tricks all resolve outside and are rejected.
 */
export function isSafeEntryPath(destDir: string, entryName: string): boolean {
  const normalized = entryName.replace(/\\/g, "/");
  const resolved = path.resolve(destDir, normalized);
  return resolved === destDir || resolved.startsWith(destDir + path.sep);
}

/**
 * Parse pack info.json metadata with fallbacks: name falls back to the
 * directory name; version/creator are omitted when absent.
 */
export function parsePackInfo(info: unknown, fallbackName: string): PackIdentity {
  const obj = (typeof info === "object" && info !== null ? info : {}) as Record<string, unknown>;
  const name = typeof obj.name === "string" && obj.name.length > 0 ? obj.name : fallbackName;
  const version = typeof obj.version === "string" && obj.version.length > 0 ? obj.version : undefined;
  const creator = typeof obj.creator === "string" && obj.creator.length > 0 ? obj.creator : undefined;
  return { name, version, creator };
}

function normalizeEntryName(name: string): string {
  return name.replace(/\\/g, "/");
}

function isDirectoryEntry(entry: yauzl.Entry): boolean {
  return entry.fileName.endsWith("/") || (entry.externalFileAttributes & 0x10) !== 0;
}

function openZipFile(zipPath: string): Promise<yauzl.ZipFile> {
  return new Promise((resolve, reject) => {
    yauzl.open(
      zipPath,
      { lazyEntries: true, decodeStrings: true, autoClose: false },
      (err, zipfile) => {
        if (err) reject(err);
        else resolve(zipfile);
      }
    );
  });
}

/**
 * Collect every entry via yauzl's async iterator. yauzl itself rejects
 * archives with absolute or `..` paths while decoding names; such errors
 * surface here and are mapped to the visible "unsafe archive entry" failure
 * by the caller.
 */
function listZipEntries(
  zipfile: yauzl.ZipFile
): Promise<{ entries: yauzl.Entry[]; totalSize: number }> {
  return new Promise((resolve, reject) => {
    const entries: yauzl.Entry[] = [];
    let totalSize = 0;
    let settled = false;
    void (async () => {
      try {
        for await (const entry of zipfile.eachEntry()) {
          entries.push(entry);
          if (!isDirectoryEntry(entry)) totalSize += entry.uncompressedSize;
        }
        if (!settled) {
          settled = true;
          resolve({ entries, totalSize });
        }
      } catch (err) {
        if (!settled) {
          settled = true;
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      }
    })();
  });
}

function readEntryToDisk(
  zipfile: yauzl.ZipFile,
  entry: yauzl.Entry,
  target: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const streamPromise = new Promise<Readable>((sResolve, sReject) => {
      zipfile.openReadStream(entry, (err, stream) => {
        if (err || !stream) sReject(err ?? new Error(`Could not read "${entry.fileName}" from the archive.`));
        else sResolve(stream);
      });
    });
    streamPromise
      .then((stream) =>
        new Promise<void>((wResolve, wReject) => {
          const out = fs.createWriteStream(target);
          stream.on("error", wReject);
          out.on("error", wReject);
          out.on("finish", () => wResolve());
          stream.pipe(out);
        })
      )
      .then(
        () => resolve(),
        (err) => reject(err)
      );
  });
}

/**
 * Extract a pack zip into destDir (created if needed). Async and non-blocking:
 * entries are streamed from the archive one at a time.
 *
 * - Zips whose content is nested one directory deep are unwrapped.
 * - Any entry that would resolve outside destDir aborts the whole import with
 *   a visible error; nothing is written outside, and a partial destination is
 *   removed on failure.
 * - onProgress reports extracted/total bytes as extraction proceeds.
 */
export async function extractPackZip(
  zipPath: string,
  destDir: string,
  onProgress?: (progress: ImportProgress) => void
): Promise<{ entryCount: number }> {
  let zipfile: yauzl.ZipFile;
  try {
    zipfile = await openZipFile(zipPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`Pack file not found: ${zipPath}`);
    }
    throw new Error(
      `Not a valid zip file (corrupt or truncated archive): ${path.basename(zipPath)}`
    );
  }

  let collected: { entries: yauzl.Entry[]; totalSize: number };
  try {
    collected = await listZipEntries(zipfile);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    if (/invalid relative path|absolute path|invalid characters in fileName/i.test(message)) {
      throw new Error(`Rejected unsafe archive entry — ${message}`);
    }
    throw new Error(`Could not read the zip archive: ${message}`);
  }

  const fileEntries = collected.entries.filter((entry) => !isDirectoryEntry(entry));
  if (fileEntries.length === 0) {
    throw new Error("The zip file contains no extractable files.");
  }

  const names = fileEntries.map((entry) => normalizeEntryName(entry.fileName));
  const prefix = detectUnwrapPrefix(names);
  const relativeNames = names.map((name) =>
    prefix ? name.slice(prefix.length + 1) : name
  );

  for (let i = 0; i < relativeNames.length; i++) {
    if (!isSafeEntryPath(destDir, relativeNames[i])) {
      throw new Error(
        `Rejected unsafe archive entry "${names[i]}" — it would escape the pack library (path traversal).`
      );
    }
  }

  await fs.promises.mkdir(destDir, { recursive: true });

  let done = 0;
  let entryCount = 0;
  try {
    for (let i = 0; i < fileEntries.length; i++) {
      const entry = fileEntries[i];
      const target = path.resolve(destDir, relativeNames[i]);
      await fs.promises.mkdir(path.dirname(target), { recursive: true });
      await readEntryToDisk(zipfile, entry, target);
      done += entry.uncompressedSize;
      entryCount += 1;
      onProgress?.({ done, total: collected.totalSize });
    }
  } catch (err) {
    await fs.promises.rm(destDir, { recursive: true, force: true }).catch(() => {});
    if (err instanceof Error && err.message.startsWith("Rejected unsafe archive entry")) {
      throw err;
    }
    throw new Error(
      `Zip extraction failed for "${path.basename(zipPath)}": ${err instanceof Error ? err.message : "unknown error"}`
    );
  }
  void zipfile.close();

  if (collected.totalSize > 0) {
    onProgress?.({ done: collected.totalSize, total: collected.totalSize });
  }
  return { entryCount };
}
