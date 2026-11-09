import { z } from "zod";
import { getDb } from "@/lib/db";
import { getStoreSettings } from "@/lib/storeSettings";
import { BRAND_LOGOS } from "@/lib/brandLogos";

export const EMAIL_TEMPLATE_KEYS = [
  "admin_password_reset",
  "order_confirmation",
  "commerce_order_received",
  "commerce_payment_review",
  "order_shipped",
  "contact_acknowledgement",
  "wholesale_acknowledgement",
  "newsletter_welcome",
  "abandoned_cart_recovery",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];

export interface EmailTemplate {
  key: string;
  label: string;
  description: string;
  subject: string;
  html_body: string;
  text_body: string;
  variables: string[];
  updated_at: string;
}

export const emailTemplateSchema = z.object({
  subject: z.string().trim().min(3, "Subject is required").max(200),
  html_body: z.string().trim().min(10, "HTML body is required").max(50000),
  text_body: z.string().trim().min(10, "Text body is required").max(20000),
});

export type EmailTemplateInput = z.infer<typeof emailTemplateSchema>;

// Prompt-to-draft generator input (admin UI + MCP share this contract).
export const emailGenerateSchema = z.object({
  template_key: z.string().min(1).max(80).optional(),
  goal: z.string().trim().min(8, "Describe the email goal in a few words").max(2000),
  tone: z.enum(["warm", "formal", "festive", "minimal"]).default("warm"),
  call_to_action: z.string().trim().max(200).optional(),
  logo_id: z.number().int().min(1).max(100).optional(),
});

export type EmailGenerateInput = z.infer<typeof emailGenerateSchema>;

function rowToTemplate(row: Record<string, unknown>): EmailTemplate {
  let variables: string[] = [];
  try {
    const parsed: unknown = JSON.parse(String(row.variables_json ?? "[]"));
    if (Array.isArray(parsed)) variables = parsed.filter((v): v is string => typeof v === "string");
  } catch {
    variables = [];
  }
  return {
    key: String(row.key),
    label: String(row.label ?? row.key),
    description: String(row.description ?? ""),
    subject: String(row.subject ?? ""),
    html_body: String(row.html_body ?? ""),
    text_body: String(row.text_body ?? ""),
    variables,
    updated_at: String(row.updated_at ?? ""),
  };
}

export function listEmailTemplates(): EmailTemplate[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT key, label, description, subject, html_body, text_body, variables_json, updated_at FROM email_templates ORDER BY key")
    .all() as Array<Record<string, unknown>>;
  return rows.map(rowToTemplate);
}

export function getEmailTemplate(key: string): EmailTemplate | null {
  const clean = key.trim().slice(0, 80);
  if (!clean) return null;
  const db = getDb();
  const row = db
    .prepare("SELECT key, label, description, subject, html_body, text_body, variables_json, updated_at FROM email_templates WHERE key = ?")
    .get(clean) as Record<string, unknown> | undefined;
  return row ? rowToTemplate(row) : null;
}

