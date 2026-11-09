import { NextResponse } from "next/server";
import { getVariant, updateVariant, deleteVariant } from "@/lib/products";
import { variantSchema } from "@/lib/validation";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  const variant = getVariant(Number(id));
  return variant ? NextResponse.json({ variant }) : notFound("Variant not found.");
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  if (!getVariant(Number(id))) return notFound("Variant not found.");
  const body: unknown = await request.json().catch(() => null);
  const parsed = variantSchema.partial().safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());
  return NextResponse.json({ variant: updateVariant(Number(id), parsed.data) });
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    return deleteVariant(Number(id)) ? new NextResponse(null, { status: 204 }) : notFound("Variant not found.");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("FOREIGN KEY") || msg.includes("constraint")) {
      return conflict("Cannot delete variant because orders or line items reference it.");
    }
    return conflict("Failed to delete variant.");
  }
}
