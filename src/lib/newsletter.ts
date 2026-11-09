import { z } from "zod";
import { getDb } from "@/lib/db";
export const newsletterSchema = z.object({
  email: z.string().trim().max(254).email().transform((value) => value.toLowerCase()),
  consent: z.literal(true),
}).strict();
export function saveNewsletterPreference(email: string, consentText: string) {
  // Duplicate requests have the same outcome and never reveal membership.
  getDb().prepare("INSERT OR IGNORE INTO newsletter_subscriptions (email,consent_version,consent_text) VALUES (?,?,?)")
    .run(email, "homepage-v1", consentText);
}
