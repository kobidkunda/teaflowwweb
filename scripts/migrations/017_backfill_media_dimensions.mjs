// 017: Backfill image dimensions (width, height) for existing media uploads
import fs from "node:fs";
import path from "node:path";

function detectDimensions(buffer) {
  if (!buffer || buffer.length < 16) return null;

  // 1. PNG: magic 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    if (buffer.length >= 24) {
      const width = buffer.readUInt32BE(16);
      const height = buffer.readUInt32BE(20);
      return { width, height };
    }
  }

  // 2. JPEG: magic FF D8
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = buffer[offset + 1];
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height };
      }
      if (marker === 0xd9 || marker === 0xda) break;
      if (offset + 4 > buffer.length) break;
      const len = buffer.readUInt16BE(offset + 2);
      if (len < 2) break;
      offset += 2 + len;
    }
  }

  // 3. WebP: RIFF ... WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    const chunkType = buffer.subarray(12, 16).toString("ascii");
    if (chunkType === "VP8 " && buffer.length >= 30) {
      const width = buffer.readUInt16LE(26) & 0x3fff;
      const height = buffer.readUInt16LE(28) & 0x3fff;
      return { width, height };
    }
    if (chunkType === "VP8L" && buffer.length >= 25) {
      const b0 = buffer[21],
        b1 = buffer[22],
        b2 = buffer[23],
        b3 = buffer[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height };
    }
    if (chunkType === "VP8X" && buffer.length >= 30) {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { width, height };
    }
  }

  // 4. AVIF: ISOBMFF ftyp avif/avis, find 'ispe' box
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const ispeIdx = buffer.indexOf("ispe");
    if (ispeIdx !== -1 && ispeIdx + 12 <= buffer.length) {
      const width = buffer.readUInt32BE(ispeIdx + 8);
      const height = buffer.readUInt32BE(ispeIdx + 12);
      if (width > 0 && height > 0) {
        return { width, height };
      }
    }
  }

  return null;
}

export function up(db) {
  // Check if media_uploads table exists
  const hasTable = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='media_uploads'"
    )
    .get();
  if (!hasTable) return;

  const uploadsDir = path.resolve(process.cwd(), "public", "uploads");
  const rows = db
    .prepare(
      "SELECT id, filename FROM media_uploads WHERE width IS NULL OR height IS NULL"
    )
    .all();

  const updateStmt = db.prepare(
    "UPDATE media_uploads SET width = ?, height = ? WHERE id = ?"
  );

  for (const row of rows) {
    const filePath = path.join(uploadsDir, row.filename);
    try {
      if (fs.existsSync(filePath)) {
        const buf = fs.readFileSync(filePath);
        const dims = detectDimensions(buf);
        if (dims && dims.width > 0 && dims.height > 0) {
          updateStmt.run(dims.width, dims.height, row.id);
        }
      }
    } catch {
      // Best effort backfill
    }
  }
}

export function down() {}
