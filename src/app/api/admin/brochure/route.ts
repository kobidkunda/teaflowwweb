import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import {
  getBrochureSettings,
  updateBrochureSettings,
} from "@/lib/brochure";
import { savePdfUpload, validatePdfUpload } from "@/lib/uploads";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

const jsonSchema = z.object({
  brochure_url: z.string().trim().max(500).nullable().optional(),
  brochure_title: z.string().trim().min(1, "Title is required").max(200).optional(),
  brochure_description: z.string().trim().max(1000).optional(),
  brochure_button_label: z.string().trim().min(1).max(100).optional(),
  brochure_enabled: z.boolean().optional(),
});

export async function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const settings = getBrochureSettings();
    const db = getDb();
    let recentPdfs: Array<{ id: number; filename: string; original_name?: string; url: string; file_size: number; created_at?: string }> = [];

    try {
      recentPdfs = db
        .prepare(
          "SELECT id, filename, original_name, url, file_size, created_at FROM media_uploads WHERE mime_type = 'application/pdf' OR filename LIKE '%.pdf' ORDER BY id DESC LIMIT 15"
        )
        .all() as typeof recentPdfs;
    } catch {
      recentPdfs = [];
    }

    return NextResponse.json({
      success: true,
      settings,
      recentPdfs,
    });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to load brochure settings.");
  }
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const contentType = request.headers.get("content-type") || "";

  // 1. Multipart Form Data (Direct PDF File Upload)
  if (contentType.includes("multipart/form-data")) {
    try {
      const formData = await request.formData();
      const file = formData.get("file");

      let uploadedUrl: string | undefined;
      let uploadedSize: number | undefined;

      if (file && typeof file === "object" && "arrayBuffer" in file && file.size > 0) {
        const fileObj = file as File;
        const arrayBuf = await fileObj.arrayBuffer();
        const fileBuffer = Buffer.from(arrayBuf);
        const originalFilename = fileObj.name || "teafloww-catalogue.pdf";

        validatePdfUpload(fileBuffer, {
          originalFilename,
          declaredMimeType: fileObj.type,
        });

        const customTitle = formData.get("title")?.toString().trim() || "";

        const uploadRecord = await savePdfUpload({
          fileBuffer,
          originalFilename,
          declaredMimeType: "application/pdf",
          altText: customTitle || originalFilename,
          caption: "Storefront brochure catalogue",
        });

        uploadedUrl = uploadRecord.url;
        uploadedSize = uploadRecord.file_size;
      }

      const rawTitle = formData.get("title")?.toString();
      const rawDescription = formData.get("description")?.toString();
      const rawButtonLabel = formData.get("button_label")?.toString();
      const rawEnabled = formData.get("enabled");

      const updateInput: Parameters<typeof updateBrochureSettings>[0] = {};

      if (uploadedUrl) {
        updateInput.url = uploadedUrl;
        updateInput.file_size = uploadedSize;
      } else if (formData.has("url")) {
        updateInput.url = formData.get("url")?.toString() || null;
      }

      if (rawTitle !== undefined && rawTitle.trim()) {
        updateInput.title = rawTitle.trim();
      }
      if (rawDescription !== undefined) {
        updateInput.description = rawDescription.trim();
      }
      if (rawButtonLabel !== undefined && rawButtonLabel.trim()) {
        updateInput.button_label = rawButtonLabel.trim();
      }
      if (rawEnabled !== null && rawEnabled !== undefined) {
        updateInput.enabled = rawEnabled === "true" || rawEnabled === "1";
      }

      const updated = updateBrochureSettings(updateInput);
      return NextResponse.json({ success: true, settings: updated });
    } catch (e) {
      return conflict(e instanceof Error ? e.message : "Unable to process brochure upload.");
    }
  }

  // 2. Application/JSON (Configuration / URL updates)
  const body: unknown = await request.json().catch(() => null);
  const parsed = jsonSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  try {
    const updated = updateBrochureSettings({
      url: parsed.data.brochure_url,
      title: parsed.data.brochure_title,
      description: parsed.data.brochure_description,
      button_label: parsed.data.brochure_button_label,
      enabled: parsed.data.brochure_enabled,
    });
    return NextResponse.json({ success: true, settings: updated });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to save brochure settings.");
  }
}

export async function DELETE(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const updated = updateBrochureSettings({
      enabled: false,
    });
    return NextResponse.json({ success: true, settings: updated, message: "Brochure catalog disabled on website." });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to disable brochure.");
  }
}
