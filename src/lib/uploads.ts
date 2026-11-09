import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { getDb } from "@/lib/db";
import { getSessionUser } from "@/lib/adminSessions";
import type { SafeAdminUser } from "@/lib/adminUsers";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
export const MAX_PDF_SIZE = 15 * 1024 * 1024; // 15 MB

export const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export class UploadValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = "UploadValidationError";
    this.statusCode = statusCode;
  }
}

export interface MediaUploadRecord {
  id: number;
  filename: string;
  original_name?: string;
  url: string;
  alt_text: string;
  caption?: string;
  mime_type: string;
  file_size: number;
  width?: number | null;
  height?: number | null;
  sort_order?: number;
  created_at?: string;
  updated_at?: string;
}

export function getUploadsDir(): string {
  if (process.env.UPLOADS_DIR) {
    const customDir = path.resolve(process.env.UPLOADS_DIR);
    if (!fs.existsSync(customDir)) {
      fs.mkdirSync(customDir, { recursive: true });
    }
    return customDir;
  }
  const dir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Server-side magic-bytes inspection for image files.
 * Rejects executables, SVGs, scripts, and non-image formats.
 */
export function detectImageMimeType(buffer: Buffer): AllowedMimeType | null {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }

  // WebP: RIFF .... WEBP
  if (
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  // AVIF: ISOBMFF ftyp box containing 'avif' or 'avis'
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const brandHeader = buffer
      .subarray(8, Math.min(buffer.length, 36))
      .toString("ascii");
    if (brandHeader.includes("avif") || brandHeader.includes("avis")) {
      return "image/avif";
    }
  }

  return null;
}

/**
 * Server-side magic-bytes inspection for PDF files (%PDF-).
 */
export function detectPdfMimeType(buffer: Buffer): "application/pdf" | null {
  if (!buffer || buffer.length < 5) return null;
  // %PDF- (0x25 0x50 0x44 0x46 0x2d)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46 &&
    buffer[4] === 0x2d
  ) {
    return "application/pdf";
  }
  return null;
}

export function validatePdfUpload(
  buffer: Buffer,
  options: { originalFilename?: string; declaredMimeType?: string } = {}
): { mimeType: "application/pdf"; extension: string } {
  if (!buffer || buffer.length === 0) {
    throw new UploadValidationError("Uploaded PDF file is empty.", 400);
  }

  if (buffer.length > MAX_PDF_SIZE) {
    throw new UploadValidationError(
      `File size exceeds 15MB limit (${buffer.length} bytes).`,
      413
    );
  }

  const { originalFilename = "", declaredMimeType = "" } = options;

  // Reject SVGs or script payloads masquerading as PDF
  const checkSample = buffer
    .subarray(0, Math.min(buffer.length, 256))
    .toString("utf8")
    .toLowerCase();
  if (
    declaredMimeType.toLowerCase().includes("svg") ||
    originalFilename.toLowerCase().endsWith(".svg") ||
    checkSample.includes("<svg") ||
    checkSample.includes("<?xml")
  ) {
    throw new UploadValidationError(
      "Invalid PDF file format. SVG or script files are not allowed.",
      400
    );
  }

  const isPdf = detectPdfMimeType(buffer);
  if (!isPdf) {
    throw new UploadValidationError(
      "Invalid file format. The file must be a valid PDF document.",
      400
    );
  }

  return { mimeType: "application/pdf", extension: ".pdf" };
}

export async function savePdfUpload(
  options: {
    fileBuffer: Buffer;
    originalFilename?: string;
    declaredMimeType?: string;
    altText?: string;
    caption?: string;
    sortOrder?: number;
  }
): Promise<MediaUploadRecord> {
  const {
    fileBuffer,
    originalFilename = "document.pdf",
    declaredMimeType,
    altText = "",
    caption = "",
    sortOrder = 0,
  } = options;

  const { mimeType, extension } = validatePdfUpload(fileBuffer, {
    originalFilename,
    declaredMimeType,
  });

  const filename = generateCollisionResistantFilename(originalFilename, extension);
  const uploadsDir = getUploadsDir();
  const filePath = path.join(uploadsDir, filename);

  await fs.promises.writeFile(filePath, fileBuffer);

  const url = `/uploads/${filename}`;
  const fileSize = fileBuffer.length;
  const cleanAlt = (altText || originalFilename).slice(0, 200).trim();
  const cleanCaption = caption.slice(0, 500).trim();

  const db = getDb();
  let insertId = 0;

  const cols = (
    db.prepare("PRAGMA table_info(media_uploads)").all() as { name: string }[]
  ).map((c) => c.name);

  if (cols.includes("original_name") && cols.includes("width")) {
    const stmt = db.prepare(
      "INSERT INTO media_uploads (filename, original_name, url, alt_text, caption, mime_type, file_size, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
      filename,
      originalFilename,
      url,
      cleanAlt,
      cleanCaption,
      mimeType,
      fileSize,
      null,
      null,
      Number(sortOrder) || 0
    );
    insertId = Number(result.lastInsertRowid);
  } else {
    const stmt = db.prepare(
      "INSERT INTO media_uploads (filename, url, alt_text, mime_type, file_size, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
      filename,
      url,
      cleanAlt,
      mimeType,
      fileSize,
      Number(sortOrder) || 0
    );
    insertId = Number(result.lastInsertRowid);
  }

  return {
    id: insertId,
    filename,
    original_name: originalFilename,
    url,
    alt_text: cleanAlt,
    caption: cleanCaption,
    mime_type: mimeType,
    file_size: fileSize,
    width: null,
    height: null,
    sort_order: sortOrder,
  };
}

