import { NextRequest, NextResponse } from "next/server";
import { intakeDraftSchema } from "@/lib/blend-lab/validation";
import { createProjectDraft } from "@/lib/blend-lab/projects";
import { dispatchNotificationEvent } from "@/lib/notifications/dispatch";
import {
  buildCompactAttributionPayload,
  extractAttributionFromRequest,
  safeRecordEntityAttribution,
} from "@/lib/funnel/server";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const json = await req.json();

    // Use Idempotency-Key header if provided, fallback to body
    const headerIdempotency = req.headers.get("idempotency-key");
    const payload = {
      ...json,
      idempotencyKey: headerIdempotency || json.idempotencyKey,
    };

    const parsed = intakeDraftSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed for intake draft",
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const attribution = extractAttributionFromRequest(req, json, "/blend-lab");
    const { project, reused } = createProjectDraft(parsed.data);

    if (!reused) {
      safeRecordEntityAttribution({
        entityType: "blend_lab",
        entityId: project.publicId,
        attribution,
        funnelName: "blend_lab",
        funnelStage: "form_submit",
        eventName: "blend_lab_draft",
        path: attribution.lastTouch.landing_page || "/blend-lab",
        customerName: (parsed.data as { contactName?: string; brandName?: string }).contactName || null,
        customerEmail: (parsed.data as { contactEmail?: string }).contactEmail || null,
        customerPhone: (parsed.data as { contactPhone?: string }).contactPhone || null,
      });

      dispatchNotificationEvent({
        event: "private_label",
        source: "/api/blend-lab/projects",
        referenceId: project.publicId,
        summary: `New Blend Lab draft: ${project.publicId}`,
        data: {
          projectId: project.publicId,
          payload: parsed.data,
          attribution: buildCompactAttributionPayload(attribution),
        },
        dedupeKey: `blend:${project.publicId}`,
      });
    }

    return NextResponse.json(
      {
        success: true,
        reused,
        project,
      },
      { status: reused ? 200 : 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create Blend Lab project draft";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}
