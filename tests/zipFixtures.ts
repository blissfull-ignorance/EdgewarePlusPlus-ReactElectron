import { createWriteStream, writeFileSync } from "node:fs";
import { crc32 } from "node:zlib";
import { ZipArchive } from "archiver";

/**
 * Build a zip with archiver. Entry names are normalized by archiver
 * (e.g. `../../x` becomes `x`), which is fine for normal fixtures.
 */
export function buildZip(
  zipPath: string,
  files: Record<string, string | Buffer>
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = new ZipArchive();
    output.on("close", () => resolve());
    archive.on("error", (err: Error) => reject(err));
    for (const [name, content] of Object.entries(files)) {
      archive.append(content as Buffer | string, { name });
    }
    archive.pipe(output);
    void archive.finalize();
  });
}

export interface RawZipEntry {
  name: string;
  data: Buffer;
  /**
   * Store the entry as DEFLATE with bytes that are not a valid deflate stream.
   * yauzl ignores data CRCs, so a corrupt-CRC STORED entry still extracts
   * cleanly; an invalid deflate stream is what actually fails mid-read and
   * drives extractPackZip's partial-cleanup path.
   */
  corruptDeflate?: boolean;
}

/**
 * Hand-build a zip with STORED entries, preserving entry names verbatim
 * (no normalization) — required for malicious fixtures like `../../escape.txt`
 * that archiver would otherwise rewrite.
 */
export function buildRawZip(zipPath: string, entries: RawZipEntry[]): void {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, "utf-8");
    const crc = crc32(entry.data) >>> 0;
    // 0 = STORED; 8 = DEFLATE. A corrupt entry claims DEFLATE so the reader
    // runs the bytes through zlib and fails on the first invalid block.
    const method = entry.corruptDeflate ? 8 : 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt16LE(0, 14);
    local.writeUInt32LE(crc, 16);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    parts.push(local, nameBuf, entry.data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(entry.data.length, 20);
    cd.writeUInt32LE(entry.data.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + entry.data.length;
  }

  const centralSize = central.reduce((sum, buf) => sum + buf.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralSize, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  writeFileSync(zipPath, Buffer.concat([...parts, ...central, eocd]));
}
