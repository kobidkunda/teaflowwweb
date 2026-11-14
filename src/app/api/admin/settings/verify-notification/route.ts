import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import { dispatchNotificationEvent } from "@/lib/notifications/dispatch";
import { NOTIFICATION_EVENT_TYPES } from "@/lib/notifications/events";
import { processOneJob } from "@/lib/international/jobs";

export const runtime = "nodejs";

const testSchema = z.object({
  event: z.enum(NOTIFICATION_EVENT_TYPES).default("enquiry"),
});

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = testSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  try {
    const result = dispatchNotificationEvent({
      event: parsed.data.event,
      source: "/api/admin/settings/verify-notification",
      referenceId: `TEST-${Date.now().toString(36).toUpperCase()}`,
      summary: `Test notification for ${parsed.data.event}`,
      data: {
        test: true,
        event: parsed.data.event,
        triggeredBy: "admin-settings",
        sampleCustomer: "TeaFloww Test Desk",
        sampleEmail: "info@teafloww.com",
      },
      deferDrain: true,
    });

    let processed = 0;
    for (let i = 0; i < 10; i++) {
      const didRun = await processOneJob();
      if (!didRun) break;
      processed += 1;
    }

    return NextResponse.json({
      ok: true,
      queuedEmails: result.queuedEmails,
      queuedWebhooks: result.queuedWebhooks,
      processedJobs: processed,
    });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Failed to dispatch test notification.");
  }
}