export function updateEmailTemplate(key: string, input: EmailTemplateInput): EmailTemplate {
  const clean = key.trim().slice(0, 80);
  const existing = getEmailTemplate(clean);
  if (!existing) throw new Error("Email template not found.");
  const parsed = emailTemplateSchema.parse(input);
  // Union declared variables ({{name}} in any field) with the seeded list so
  // the editor always shows accurate insert chips.
  const found = new Set(existing.variables);
  for (const field of [parsed.subject, parsed.html_body, parsed.text_body]) {
    for (const m of field.matchAll(/\{\{\s*#?\/?([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g)) {
      if (m[1] && m[1] !== "logo") found.add(m[1]);
    }
  }
  if (!found.has("store_name")) found.add("store_name");
  if (!found.has("support_email")) found.add("support_email");
  if (!found.has("logo_url")) found.add("logo_url");
  const db = getDb();
  db.prepare(
    "UPDATE email_templates SET subject = ?, html_body = ?, text_body = ?, variables_json = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?"
  ).run(parsed.subject, parsed.html_body, parsed.text_body, JSON.stringify([...found].sort()), clean);
  const updated = getEmailTemplate(clean);
  if (!updated) throw new Error("Email template not found.");
  return updated;
}

/** Default render context shared by every template (brand + support contact). */
export function defaultEmailContext(): Record<string, string> {
  const settings = getStoreSettings();
  return {
    store_name: settings.store_name || "TeaFloww",
    support_email: settings.contact_email || "info@teafloww.com",
    logo_url: defaultLogoUrl(),
  };
}

export function defaultLogoUrl(): string {
  const base = (process.env.APP_BASE_URL || process.env.FEED_BASE_URL || "https://teafloww.com").trim().replace(/\/+$/, "");
  // Light forest-green lockup reads best on the cream email canvas.
  const logo = BRAND_LOGOS.find((l) => l.filename === "08_light_forest_green") ?? BRAND_LOGOS[0];
  return base + (logo?.pngUrl || "/logo/png/08_light_forest_green.png");
}

export function listLogoOptions(): Array<{ id: number; name: string; category: string; pngUrl: string; absoluteUrl: string; description: string }> {
  const base = (process.env.APP_BASE_URL || process.env.FEED_BASE_URL || "https://teafloww.com").trim().replace(/\/+$/, "");
  return BRAND_LOGOS.map((l) => ({
    id: l.id,
    name: l.name,
    category: l.category,
    pngUrl: l.pngUrl,
    absoluteUrl: base + l.pngUrl,
    description: l.description,
  }));
}

/**
 * Minimal {{variable}} renderer. Unknown keys render as empty string.
 * Supports the one {{#logo}}...{{/logo}} conditional used by the reset
 * template (emitted only when logo_url is non-empty).
 */
export function renderEmailTemplate(
  template: Pick<EmailTemplate, "subject" | "html_body" | "text_body">,
  vars: Record<string, string | number | null | undefined>
): { subject: string; html: string; text: string } {
  const ctx: Record<string, string> = { ...defaultEmailContext() };
  for (const [k, v] of Object.entries(vars)) {
    if (v === null || v === undefined) continue;
    ctx[k] = String(v);
  }
  const fill = (src: string): string => {
    let out = src;
    // {{#logo}}...{{/logo}} conditional block
    out = out.replace(/\{\{#logo\}\}([\s\S]*?)\{\{\/logo\}\}/g, (_m, inner: string) =>
      ctx.logo_url ? inner : ""
    );
    out = out.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_m, name: string) => ctx[name] ?? "");
    return out;
  };
  return { subject: fill(template.subject), html: fill(template.html_body), text: fill(template.text_body) };
}

// ---------------------------------------------------------------------------
// Prompt → draft generator (deterministic, no new deps / no external LLM).
// The admin editor calls this for instant drafts; the same copy contract is
// exposed as the MCP `email-template-composer` prompt so agents generate
// on-brand copy that operators paste back into the editor.
// ---------------------------------------------------------------------------

const TONE_OPENERS: Record<string, string> = {
  warm: "A warm note from our Siliguri tasting room",
  formal: "A brief update from TeaFloww (Nirva)",
  festive: "A festive pour from the Himalayan harvest",
  minimal: "A quick note",
};

export function generateEmailDraft(input: EmailGenerateInput): { subject: string; html_body: string; text_body: string; variables: string[] } {
  const parsed = emailGenerateSchema.parse(input);
  const goal = parsed.goal.trim();
  const tone = parsed.tone;
  const cta = parsed.call_to_action?.trim() || "Reply to {{support_email}} with your order reference.";
  const logo = parsed.logo_id ? BRAND_LOGOS.find((l) => l.id === parsed.logo_id) : undefined;
  const logoFile = logo?.pngUrl || "/logo/png/08_light_forest_green.png";
  const base = (process.env.APP_BASE_URL || process.env.FEED_BASE_URL || "https://teafloww.com").trim().replace(/\/+$/, "");
  const logoUrl = base + logoFile;

  const oneLineGoal = goal.replace(/\s+/g, " ").slice(0, 140);
  const subject = `${oneLineGoal.slice(0, 70)} — TeaFloww`;
  const opener = TONE_OPENERS[tone] ?? TONE_OPENERS.warm;

  const html_body =
    `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#1d2a24">` +
    `<p><img src="${logoUrl}" alt="{{store_name}} logo" width="120" style="max-width:120px"/></p>` +
    `<p style="color:#55604f;font-size:12px;letter-spacing:.12em;text-transform:uppercase">${opener}</p>` +
    `<h2 style="margin:0 0 8px">${escapeHtml(oneLineGoal)}</h2>` +
    `<p>${escapeHtml(goal)}</p>` +
    `<p>${escapeHtml(cta)}</p>` +
    `<p style="color:#63665e;font-size:12px">— {{store_name}} · {{support_email}}</p></div>`;

  const text_body =
    `${opener}\n\n${goal}\n\n${cta}\n\n— {{store_name}} · {{support_email}}`;

  return {
    subject,
    html_body,
    text_body,
    variables: ["store_name", "support_email", "logo_url"],
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function emailTemplateCompletion(prefix: string): string[] {
  const p = prefix.toLowerCase();
  return EMAIL_TEMPLATE_KEYS.filter((k) => k.toLowerCase().includes(p));
}