/**
 * Parses width and height directly from image buffer for PNG, JPEG, WebP, and AVIF.
 * Zero external dependencies; fast binary header parsing.
 */
export function detectImageDimensions(
  buffer: Buffer
): { width: number; height: number; format: string } | null {
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
      return { width, height, format: "png" };
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
      // SOF markers: C0-C3, C5-C7, C9-CB, CD-CF
      const isSof =
        (marker >= 0xc0 && marker <= 0xc3) ||
        (marker >= 0xc5 && marker <= 0xc7) ||
        (marker >= 0xc9 && marker <= 0xcb) ||
        (marker >= 0xcd && marker <= 0xcf);
      if (isSof) {
        const height = buffer.readUInt16BE(offset + 5);
        const width = buffer.readUInt16BE(offset + 7);
        return { width, height, format: "jpeg" };
      }
      if (marker === 0xd9 || marker === 0xda) break; // EOI or SOS
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
      return { width, height, format: "webp" };
    }
    if (chunkType === "VP8L" && buffer.length >= 25) {
      const b0 = buffer[21],
        b1 = buffer[22],
        b2 = buffer[23],
        b3 = buffer[24];
      const width = 1 + (((b1 & 0x3f) << 8) | b0);
      const height = 1 + (((b3 & 0x0f) << 10) | (b2 << 2) | ((b1 & 0xc0) >> 6));
      return { width, height, format: "webp" };
    }
    if (chunkType === "VP8X" && buffer.length >= 30) {
      const width = 1 + buffer.readUIntLE(24, 3);
      const height = 1 + buffer.readUIntLE(27, 3);
      return { width, height, format: "webp" };
    }
  }

  // 4. AVIF: ISOBMFF ftyp avif/avis, find 'ispe' box
  if (buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    const ispeIdx = buffer.indexOf("ispe");
    if (ispeIdx !== -1 && ispeIdx + 12 <= buffer.length) {
      const width = buffer.readUInt32BE(ispeIdx + 8);
      const height = buffer.readUInt32BE(ispeIdx + 12);
      if (width > 0 && height > 0) {
        return { width, height, format: "avif" };
      }
    }
  }

  return null;
}

/**
 * Validates file buffer size, MIME type, and magic bytes.
 */
export function validateImageUpload(
  buffer: Buffer,
  options: { originalFilename?: string; declaredMimeType?: string } = {}
): { mimeType: AllowedMimeType; extension: string } {
  if (!buffer || buffer.length === 0) {
    throw new UploadValidationError("Uploaded file is empty.", 400);
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw new UploadValidationError(
      `File size exceeds 5MB limit (${buffer.length} bytes).`,
      413
    );
  }

  const { originalFilename = "", declaredMimeType = "" } = options;

  // Explicitly reject SVGs to avoid stored XSS vulnerabilities
  const checkSample = buffer
    .subarray(0, Math.min(buffer.length, 256))
    .toString("utf8")
    .toLowerCase();
  if (
    declaredMimeType.toLowerCase().includes("svg") ||
    originalFilename.toLowerCase().endsWith(".svg") ||
    checkSample.includes("<svg") ||
    checkSample.includes("<?xml")
  ) {
    throw new UploadValidationError(
      "SVG uploads are not permitted for security reasons.",
      400
    );
  }

  const detectedMime = detectImageMimeType(buffer);
  if (!detectedMime) {
    throw new UploadValidationError(
      "Invalid file format. Only JPEG, PNG, WebP, and AVIF images are permitted.",
      400
    );
  }

  // If declared MIME was provided and is not generic, ensure it does not conflict
  if (
    declaredMimeType &&
    declaredMimeType !== "application/octet-stream" &&
    declaredMimeType.toLowerCase() !== detectedMime
  ) {
    throw new UploadValidationError(
      `MIME type mismatch: declared '${declaredMimeType}', but detected '${detectedMime}'.`,
      400
    );
  }

  const extMap: Record<AllowedMimeType, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/avif": ".avif",
  };

  return { mimeType: detectedMime, extension: extMap[detectedMime] };
}

/**
 * Generates a collision-resistant filename matching the pattern:
 * upload_${Date.now()}_${random}_${cleanFilename}
 */
