import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getUploadsDir } from "@/lib/uploads";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME_MAP: Record<string, string> = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
};

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path: segments } = await params;
  if (!segments || segments.length === 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Prevent directory traversal attacks
  const rawPath = segments.join("/");
  if (rawPath.includes("..") || rawPath.includes("\0")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const uploadsDir = path.resolve(getUploadsDir());
  const filePath = path.resolve(uploadsDir, ...segments);

  // Ensure filePath is strictly inside uploadsDir
  if (!filePath.startsWith(uploadsDir + path.sep) && filePath !== uploadsDir) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) {
      return new NextResponse("Not Found", { status: 404 });
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    // ETag handling for caching and conditional requests
    const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch && ifNoneMatch === etag) {
      return new NextResponse(null, { status: 304 });
    }

    const fileBuffer = await fs.promises.readFile(filePath);

    const urlObj = new URL(request.url);
    const forceDownload = urlObj.searchParams.get("download") === "1";
    let contentDisposition = contentType === "application/pdf" ? "inline" : undefined;
    if (forceDownload) {
      const downloadName = (urlObj.searchParams.get("name") || path.basename(filePath)).replace(/["\r\n]/g, "");
      contentDisposition = `attachment; filename="${downloadName}"`;
    }

    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(stat.size),
      "Cache-Control": "public, max-age=2592000, immutable",
      "Last-Modified": stat.mtime.toUTCString(),
      ETag: etag,
    };
    if (contentDisposition) {
      headers["Content-Disposition"] = contentDisposition;
    }

    return new NextResponse(fileBuffer, {
      status: 200,
      headers,
    });
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "ENOENT") {
      return new NextResponse("Not Found", { status: 404 });
    }
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function HEAD(
  request: Request,
  props: { params: Promise<{ path: string[] }> }
) {
  const response = await GET(request, props);
  return new NextResponse(null, {
    status: response.status,
    headers: response.headers,
  });
}
