/**
 * Admin Private Label Studio — Catalogue Media Upload API
 *
 * POST /api/v1/admin/private-label/catalogue/upload
 * Supports:
 * - multipart/form-data (direct file upload from Admin UI file input)
 * - application/json (Base64 data or image_url from API / MCP callers)
 * Optionally attaches to a packaging variant if packaging_id or variant_id is provided.
 */

import { NextResponse } from "next/server";
import { guard } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import {
  saveMediaUpload,
  savePdfUpload,
  detectPdfMimeType,
  MAX_FILE_SIZE,
  MAX_PDF_SIZE,
} from "@/lib/uploads";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  PrivateLabelNotFoundError,
  PrivateLabelRevisionConflictError,
  type AuditActor,
} from "@/lib/private-label/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const user = getAdminUser(request);
  const actor: AuditActor = {
    actor_type: "admin",
    actor_id: user ? String(user.id) : "admin_session",
    actor_email: user?.username ? `${user.username}@teafloww.com` : "admin@teafloww.com",
    ip_address: request.headers.get("x-forwarded-for") || null,
  };

  const contentType = request.headers.get("content-type") || "";

  try {
    let fileBuffer: Buffer | null = null;
    let originalFilename = "upload.jpg";
    let imageType: "hero" | "dieline" = "hero";
    let packagingId: string | null = null;
    let expectedRevision: number | undefined = undefined;

    // 1. Multipart Form Data Handling
    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ error: "No file payload found in form-data." }, { status: 400 });
      }

      originalFilename = file.name || "upload.jpg";
      const bytes = await file.arrayBuffer();
      fileBuffer = Buffer.from(bytes);

      const typeField = formData.get("type") || formData.get("image_type");
      if (typeField === "dieline") imageType = "dieline";

      const packId = formData.get("packaging_id") || formData.get("variant_id") || formData.get("id");
      if (typeof packId === "string" && packId.trim()) packagingId = packId.trim();

      const rev = formData.get("expected_revision") || formData.get("expectedRevision");
      if (rev !== null && rev !== undefined && !isNaN(Number(rev))) {
        expectedRevision = Number(rev);
      }
    } else if (contentType.includes("application/json")) {
      // 2. JSON Base64 or Binary Handling
      const json = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!json || typeof json !== "object") {
        return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
      }

      const rawBase64 = (json.base64_data || json.base64Data || json.file_base64 || json.base64) as string | undefined;
      const rawBinary = (json.binary_data || json.binaryData) as unknown;

      if (rawBase64 && typeof rawBase64 === "string") {
        fileBuffer = Buffer.from(rawBase64.replace(/^data:([a-zA-Z0-9+/.-]+);base64,/, ""), "base64");
      } else if (rawBinary) {
        if (Array.isArray(rawBinary)) {
          fileBuffer = Buffer.from(rawBinary as number[]);
        } else if (typeof rawBinary === "string") {
          fileBuffer = /^[0-9a-fA-F]+$/.test(rawBinary) && rawBinary.length % 2 === 0
            ? Buffer.from(rawBinary, "hex")
            : Buffer.from(rawBinary.replace(/^data:([a-zA-Z0-9+/.-]+);base64,/, ""), "base64");
        }
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return NextResponse.json(
          { error: "No file payload found. Provide base64_data or binary_data." },
          { status: 400 }
        );
      }

      originalFilename = String(json.filename || json.original_name || json.originalFilename || "upload.jpg");
      if (json.type === "dieline" || json.image_type === "dieline") {
        imageType = "dieline";
      }

      const packId = json.packaging_id || json.variant_id || json.id;
      if (typeof packId === "string" && packId.trim()) packagingId = packId.trim();

      if (json.expected_revision !== undefined && !isNaN(Number(json.expected_revision))) {
        expectedRevision = Number(json.expected_revision);
      }
    } else {
      return NextResponse.json(
        { error: "Unsupported Content-Type. Use multipart/form-data or application/json." },
        { status: 415 }
      );
    }

    // Verify buffer exists and size constraints
    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ error: "File buffer is empty." }, { status: 400 });
    }

    const isPdf =
      detectPdfMimeType(fileBuffer) !== null ||
      originalFilename.toLowerCase().endsWith(".pdf") ||
      imageType === "dieline";

    const maxSize = isPdf ? MAX_PDF_SIZE : MAX_FILE_SIZE;
    if (fileBuffer.length > maxSize) {
      return NextResponse.json(
        { error: `File size exceeds ${isPdf ? "15MB" : "5MB"} limit (${fileBuffer.length} bytes).` },
        { status: 413 }
      );
    }

    // Save using appropriate storage pipeline
    const uploadResult = isPdf
      ? await savePdfUpload({
          fileBuffer,
          originalFilename,
          altText: `Private Label Dieline: ${originalFilename}`,
        })
      : await saveMediaUpload({
          fileBuffer,
          originalFilename,
          altText: `Private Label Packaging: ${originalFilename}`,
        });

    const fileUrl = uploadResult.url;

    // If packagingId provided, attach directly to the variant
    let updatedVariant = undefined;
    if (packagingId) {
      updatedVariant = PrivateLabelService.attachPackagingImage(
        packagingId,
        fileUrl,
        imageType,
        actor,
        expectedRevision
      );
    }

    return NextResponse.json(
      {
        success: true,
        url: fileUrl,
        filename: uploadResult.original_name,
        mime_type: uploadResult.mime_type,
        size: uploadResult.file_size,
        image_type: imageType,
        variant: updatedVariant,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof PrivateLabelRevisionConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          current_revision: error.current_revision,
          expected_revision: error.expected_revision,
        },
        { status: 409 }
      );
    }
    const message = error instanceof Error ? error.message : "Internal server error during upload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
