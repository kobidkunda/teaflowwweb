import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { getCartByRecoveryToken } from "@/lib/leads";

export const runtime = "nodejs";

export async function GET(request: Request) {
  // 1. Rate limiting: 60 requests/minute per client
  const limited = rateLimitResponse(request, "cart_recover", 60);
  if (limited) return limited;

  // 2. Parse query parameters
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token")?.trim();

  if (!token) {
    return NextResponse.json(
      { error: "Recovery token is required." },
      { status: 400 }
    );
  }

  // 3. Lookup cart by recovery token
  try {
    const recovered = getCartByRecoveryToken(token);
    if (!recovered) {
      return NextResponse.json(
        { error: "Cart recovery token not found or expired." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      cart: {
        id: recovered.id,
        sessionId: recovered.sessionId,
        status: recovered.status,
        subtotalPaise: recovered.subtotalPaise,
        itemCount: recovered.itemCount,
        appliedCouponCode: recovered.appliedCouponCode,
        customerPhone: recovered.customerPhone,
        customerName: recovered.customerName,
      },
      items: recovered.items,
      couponCode: recovered.appliedCouponCode,
    });
  } catch {
    return NextResponse.json(
      { error: "Unable to recover cart." },
      { status: 500 }
    );
  }
}
