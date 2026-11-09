import { NextResponse } from "next/server";
import { listProductImages, upsertProductImage } from "@/lib/productImages";
import { productImageSchema } from "@/lib/validation";
import { guard, invalid, conflict, keyOf } from "@/lib/adminHttp";
export const runtime = "nodejs";
export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const url = new URL(request.url);
  const productId = parseInt(url.searchParams.get("productId") || "", 10);
  return NextResponse.json({ images: listProductImages(Number.isFinite(productId) ? productId : undefined) });
}
export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;
  const body: unknown = await request.json().catch(() => null);
  const parsed = productImageSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const result = upsertProductImage({ ...parsed.data, idempotencyKey: keyOf(request, parsed.data) });
    return NextResponse.json(result, { status: result.deduped ? 200 : 201 });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to save the image.");
  }
}
