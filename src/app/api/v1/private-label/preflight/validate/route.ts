import { NextResponse } from "next/server";
import { PrivateLabelService } from "@/lib/private-label/service";
import { preflightValidateSchema } from "@/lib/private-label/schemas";

export async function POST(request: Request) {
  let body: unknown;

  try {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file provided" }, { status: 400 });
      }
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await PrivateLabelService.validatePreflight({
        buffer,
        mimeType: file.type || "application/octet-stream",
        originalFilename: file.name,
        fileSizeBytes: file.size,
      });

      const status = result.valid ? 200 : 422;
      return NextResponse.json(result, { status });
    }

    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON or body payload" }, { status: 400 });
  }

  const rawData =
    body && typeof body === "object" && "data" in body && typeof (body as Record<string, unknown>).data === "object"
      ? ((body as Record<string, unknown>).data as Record<string, unknown>)
      : (body as Record<string, unknown>);

  const parseResult = preflightValidateSchema.safeParse(rawData);
  if (!parseResult.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parseResult.error.format() },
      { status: 400 }
    );
  }

  const data = parseResult.data;
  const mimeType = data.mime_type || data.mimeType || "";
  const fileSizeBytes = data.file_size_bytes ?? data.fileSizeBytes;
  const widthPx = data.width_px ?? data.widthPx;
  const heightPx = data.height_px ?? data.heightPx;
  const targetWidthMm = data.target_width_mm ?? data.targetWidthMm;
  const targetHeightMm = data.target_height_mm ?? data.targetHeightMm;
  const fileData = data.file_data ?? data.fileData;
  const svgContent = data.svg_content ?? data.svgContent;
  const filename = data.filename || data.original_filename;
  const isEncrypted = data.is_encrypted ?? data.isEncrypted;

  const result = await PrivateLabelService.validatePreflight({
    mimeType,
    fileSizeBytes,
    widthPx,
    heightPx,
    targetWidthMm,
    targetHeightMm,
    fileData,
    svgContent,
    filename,
    isEncrypted,
  });

  if (!result.valid) {
    return NextResponse.json(
      {
        ...result,
        error: result.errors[0] || "Preflight validation failed",
        message: result.report_summary,
      },
      { status: 422 }
    );
  }

  return NextResponse.json(result, { status: 200 });
}
