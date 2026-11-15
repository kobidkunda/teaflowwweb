import { z } from "zod";
import { getDb } from "@/lib/db";
import { dispatchNotificationEvent } from "@/lib/notifications/dispatch";
import {
  buildCompactAttributionPayload,
  getTableColumns,
  safeRecordEntityAttribution,
  type ExtractedRequestAttribution,
} from "@/lib/funnel/server";

export const newsletterSchema = z.object({
  email: z.string().trim().max(254).email().transform((value) => value.toLowerCase()),
  consent: z.literal(true),
}).strict();

export function saveNewsletterPreference(
  email: string,
  consentText: string,
  attribution?: ExtractedRequestAttribution
) {
  const db = getDb();
  const cols = getTableColumns(db, "newsletter_subscriptions");
  const lastTouch = attribution?.lastTouch || attribution?.firstTouch;

  // Duplicate requests have the same outcome and never reveal membership.
  const info = cols.has("utm_source")
    ? db
        .prepare(
          `INSERT OR IGNORE INTO newsletter_subscriptions (
            email, consent_version, consent_text,
            session_id, utm_source, utm_medium, utm_campaign, utm_term, utm_content, gclid, fbclid, landing_page, funnel_name
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(
          email,
          "homepage-v1",
          consentText,
          attribution?.sessionId || null,
          lastTouch?.utm_source || "",
          lastTouch?.utm_medium || "",
          lastTouch?.utm_campaign || "",
          lastTouch?.utm_term || "",
          lastTouch?.utm_content || "",
          lastTouch?.gclid || "",
          lastTouch?.fbclid || "",
          lastTouch?.landing_page || "",
          attribution?.funnelName || "newsletter"
        )
    : db
        .prepare("INSERT OR IGNORE INTO newsletter_subscriptions (email,consent_version,consent_text) VALUES (?,?,?)")
        .run(email, "homepage-v1", consentText);

  safeRecordEntityAttribution({
    entityType: "newsletter",
    entityId: email,
    attribution,
    funnelName: attribution?.funnelName || "newsletter",
    funnelStage: "form_submit",
    eventName: "newsletter_subscribe",
    path: lastTouch?.landing_page || "/",
    customerEmail: email,
  });

  if (info.changes > 0) {
    dispatchNotificationEvent({
      event: "newsletter",
      source: "/api/newsletter",
      summary: `New newsletter subscriber: ${email}`,
      data: {
        email,
        consentVersion: "homepage-v1",
        consentText,
        attribution: buildCompactAttributionPayload(attribution),
      },
      dedupeKey: email,
    });
  }
}
