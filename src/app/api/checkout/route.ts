import { NextResponse } from "next/server";
import { checkoutSchema } from "@/lib/validation";
import { createDemoOrder, CheckoutError } from "@/lib/checkout";
import { rateLimitResponse, RATE_LIMITS } from "@/lib/rateLimit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "checkout", RATE_LIMITS.checkout);
  if (limited) return limited;
  try {
    const body: unknown = await request.json();
    const parsed = checkoutSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Please check the checkout fields and quantities." }, { status: 400 });
    const result = createDemoOrder(parsed.data);
    return NextResponse.json({ ...result, status: "demo_unpaid", paymentCollected: false }, { status: result.deduped ? 200 : 201 });
  } catch (error) {
    if (error instanceof CheckoutError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Unable to create the demo order." }, { status: 500 });
  }
}
