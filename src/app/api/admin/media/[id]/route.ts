import { NextResponse } from "next/server";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import {
  getMediaById,
  updateMediaMetadata,
  checkMediaReferences,
  deleteMediaUploadSync,
} from "@/lib/media";
import { mediaUpdateSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id) || id <= 0) {
    return notFound("Invalid media asset ID.");
  }

  const asset = getMediaById(id);
  if (!asset) {
    return notFound("Media asset not found.");
  }

  return NextResponse.json({ success: true, asset });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id) || id <= 0) {
    return notFound("Invalid media asset ID.");
  }

  const existing = getMediaById(id);
  if (!existing) {
    return notFound("Media asset not found.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalid("Malformed JSON payload.");
  }

  const parsed = mediaUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  try {
    const updated = updateMediaMetadata(id, parsed.data);
    return NextResponse.json({ success: true, asset: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Update failed.";
    return invalid(message);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id: rawId } = await params;
  const id = parseInt(rawId, 10);
  if (Number.isNaN(id) || id <= 0) {
    return notFound("Invalid media asset ID.");
  }

  const existing = getMediaById(id);
  if (!existing) {
    return notFound("Media asset not found.");
  }

  const refCheck = checkMediaReferences(id, existing.url);
  if (refCheck.inUse) {
    return NextResponse.json(
      {
        error: `Cannot delete media asset: currently referenced by ${refCheck.totalReferences} active entity record(s). Remove all references first.`,
        inUse: true,
        totalReferences: refCheck.totalReferences,
        breakdown: refCheck.breakdown,
      },
      { status: 409 }
    );
  }

  try {
    const result = deleteMediaUploadSync(id);
    return NextResponse.json({ ...result });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Deletion failed.";
    return conflict(message);
  }
}
