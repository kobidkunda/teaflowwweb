import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, notFound } from "@/lib/adminHttp";
import { getProduct } from "@/lib/products";
import { replaceProductImages } from "@/lib/productImages";
import { galleryImageSchema } from "@/lib/validation";

export const runtime = "nodejs";
const imagesSchema = z.object({ images: z.array(galleryImageSchema).max(100) }).strict();
const idSchema = z.coerce.number().int().positive();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      const source = new URL(origin);
      // Next may use an internal bind URL behind the production reverse proxy.
      const host = request.headers.get("host") ?? new URL(request.url).host;
      if (!["http:", "https:"].includes(source.protocol) || source.host !== host) {
        return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 });
    }
  }
  const id = idSchema.safeParse((await params).id);
  const input = imagesSchema.safeParse(await request.json().catch(() => null));
  if (!id.success || !input.success) return invalid("A product ID and valid gallery images are required.");

  try {
    if (!getProduct(id.data)) return notFound("Product not found.");
    return NextResponse.json({ images: replaceProductImages(id.data, input.data.images) });
  } catch (error) {
    if (error instanceof Error && error.message === "Select variants belonging to this product.") {
      return invalid(error.message);
    }
    return NextResponse.json({ error: "Unable to save product images. Please try again." }, { status: 500 });
  }
}
