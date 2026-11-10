import { NextResponse } from "next/server";
import { guard, invalid } from "@/lib/adminHttp";
import { PrivateLabelService } from "@/lib/private-label/service";
import { adminValidateReleaseSchema } from "@/lib/private-label/schemas";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const unauthorized = guard(request);
  if (unauthorized) return unauthorized;

  const { searchParams } = new URL(request.url);
  const rawParams = {
    order_id: searchParams.get("order_id") || undefined,
    orderId: searchParams.get("orderId") || undefined,
  };

  const parsed = adminValidateReleaseSchema.safeParse(rawParams);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  const orderId = parsed.data.order_id || parsed.data.orderId;
  if (!orderId) {
    return invalid({ order_id: ["order_id query param is required"] });
  }

  try {
    const result = PrivateLabelService.validateReleaseGate(orderId);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