export function generateCollisionResistantFilename(
  originalFilename: string,
  extension: string
): string {
  const timestamp = Date.now();
  const random = randomBytes(6).toString("hex");

  const parsed = path.parse(originalFilename);
  let cleanName = parsed.name
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  if (!cleanName) {
    cleanName = "image";
  }

  const cleanFilename = `${cleanName}${extension}`;
  return `upload_${timestamp}_${random}_${cleanFilename}`;
}

export interface SaveUploadOptions {
  fileBuffer: Buffer;
  originalFilename?: string;
  declaredMimeType?: string;
  altText?: string;
  caption?: string;
  sortOrder?: number;
  width?: number | null;
  height?: number | null;
}

/**
 * Validates, writes to public/uploads/, and records metadata in media_uploads.
 */
export async function saveMediaUpload(
  options: SaveUploadOptions
): Promise<MediaUploadRecord> {
  const {
    fileBuffer,
    originalFilename = "upload.jpg",
    declaredMimeType,
    altText = "",
    caption = "",
    sortOrder = 0,
    width = null,
    height = null,
  } = options;

  const { mimeType, extension } = validateImageUpload(fileBuffer, {
    originalFilename,
    declaredMimeType,
  });

  const detectedDims = detectImageDimensions(fileBuffer);
  let finalWidth = width ?? detectedDims?.width ?? null;
  let finalHeight = height ?? detectedDims?.height ?? null;
  let bufferToWrite = fileBuffer;

  // Optimize buffer with Sharp when possible (auto-orient, cap 1920px, strip EXIF metadata, compress)
  try {
    const img = sharp(fileBuffer).rotate();
    const meta = await img.metadata();
    let resized = false;
    if (meta.width && meta.height && (meta.width > 1920 || meta.height > 1920)) {
      img.resize(1920, 1920, { fit: "inside", withoutEnlargement: true });
      resized = true;
    }
    let optimized: Buffer | null = null;
    if (mimeType === "image/jpeg") {
      optimized = await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer();
    } else if (mimeType === "image/webp") {
      optimized = await img.webp({ quality: 82 }).toBuffer();
    } else if (mimeType === "image/png") {
      optimized = await img.png({ compressionLevel: 8 }).toBuffer();
    }
    if (optimized && optimized.length < fileBuffer.length) {
      bufferToWrite = optimized;
      if (resized) {
        const newMeta = await sharp(optimized).metadata();
        finalWidth = newMeta.width ?? finalWidth;
        finalHeight = newMeta.height ?? finalHeight;
      }
    }
  } catch {
    // Fall back to original buffer if mock or malformed
    bufferToWrite = fileBuffer;
  }

  const filename = generateCollisionResistantFilename(originalFilename, extension);
  const uploadsDir = getUploadsDir();
  const filePath = path.join(uploadsDir, filename);

  await fs.promises.writeFile(filePath, bufferToWrite);

  const url = `/uploads/${filename}`;
  const cleanAlt = typeof altText === "string" ? altText.trim() : "";
  const cleanCaption = typeof caption === "string" ? caption.trim() : "";
  const fileSize = bufferToWrite.length;

  const db = getDb();
  const cols = new Set(
    (db.prepare("PRAGMA table_info(media_uploads)").all() as { name: string }[]).map(
      (c) => c.name
    )
  );

  let insertId: number;
  if (cols.has("original_name")) {
    const stmt = db.prepare(
      "INSERT INTO media_uploads (filename, original_name, url, alt_text, caption, mime_type, file_size, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
      filename,
      originalFilename,
      url,
      cleanAlt,
      cleanCaption,
      mimeType,
      fileSize,
      finalWidth,
      finalHeight,
      Number(sortOrder) || 0
    );
    insertId = Number(result.lastInsertRowid);
  } else {
    const stmt = db.prepare(
      "INSERT INTO media_uploads (filename, url, alt_text, mime_type, file_size, sort_order) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const result = stmt.run(
      filename,
      url,
      cleanAlt,
      mimeType,
      fileSize,
      Number(sortOrder) || 0
    );
    insertId = Number(result.lastInsertRowid);
  }

  return {
    id: insertId,
    filename,
    original_name: originalFilename,
    url,
    alt_text: cleanAlt,
    caption: cleanCaption,
    mime_type: mimeType,
    file_size: fileSize,
    width: finalWidth,
    height: finalHeight,
  };
}

export function getMediaUploadById(id: number): MediaUploadRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM media_uploads WHERE id = ?")
    .get(id) as MediaUploadRecord | undefined;
  return row || null;
}

export function listMediaUploads(limit = 50): MediaUploadRecord[] {
  const db = getDb();
  return db
    .prepare(
      "SELECT * FROM media_uploads ORDER BY created_at DESC, id DESC LIMIT ?"
    )
    .all(limit) as MediaUploadRecord[];
}

export function verifyAdminSessionCookie(request: Request): SafeAdminUser | null {
  return getSessionUser(request);
}

export { checkMediaReferences, deleteMediaUpload } from "@/lib/media";

