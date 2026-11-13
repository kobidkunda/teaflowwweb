import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { cartSyncSchema, syncAbandonedCart } from "@/lib/abandonedCarts";
import { resolveGeo } from "@/lib/geo";

export const runtime = "nodejs";

export async function POST(request: Request) {
  // 1. Rate limiting: 60 requests/minute per client
  const limited = rateLimitResponse(request, "cartSync", 60);
  if (limited) return limited;

  // 2. Parse & validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = cartSyncSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid cart sync payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // 3. Extract Geolocation and User-Agent
  const geo = await resolveGeo(request);
  const userAgent = request.headers.get("user-agent") || "";

  // 4. Atomic abandoned cart synchronization
  try {
    const result = syncAbandonedCart({
      sessionId: parsed.data.sessionId,
      fingerprint: parsed.data.fingerprint,
      items: parsed.data.items,
      customer: parsed.data.customer,
      geo,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      cartId: result.cartId,
      recoveryToken: result.recoveryToken,
      status: result.status,
      subtotalPaise: result.subtotalPaise,
      itemCount: result.itemCount,
    });
  } catch {
    // Return sanitized error without exposing raw database exceptions
    return NextResponse.json({ error: "Unable to sync cart." }, { status: 500 });
  }
}
