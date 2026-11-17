import { gate, body as readBody } from "@/lib/international/http";
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { createTradeEnquiry } from "@/lib/trade/quotes";
import {
  buildCompactAttributionPayload,
  extractAttributionFromRequest,
} from "@/lib/funnel/server";
import { dispatchNotificationEvent } from "@/lib/notifications/dispatch";

export const runtime = "nodejs";

const TRADE_SESSION_COOKIE = "tf_trade_sid";

export async function POST(req: NextRequest) {
  const denied = gate(req); if (denied) return denied;
  try {
    const body = await readBody(req);
    const cookieStore = await cookies();
    let sessionId = cookieStore.get(TRADE_SESSION_COOKIE)?.value;
    let isNewSession = false;
    if (!sessionId || sessionId.length < 8) {
      sessionId = `ts_${randomUUID().replace(/-/g, "")}`;
      isNewSession = true;
    }

    const attribution = extractAttributionFromRequest(req, body, "/tea-shops");
    const result = createTradeEnquiry(body, sessionId, attribution);

    if (!result.deduped && result.enquiry) {
      const enq = result.enquiry as Record<string, unknown>;
      try {
        dispatchNotificationEvent({
          event: "bulk_order",
          source: "trade_tea_shops",
          referenceId: String(enq.id || ""),
          summary: `Tea shop enquiry ${String(enq.id || "")} from ${String(
            enq.contact_name || enq.contact_phone || "Shop owner"
          )} (PIN ${String(enq.destination_pin || "")})`,
          data: {
            enquiryId: enq.id,
            locale: enq.locale,
            pin: enq.destination_pin,
            contactName: enq.contact_name,
            contactPhone: enq.contact_phone,
            ctaSource: enq.cta_source || "",
            attribution: buildCompactAttributionPayload(attribution),
          },
          dedupeKey: String(enq.id || ""),
        });
      } catch {
        // Non-fatal notification dispatch
      }
    }

    const res = NextResponse.json(result, { status: result.deduped ? 200 : 201 });
    if (isNewSession) {
      res.cookies.set(TRADE_SESSION_COOKIE, sessionId, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }
    return res;
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: "Invalid enquiry request.", issues: err.issues },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Unable to submit enquiry right now." },
      { status: 500 }
    );
  }
}
