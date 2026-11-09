import { NextResponse } from "next/server";
import { getAbandonedCartDetails, updateAbandonedCartStatus } from "@/lib/abandonedCarts";
import { guard } from "@/lib/adminHttp";
import { z } from "zod";

export const runtime = "nodejs";

const updateSchema = z.object({
  status: z.enum(["active", "abandoned", "contacted", "converted", "ignored"]),
  notes: z.string().max(500).optional(),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const details = getAbandonedCartDetails(id);
  if (!details) {
    return NextResponse.json({ error: "Cart not found" }, { status: 404 });
  }

  return NextResponse.json(details);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;

  try {
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid status or notes", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updated = updateAbandonedCartStatus({
      cart_id: id,
      status: parsed.data.status,
      notes: parsed.data.notes,
    });

    if (!updated) {
      return NextResponse.json({ error: "Cart not found" }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Failed to update cart status" }, { status: 500 });
  }
}
