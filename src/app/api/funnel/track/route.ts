import { NextResponse } from "next/server";
import { rateLimitResponse } from "@/lib/rateLimit";
import { sameOrigin } from "@/lib/international/http";
import { resolveGeo } from "@/lib/geo";
import { funnelTrackEventSchema } from "@/lib/funnel/types";
import {
  extractAttributionFromRequest,
  recordConversationEvent,
  recordFunnelEvent,
} from "@/lib/funnel/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const limited = rateLimitResponse(request, "funnel_track", 120);
  if (limited) return limited;

  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Forbidden origin." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = funnelTrackEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid funnel event payload.", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const data = parsed.data;
    const attr = extractAttributionFromRequest(request, body, data.path);
    const geo = await resolveGeo(request);

    if (data.conversation) {
      const result = recordConversationEvent({
        sessionId: data.sessionId || attr.sessionId,
        channel: data.conversation.channel,
        sourcePage: data.conversation.sourcePage || data.path,
        referenceCode: data.conversation.referenceCode,
        customerName: data.conversation.customerName,
        customerEmail: data.conversation.customerEmail,
        customerPhone: data.conversation.customerPhone,
        messagePreview: data.conversation.messagePreview,
        linkedEntityType: data.entityType,
        linkedEntityId: data.entityId,
        attribution: { ...attr, sessionId: data.sessionId || attr.sessionId },
      });
      return NextResponse.json({ ok: true, id: result.id, sessionId: result.sessionId }, { status: 201 });
    }

    const recorded = recordFunnelEvent({
      sessionId: data.sessionId || attr.sessionId,
      eventId: data.eventId,
      funnelName: data.funnelName || attr.funnelName,
      funnelStage: data.funnelStage,
      eventName: data.eventName,
      entityType: data.entityType,
      entityId: data.entityId,
      path: data.path,
      valuePaise: data.valuePaise,
      currency: data.currency,
      attribution: { ...attr, sessionId: data.sessionId || attr.sessionId },
      geo: { country: geo.country, region: geo.region, city: geo.city },
      metadata: data.metadata,
    });

    return NextResponse.json({ ok: true, id: recorded.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Unable to record funnel event." }, { status: 500 });
  }
}
