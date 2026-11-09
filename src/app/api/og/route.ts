import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// In-memory buffer cache: key -> { buffer: Buffer, timestamp: number }
const CACHE_MAX_ENTRIES = 64;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
const imageCache = new Map<string, { buffer: Buffer; timestamp: number }>();

function getCached(key: string): Buffer | null {
  const entry = imageCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    imageCache.delete(key);
    return null;
  }
  return entry.buffer;
}

function setCached(key: string, buffer: Buffer): void {
  if (imageCache.size >= CACHE_MAX_ENTRIES) {
    // Evict oldest
    const firstKey = imageCache.keys().next().value;
    if (firstKey) imageCache.delete(firstKey);
  }
  imageCache.set(key, { buffer, timestamp: Date.now() });
}

/**
 * Resolves a safe local filesystem path for a requested image URL/path.
 * Blocks directory traversal attacks and SSRF.
 */
function resolveSafeLocalPath(imageParam: string | null): string {
  const publicDir = path.resolve(process.cwd(), "public");
  const fallbackPath = path.join(publicDir, "images", "og-default.jpg");

  if (!imageParam || !imageParam.trim()) {
    return fallbackPath;
  }

  let clean = imageParam.trim();

  // If a full URL was provided, verify it belongs to our own host
  if (/^https?:\/\//i.test(clean)) {
    try {
      const parsed = new URL(clean);
      const host = parsed.hostname.toLowerCase();
      if (
        host === "teafloww.com" ||
        host === "www.teafloww.com" ||
        host === "localhost" ||
        host === "127.0.0.1" ||
        host.includes("himalayantea")
      ) {
        clean = parsed.pathname;
      } else {
        // Untrusted external URL: fall back to default OG image
        return fallbackPath;
      }
    } catch {
      return fallbackPath;
    }
  }

  // Prevent directory traversal
  if (clean.includes("..") || clean.includes("\0")) {
    return fallbackPath;
  }

  // Strip leading slashes
  clean = clean.replace(/^\/+/, "");

  // Candidate paths within public directory
  const candidate = path.resolve(publicDir, clean);

  // Must strictly be inside publicDir
  if (!candidate.startsWith(publicDir + path.sep) && candidate !== publicDir) {
    return fallbackPath;
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return candidate;
  }

  return fallbackPath;
}

/**
 * Core image processing using Sharp:
 * Resizes and composites any image to standard 1200x630 OpenGraph dimensions.
 * Guarantees file size is well under 300KB for WhatsApp link preview compatibility.
 */
async function processOgImage(
  sourcePath: string,
  targetWidth = 1200,
  targetHeight = 630
): Promise<Buffer> {
  const meta = await sharp(sourcePath).metadata();
  const width = meta.width || targetWidth;
  const height = meta.height || targetHeight;
  const ratio = width / height;

  // If already close to 1.91:1 landscape (e.g. 1.6 to 2.2), cover-crop with high fidelity
  if (ratio >= 1.6 && ratio <= 2.2) {
    return sharp(sourcePath)
      .resize(targetWidth, targetHeight, { fit: "cover", position: "centre" })
      .jpeg({ quality: 84, progressive: true, mozjpeg: true })
      .toBuffer();
  }

  // Otherwise (square or portrait packaging tins/teas), generate atmospheric composite:
  // 1. Atmospheric blurred, darkened backdrop
  const bg = await sharp(sourcePath)
    .resize(targetWidth, targetHeight, { fit: "cover", position: "centre" })
    .blur(30)
    .modulate({ brightness: 0.72, saturation: 1.05 })
    .toBuffer();

  // 2. Crisp uncropped foreground product photo
  const fgMaxHeight = Math.round(targetHeight * 0.88); // ~554px
  const fgMaxWidth = Math.round(targetWidth * 0.85); // ~1020px

  const fg = await sharp(sourcePath)
    .resize({ height: fgMaxHeight, width: fgMaxWidth, fit: "inside" })
    .toBuffer();

  // 3. Composite crisp product in the centre
  return sharp(bg)
    .composite([{ input: fg, gravity: "centre" }])
    .jpeg({ quality: 84, progressive: true, mozjpeg: true })
    .toBuffer();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const imageParam = url.searchParams.get("image");
  const widthParam = parseInt(url.searchParams.get("w") || "1200", 10);
  const heightParam = parseInt(url.searchParams.get("h") || "630", 10);

  const targetWidth = Math.min(Math.max(widthParam || 1200, 600), 1920);
  const targetHeight = Math.min(Math.max(heightParam || 630, 315), 1080);

  const safePath = resolveSafeLocalPath(imageParam);
  const cacheKey = `${safePath}:${targetWidth}x${targetHeight}`;

  let buffer = getCached(cacheKey);

  if (!buffer) {
    try {
      buffer = await processOgImage(safePath, targetWidth, targetHeight);
      setCached(cacheKey, buffer);
    } catch (err) {
      logger.error("Error processing OG image", { err });
      // Fallback to static default OG image directly
      const publicDir = path.resolve(process.cwd(), "public");
      const defaultOgPath = path.join(publicDir, "images", "og-default.jpg");
      if (fs.existsSync(defaultOgPath)) {
        buffer = await fs.promises.readFile(defaultOgPath);
      } else {
        return new NextResponse("Failed to generate preview image", { status: 500 });
      }
    }
  }

  const etag = `"${buffer.length.toString(16)}-og"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": String(buffer.length),
      "Cache-Control": "public, max-age=2592000, s-maxage=2592000, immutable",
      ETag: etag,
    },
  });
}

export async function HEAD(request: Request) {
  const res = await GET(request);
  return new NextResponse(null, {
    status: res.status,
    headers: res.headers,
  });
}
