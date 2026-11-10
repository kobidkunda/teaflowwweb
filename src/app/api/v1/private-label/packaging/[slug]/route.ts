import { NextResponse } from "next/server";
import { PrivateLabelService } from "@/lib/private-label/service";
import { PrivateLabelNotFoundError } from "@/lib/private-label/types";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug?.trim()) {
      return NextResponse.json(
        { error: "Packaging slug is required" },
        { status: 400 }
      );
    }

    const detail = PrivateLabelService.getPublicPackagingVariantBySlug(slug.trim());
    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    if (error instanceof PrivateLabelNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
