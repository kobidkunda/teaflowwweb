import { NextResponse } from "next/server";
import {
  MAX_FILE_SIZE,
  MAX_PDF_SIZE,
  UploadValidationError,
  saveMediaUpload,
  savePdfUpload,
  detectPdfMimeType,
  listMediaUploads,
  verifyAdminSessionCookie,
} from "@/lib/uploads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = verifyAdminSessionCookie(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(
    Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1),
    100
  );

  const uploads = listMediaUploads(limit);
  return NextResponse.json({ success: true, uploads });
}

export async function POST(request: Request) {
  // 1. Admin session authentication
  const user = verifyAdminSessionCookie(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const contentType = request.headers.get("content-type") || "";

  // 2. Support application/json (Base64 / Binary)
  if (contentType.includes("application/json")) {
    const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!json || typeof json !== "object") {
      return NextResponse.json({ error: "Invalid JSON submission." }, { status: 400 });
    }

    const rawBase64 = (json.base64_data || json.base64Data || json.file_base64 || json.base64) as string | undefined;
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
        { error: "No file payload found. Provide base64_data or binary_data." },
        { status: 400 }
      );
    }

    const originalFilename = String(json.filename || json.original_name || json.originalFilename || "upload.jpg");
    const isPdf =
      detectPdfMimeType(fileBuffer) !== null ||
      originalFilename.toLowerCase().endsWith(".pdf") ||
      String(json.mime_type || "").includes("pdf");
    const maxAllowedSize = isPdf ? MAX_PDF_SIZE : MAX_FILE_SIZE;

    if (fileBuffer.length > maxAllowedSize) {
      return NextResponse.json(
        { error: `File size exceeds ${isPdf ? "15MB" : "5MB"} limit (${fileBuffer.length} bytes).` },
        { status: 413 }
      );
    }

    const altText = String(json.alt_text || json.altText || "");
    const sortOrder = typeof json.sort_order === "number" ? json.sort_order : 0;

    try {
      const upload = isPdf
        ? await savePdfUpload({
            fileBuffer,
            originalFilename,
            altText,
            sortOrder,
          })
        : await saveMediaUpload({
            fileBuffer,
            originalFilename,
            altText,
            sortOrder,
          });

      const uploadPayload = {
        id: upload.id,
        filename: upload.filename,
        url: upload.url,
        alt_text: upload.alt_text,
        mime_type: upload.mime_type,
        file_size: upload.file_size,
        width: upload.width,
        height: upload.height,
      };

      return NextResponse.json(
        {
          success: true,
          upload: uploadPayload,
          ...uploadPayload,
        },
        { status: 201 }
      );
    } catch (err: unknown) {
      if (err instanceof UploadValidationError) {
        return NextResponse.json({ error: err.message }, { status: err.statusCode });
      }
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: message.slice(0, 160) }, { status: 400 });
    }
  }

  // 3. Parse multipart/form-data
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

  const altTextEntry = formData.get("alt_text");
  const altText = typeof altTextEntry === "string" ? altTextEntry : "";

  const sortOrderEntry = formData.get("sort_order");
  const sortOrder = sortOrderEntry ? parseInt(String(sortOrderEntry), 10) : 0;

  const originalFilename =
    fileEntry instanceof File ? fileEntry.name : "upload.jpg";
  const declaredMimeType = fileEntry.type || "";
  const isPdf =
    declaredMimeType.toLowerCase().includes("pdf") ||
    originalFilename.toLowerCase().endsWith(".pdf");
  const maxAllowedSize = isPdf ? MAX_PDF_SIZE : MAX_FILE_SIZE;

  // 3. Size check before arrayBuffer if available
  if (fileEntry.size === 0) {
    return NextResponse.json(
      { error: "Uploaded file is empty." },
      { status: 400 }
    );
  }

  if (fileEntry.size > maxAllowedSize) {
    return NextResponse.json(
      { error: `File size exceeds ${isPdf ? "15MB" : "5MB"} limit (${fileEntry.size} bytes).` },
      { status: 413 }
    );
  }

  const arrayBuffer = await fileEntry.arrayBuffer();
  const fileBuffer = Buffer.from(arrayBuffer);

  const confirmedIsPdf = isPdf || detectPdfMimeType(fileBuffer) !== null;
  const finalMaxSize = confirmedIsPdf ? MAX_PDF_SIZE : MAX_FILE_SIZE;

  if (fileBuffer.length > finalMaxSize) {
    return NextResponse.json(
      { error: `File size exceeds ${confirmedIsPdf ? "15MB" : "5MB"} limit (${fileBuffer.length} bytes).` },
      { status: 413 }
    );
  }

  // 4. Validate and save
  try {
    const upload = confirmedIsPdf
      ? await savePdfUpload({
          fileBuffer,
          originalFilename,
          declaredMimeType,
          altText,
          sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
        })
      : await saveMediaUpload({
          fileBuffer,
          originalFilename,
          declaredMimeType,
          altText,
          sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
        });

    const uploadPayload = {
      id: upload.id,
      filename: upload.filename,
      url: upload.url,
      alt_text: upload.alt_text,
      mime_type: upload.mime_type,
      file_size: upload.file_size,
    };

    return NextResponse.json(
      {
        success: true,
        upload: uploadPayload,
        ...uploadPayload,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    if (err instanceof UploadValidationError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode }
      );
    }

    const message = err instanceof Error ? err.message : String(err);
    // Sanitize any raw database errors
    const isRawDbError =
      /sqlite|database|constraint|unique|foreign|syntax|table|column|abort/i.test(
        message
      );

    return NextResponse.json(
      {
        error: isRawDbError
          ? "Unable to complete upload request."
          : message.slice(0, 160),
      },
      { status: 400 }
    );
  }
}
