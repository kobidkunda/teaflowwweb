import { NextResponse } from "next/server";
import { guard, invalid } from "@/lib/adminHttp";
import { listMedia } from "@/lib/media";
import { mediaQuerySchema } from "@/lib/validation";
import {
  MAX_FILE_SIZE,
  saveMediaUpload,
  UploadValidationError,
} from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const parsed = mediaQuerySchema.safeParse({
    search: url.searchParams.get("search") || undefined,
    mime_type: url.searchParams.get("mime_type") || undefined,
    cursor: url.searchParams.get("cursor") || undefined,
    limit: url.searchParams.get("limit") || undefined,
  });

  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  const result = listMedia(parsed.data);
  return NextResponse.json({
    success: true,
    items: result.items,
    total: result.total,
    nextCursor: result.nextCursor,
  });
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: "Invalid form data submission." },
        { status: 400 }
      );
    }

    const fileEntry = formData.get("file");
    if (!fileEntry || !(fileEntry instanceof Blob)) {
      return NextResponse.json(
        { error: "No file provided in form data." },
        { status: 400 }
      );
    }

    const altText = String(formData.get("alt_text") || "");
    const caption = String(formData.get("caption") || "");
    const sortOrderParam = formData.get("sort_order");
    const sortOrder = sortOrderParam ? parseInt(String(sortOrderParam), 10) : 0;

    if (fileEntry.size === 0) {
      return NextResponse.json(
        { error: "Uploaded file is empty." },
        { status: 400 }
      );
    }

    if (fileEntry.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 5MB limit (${fileEntry.size} bytes).` },
        { status: 413 }
      );
    }

    const arrayBuffer = await fileEntry.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    if (fileBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 5MB limit (${fileBuffer.length} bytes).` },
        { status: 413 }
      );
    }

    const originalFilename =
      fileEntry instanceof File ? fileEntry.name : "upload.jpg";
    const declaredMimeType = fileEntry.type;

    try {
      const upload = await saveMediaUpload({
        fileBuffer,
        originalFilename,
        declaredMimeType,
        altText,
        caption,
        sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      });

      return NextResponse.json({ success: true, asset: upload, ...upload }, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof UploadValidationError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      const message = err instanceof Error ? err.message : "Upload failed.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json || typeof json !== "object") {
      return NextResponse.json({ error: "Invalid JSON submission." }, { status: 400 });
    }

    const rawBase64 = (json.base64_data || json.base64Data || json.file_base64) as string | undefined;
    const rawBinary = (json.binary_data || json.binaryData) as unknown;
    let fileBuffer: Buffer | null = null;

    if (rawBase64 && typeof rawBase64 === "string") {
      fileBuffer = Buffer.from(rawBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, ""), "base64");
    } else if (rawBinary) {
      if (Array.isArray(rawBinary)) {
        fileBuffer = Buffer.from(rawBinary as number[]);
      } else if (typeof rawBinary === "string") {
        fileBuffer = /^[0-9a-fA-F]+$/.test(rawBinary) && rawBinary.length % 2 === 0
          ? Buffer.from(rawBinary, "hex")
          : Buffer.from(rawBinary.replace(/^data:image\/[a-zA-Z+]+;base64,/, ""), "base64");
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json(
        { error: "No image payload found. Provide base64_data or binary_data." },
        { status: 400 }
      );
    }

    if (fileBuffer.length > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File size exceeds 5MB limit (${fileBuffer.length} bytes).` },
        { status: 413 }
      );
    }

    const originalFilename = String(json.filename || json.original_name || json.originalFilename || "upload.jpg");
    const altText = String(json.alt_text || json.altText || "");
    const caption = String(json.caption || "");
    const sortOrder = typeof json.sort_order === "number" ? json.sort_order : 0;

    try {
      const upload = await saveMediaUpload({
        fileBuffer,
        originalFilename,
        altText,
        caption,
        sortOrder,
      });

      return NextResponse.json({ success: true, asset: upload, ...upload }, { status: 201 });
    } catch (err: unknown) {
      if (err instanceof UploadValidationError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      const message = err instanceof Error ? err.message : "Upload failed.";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unsupported content type. Expected multipart/form-data or application/json." }, { status: 415 });
}
