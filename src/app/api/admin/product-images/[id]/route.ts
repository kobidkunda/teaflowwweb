import { NextResponse } from "next/server";
import { listProductImages, updateProductImage, deleteProductImage } from "@/lib/productImages";
import { productImageSchema } from "@/lib/validation";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  const image = listProductImages().find((r) => r.id === Number(id));
  return image ? NextResponse.json({ image }) : notFound("Image not found.");
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  const body: unknown = await request.json().catch(() => null);
  const parsed = productImageSchema.partial().safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  try {
    const image = updateProductImage(Number(id), parsed.data);
    return image ? NextResponse.json({ image }) : notFound("Image not found.");
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to update the image.");
  }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  return deleteProductImage(Number(id)) ? new NextResponse(null, { status: 204 }) : notFound("Image not found.");
}
