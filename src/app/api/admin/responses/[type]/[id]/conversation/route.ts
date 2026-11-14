import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import { getAdminUser } from "@/lib/adminAuth";
import { addAdminConversationEntry } from "@/lib/admin/responses";
import { NOTIFICATION_EVENT_TYPES, type NotificationEventType } from "@/lib/notifications/events";

export const runtime = "nodejs";

const postSchema = z.object({
  entryType: z.enum(["note", "reply_email", "customer_feedback"]),
  message: z.string().trim().min(1, "Message is required").max(4000),
  sendEmailTo: z.string().email().optional().nullable(),
  subject: z.string().trim().max(200).optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string; id: string }> }
) {
  const denied = guard(request);
  if (denied) return denied;

  const { type, id } = await params;
  if (!(NOTIFICATION_EVENT_TYPES as readonly string[]).includes(type)) {
    return invalid({ type: "Unsupported response category." });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return invalid(parsed.error.flatten());

  try {
    const decodedId = decodeURIComponent(id);
    const admin = getAdminUser(request);
    const result = await addAdminConversationEntry({
      entityType: type as NotificationEventType,
      entityId: decodedId,
      entryType: parsed.data.entryType,
      author: admin?.username || "admin",
      message: parsed.data.message,
      sendEmailTo: parsed.data.sendEmailTo ?? undefined,
      subject: parsed.data.subject,
    });
    return NextResponse.json({ ok: true, ...result }, { status: 201 });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to save conversation entry.");
  }
}
