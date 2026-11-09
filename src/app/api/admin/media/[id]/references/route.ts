import { NextResponse } from "next/server";
import { guard, notFound } from "@/lib/adminHttp";
import { getMediaById, checkMediaReferences } from "@/lib/media";

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

  const audit = checkMediaReferences(id, asset.url);

  return NextResponse.json({
    success: true,
    id,
    ...audit,
  });
}
