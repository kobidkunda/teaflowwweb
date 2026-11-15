import { z } from "zod";
import { getDb } from "@/lib/db";
import { getStoreSettings } from "@/lib/storeSettings";
import { BRAND_LOGOS } from "@/lib/brandLogos";
import { buildBrandEmailHtml, buildBrandEmailText } from "@/lib/emailLayout";

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
  "subscription_renewal",
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

/**
 * Canonical brand email templates for all transactional touchpoints.
 * Shared by migrations, database seeders, and test suites.
 */
export function getCanonicalEmailTemplates(): Array<{
  key: EmailTemplateKey;
  label: string;
  description: string;
  subject: string;
  html_body: string;
  text_body: string;
  variables: string[];
}> {
  return [
    {
      key: "admin_password_reset",
      label: "Admin password reset",
      description: "Sent from /api/admin/forgot when staff request a password reset link.",
      subject: "TeaFloww admin password reset — expires in 60 minutes",
      variables: ["reset_link", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Security Notice",
        heading: "Reset your admin password",
        leadParagraph:
          "A password reset was requested for the TeaFloww admin console. This security link expires in 60 minutes:",
        table: {
          caption: "Security Specifications",
          columns: ["Detail", "Status"],
          rows: [
            ["Access Level", "Staff & Admin Console"],
            ["Link Validity", "Expires in 60 minutes"],
            ["Action Required", "One-time password update"],
          ],
        },
        ctaButton: {
          label: "Reset Admin Password",
          url: "{{reset_link}}",
        },
        secondaryNoteHtml:
          'If you did not request this, ignore this message. Contact {{support_email}} for help.<br><br>Direct link:<br><a href="{{reset_link}}" style="color:#23483a;word-break:break-all;">{{reset_link}}</a>',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Security Notice",
        heading: "Reset your admin password",
        leadParagraph:
          "A password reset was requested for the TeaFloww admin console. This security link expires in 60 minutes.\n\n{{reset_link}}",
        table: {
          columns: ["Detail", "Status"],
          rows: [
            ["Access Level", "Staff & Admin Console"],
            ["Link Validity", "Expires in 60 minutes"],
            ["Action Required", "One-time password update"],
          ],
        },
        ctaButton: {
          label: "Reset Link",
          url: "{{reset_link}}",
        },
        secondaryNote:
          "If you did not request this, ignore this message. Contact {{support_email}} for help.",
      }),
    },
    {
      key: "order_confirmation",
      label: "Order confirmation",
      description: "Customer receipt after a successful checkout / paid capture.",
      subject: "Your TeaFloww order {{order_id}} is confirmed",
      variables: ["order_id", "customer_name", "order_total", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Order Confirmed",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "Your order <strong>{{order_id}}</strong> ({{order_total}}) is confirmed and being freshly packed at our Siliguri hub.",
        table: {
          caption: "Order Summary",
          columns: ["Summary Item", "Details"],
          rows: [
            ["Order Reference", "<strong>{{order_id}}</strong>"],
            ["Order Total", "<strong>{{order_total}}</strong>"],
            ["Packaging Hub", "Siliguri Fresh-Pack Facility, West Bengal"],
            ["Harvest Lot", "Single-Estate Himalayan Teas"],
            ["Order Status", "Confirmed & Packing"],
          ],
        },
        secondaryNoteHtml:
          'Every order is packed at origin in nitrogen-flushed barrier pouches to protect delicate volatile aromatics.<br><br>Questions? Reply directly to this email or write to <a href="mailto:{{support_email}}" style="color:#23483a;">{{support_email}}</a>.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Order Confirmed",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "Your order {{order_id}} ({{order_total}}) is confirmed and being freshly packed at our Siliguri hub.",
        table: {
          columns: ["Summary Item", "Details"],
          rows: [
            ["Order Reference", "{{order_id}}"],
            ["Order Total", "{{order_total}}"],
            ["Packaging Hub", "Siliguri Fresh-Pack Facility, West Bengal"],
            ["Harvest Lot", "Single-Estate Himalayan Teas"],
            ["Order Status", "Confirmed & Packing"],
          ],
        },
        secondaryNote: "Questions? Reply to {{support_email}}.",
      }),
    },
    {
      key: "order_shipped",
      label: "Order shipped / dispatch",
      description: "Dispatch notification with tracking link when an order ships.",
      subject: "Your TeaFloww order {{order_id}} has shipped",
      variables: ["order_id", "customer_name", "tracking_url", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Dispatch Notice",
        heading: "Your teas are on their way, {{customer_name}}",
        leadParagraph:
          "Order <strong>{{order_id}}</strong> has shipped from our Siliguri facility and is traveling to your doorstep.",
        table: {
          caption: "Shipment Tracking Details",
          columns: ["Shipment Detail", "Status"],
          rows: [
            ["Order Number", "<strong>{{order_id}}</strong>"],
            ["Dispatch Origin", "Siliguri Logistics Center, West Bengal"],
            ["Fulfillment Status", "Handed to Courier Partner"],
            ["Tracking State", "Live Tracking Active"],
          ],
        },
        ctaButton: {
          label: "Track Your Shipment",
          url: "{{tracking_url}}",
        },
        secondaryNoteHtml:
          'Direct tracking link:<br><a href="{{tracking_url}}" style="color:#23483a;word-break:break-all;">{{tracking_url}}</a><br><br>Questions? Reply to {{support_email}}.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Dispatch Notice",
        heading: "Your teas are on their way, {{customer_name}}",
        leadParagraph:
          "Order {{order_id}} has shipped from our Siliguri facility and is traveling to your doorstep.",
        table: {
          columns: ["Shipment Detail", "Status"],
          rows: [
            ["Order Number", "{{order_id}}"],
            ["Dispatch Origin", "Siliguri Logistics Center, West Bengal"],
            ["Fulfillment Status", "Handed to Courier Partner"],
            ["Tracking State", "Live Tracking Active"],
          ],
        },
        ctaButton: {
          label: "Tracking URL",
          url: "{{tracking_url}}",
        },
        secondaryNote: "Questions? Reply to {{support_email}}.",
      }),
    },
    {
      key: "contact_acknowledgement",
      label: "Contact inquiry acknowledgement",
      description: "Auto-reply after a /contact submission with the ticket reference.",
      subject: "We received your message {{reference_code}} — TeaFloww",
      variables: ["customer_name", "reference_code", "topic", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Inquiry Received",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "We received your {{topic}} inquiry (reference <strong>{{reference_code}}</strong>). A sommelier or support specialist will respond within 24 hours.",
        table: {
          caption: "Inquiry Confirmation",
          columns: ["Inquiry Field", "Details"],
          rows: [
            ["Reference Code", "<strong>{{reference_code}}</strong>"],
            ["Topic", "{{topic}}"],
            ["Turnaround SLA", "Within 24 hours (Monday – Saturday)"],
            ["Direct Desk", "{{support_email}}"],
          ],
        },
        secondaryNoteHtml:
          'Need faster help or have extra details? Reply directly to this email or contact <a href="mailto:{{support_email}}" style="color:#23483a;">{{support_email}}</a>.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Inquiry Received",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "We received your {{topic}} inquiry (reference {{reference_code}}). A sommelier or support specialist will respond within 24 hours.",
        table: {
          columns: ["Inquiry Field", "Details"],
          rows: [
            ["Reference Code", "{{reference_code}}"],
            ["Topic", "{{topic}}"],
            ["Turnaround SLA", "Within 24 hours (Monday – Saturday)"],
            ["Direct Desk", "{{support_email}}"],
          ],
        },
        secondaryNote: "Need faster help? Reply to {{support_email}}.",
      }),
    },
    {
      key: "wholesale_acknowledgement",
      label: "Wholesale inquiry acknowledgement",
      description: "Auto-reply after a /wholesale submission.",
      subject: "Your wholesale inquiry is with our trade desk — TeaFloww",
      variables: ["customer_name", "business_name", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "B2B Trade Desk",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "Your wholesale inquiry for <strong>{{business_name}}</strong> is with our trade desk. We respond within 2 business days.",
        table: {
          caption: "Trade Inquiry Details",
          columns: ["Trade Field", "Information"],
          rows: [
            ["Business Entity", "<strong>{{business_name}}</strong>"],
            ["Account Type", "Wholesale & Horeca Direct Sourcing"],
            ["Trade Desk Hub", "Siliguri, West Bengal"],
            ["Response Target", "Within 2 business days"],
            ["Trade Desk", "{{support_email}}"],
          ],
        },
        secondaryNoteHtml:
          'We supply premium cafes, boutique hotels, and specialty retailers with estate-direct teas, customized packaging, and batch documentation.<br><br>Trade desk: <a href="mailto:{{support_email}}" style="color:#23483a;">{{support_email}}</a>.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "B2B Trade Desk",
        heading: "Thank you, {{customer_name}}",
        leadParagraph:
          "Your wholesale inquiry for {{business_name}} is with our trade desk. We respond within 2 business days.",
        table: {
          columns: ["Trade Field", "Information"],
          rows: [
            ["Business Entity", "{{business_name}}"],
            ["Account Type", "Wholesale & Horeca Direct Sourcing"],
            ["Trade Desk Hub", "Siliguri, West Bengal"],
            ["Response Target", "Within 2 business days"],
            ["Trade Desk", "{{support_email}}"],
          ],
        },
        secondaryNote: "Trade desk: {{support_email}}.",
      }),
    },
    {
      key: "newsletter_welcome",
      label: "Newsletter welcome",
      description: "Welcome email after newsletter consent (requires provider send wiring).",
      subject: "Welcome to the TeaFloww tea circle",
      variables: ["store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Tea Circle Welcome",
        heading: "Welcome to the tea circle",
        leadParagraph:
          "First-flush arrivals, cupping notes, and harvest stories — straight from Siliguri. No spam, unsubscribe anytime.",
        table: {
          caption: "Your Circle Privileges",
          columns: ["Privilege", "Description"],
          rows: [
            ["First-Flush Drops", "Early access to limited seasonal harvest flushes"],
            ["Sommelier Cupping Notes", "Direct brewing guidance and tasting profiles"],
            ["Garden Transparency", "Elevation, invoice numbers, and harvest dates"],
            ["Origin Dispatches", "Direct sourcing from Darjeeling, Assam, and Dooars"],
          ],
        },
        ctaButton: {
          label: "Explore Fresh Harvests",
          url: "https://teafloww.com/shop",
        },
        secondaryNoteHtml: "Pure single-estate teas straight from Siliguri. &mdash; {{store_name}} ({{support_email}})",
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Tea Circle Welcome",
        heading: "Welcome to the tea circle",
        leadParagraph:
          "First-flush arrivals, cupping notes, and harvest stories — straight from Siliguri. No spam, unsubscribe anytime.",
        table: {
          columns: ["Privilege", "Description"],
          rows: [
            ["First-Flush Drops", "Early access to limited seasonal harvest flushes"],
            ["Sommelier Cupping Notes", "Direct brewing guidance and tasting profiles"],
            ["Garden Transparency", "Elevation, invoice numbers, and harvest dates"],
            ["Origin Dispatches", "Direct sourcing from Darjeeling, Assam, and Dooars"],
          ],
        },
        ctaButton: {
          label: "Explore Teas",
          url: "https://teafloww.com/shop",
        },
        secondaryNote: "— {{store_name}} ({{support_email}})",
      }),
    },
    {
      key: "abandoned_cart_recovery",
      label: "Abandoned cart recovery",
      description: "Recovery nudge with the cart recovery URL.",
      subject: "Your teas are still waiting — TeaFloww",
      variables: ["customer_name", "recovery_url", "store_name", "support_email", "logo_url"],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Saved Selection",
        heading: "{{customer_name}}, your teas are still waiting",
        leadParagraph:
          "Your selected teas are still reserved in your bag. Lots are packed fresh at origin and move quickly in season.",
        table: {
          caption: "Reserved Bag Status",
          columns: ["Bag Detail", "Status"],
          rows: [
            ["Reservation State", "Saved for your checkout"],
            ["Freshness Guarantee", "Direct nitrogen-flushed packaging"],
            ["Dispatch Hub", "Dispatched fresh from Siliguri hub"],
            ["Authenticity", "100% Single-Estate Himalayan lots"],
          ],
        },
        ctaButton: {
          label: "Resume Your Bag & Checkout",
          url: "{{recovery_url}}",
        },
        secondaryNoteHtml:
          'Direct checkout link:<br><a href="{{recovery_url}}" style="color:#23483a;word-break:break-all;">{{recovery_url}}</a><br><br>Questions? Reply to {{support_email}}.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Saved Selection",
        heading: "{{customer_name}}, your teas are still waiting",
        leadParagraph:
          "Your selected teas are still reserved in your bag. Lots are packed fresh at origin and move quickly in season.",
        table: {
          columns: ["Bag Detail", "Status"],
          rows: [
            ["Reservation State", "Saved for your checkout"],
            ["Freshness Guarantee", "Direct nitrogen-flushed packaging"],
            ["Dispatch Hub", "Dispatched fresh from Siliguri hub"],
            ["Authenticity", "100% Single-Estate Himalayan lots"],
          ],
        },
        ctaButton: {
          label: "Resume Link",
          url: "{{recovery_url}}",
        },
        secondaryNote: "Questions? Reply to {{support_email}}.",
      }),
    },
    {
      key: "commerce_order_received",
      label: "Commerce order received",
      description: "Live commerce receipt when an order is received.",
      subject: "Your TeaFloww order {{order_id}} was received",
      variables: [
        "customer_name",
        "order_id",
        "order_total",
        "payment_status",
        "tracking_url",
        "support_email",
        "store_name",
        "logo_url",
      ],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Commerce Receipt",
        heading: "We received your order, {{customer_name}}",
        leadParagraph:
          "We received your tea order <strong>{{order_id}}</strong> for <strong>{{order_total}}</strong>. Payment status: {{payment_status}}.",
        table: {
          caption: "Order Information",
          columns: ["Item", "Details"],
          rows: [
            ["Order Reference", "<strong>{{order_id}}</strong>"],
            ["Total Amount", "<strong>{{order_total}}</strong>"],
            ["Payment Status", "{{payment_status}}"],
            ["Dispatch Origin", "Siliguri Packaging Facility, West Bengal"],
          ],
        },
        ctaButton: {
          label: "View Order & Live Status",
          url: "{{tracking_url}}",
        },
        secondaryNoteHtml:
          'Delivery preparation and tracking updates will appear at your private order link:<br><a href="{{tracking_url}}" style="color:#23483a;word-break:break-all;">{{tracking_url}}</a><br><br>Questions? Contact {{support_email}}.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Commerce Receipt",
        heading: "We received your order, {{customer_name}}",
        leadParagraph:
          "Hello {{customer_name}},\n\nWe received your tea order {{order_id}} for {{order_total}}. Payment status: {{payment_status}}.",
        table: {
          columns: ["Item", "Details"],
          rows: [
            ["Order Reference", "{{order_id}}"],
            ["Total Amount", "{{order_total}}"],
            ["Payment Status", "{{payment_status}}"],
            ["Dispatch Origin", "Siliguri Packaging Facility, West Bengal"],
          ],
        },
        ctaButton: {
          label: "Order URL",
          url: "{{tracking_url}}",
        },
        secondaryNote:
          "Delivery preparation and tracking updates will appear at your private order link: {{tracking_url}}\n\nQuestions? Contact {{support_email}}.",
      }),
    },
    {
      key: "commerce_payment_review",
      label: "Captured payment requiring review",
      description: "Payment received for order requiring staff review.",
      subject: "Payment received for TeaFloww order {{order_id}}",
      variables: [
        "customer_name",
        "order_id",
        "order_total",
        "payment_status",
        "tracking_url",
        "support_email",
        "store_name",
        "logo_url",
      ],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Payment Review",
        heading: "Payment received for order {{order_id}}",
        leadParagraph:
          "Hello {{customer_name}},\n\nPayment was received for order <strong>{{order_id}}</strong> ({{order_total}}). Fulfillment requires a brief review by our team. We will arrange delivery or a refund after resolving the issue.",
        table: {
          caption: "Review Details",
          columns: ["Review Item", "Status"],
          rows: [
            ["Order ID", "<strong>{{order_id}}</strong>"],
            ["Amount Paid", "<strong>{{order_total}}</strong>"],
            ["Review Status", "In Review by Operations"],
            ["Resolution Target", "Within 1 business day"],
          ],
        },
        ctaButton: {
          label: "Check Order Status",
          url: "{{tracking_url}}",
        },
        secondaryNoteHtml:
          'Your private order link:<br><a href="{{tracking_url}}" style="color:#23483a;word-break:break-all;">{{tracking_url}}</a><br><br>Questions? Contact {{support_email}}.',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Payment Review",
        heading: "Payment received for order {{order_id}}",
        leadParagraph:
          "Hello {{customer_name}},\n\nPayment was received for order {{order_id}} ({{order_total}}). Fulfillment requires a review by our team. We will arrange delivery or a refund after resolving the issue.",
        table: {
          columns: ["Review Item", "Status"],
          rows: [
            ["Order ID", "{{order_id}}"],
            ["Amount Paid", "{{order_total}}"],
            ["Review Status", "In Review by Operations"],
            ["Resolution Target", "Within 1 business day"],
          ],
        },
        ctaButton: {
          label: "Order URL",
          url: "{{tracking_url}}",
        },
        secondaryNote:
          "Your private order link: {{tracking_url}}\n\nQuestions? Contact {{support_email}}.",
      }),
    },
    {
      key: "subscription_renewal",
      label: "Subscription renewal",
      description: "Manual-pay renewal and subscription management",
      subject: "Your TeaFloww subscription renewal",
      variables: [
        "customer_name",
        "dispatch_date",
        "renewal_url",
        "store_name",
        "support_email",
        "logo_url",
      ],
      html_body: buildBrandEmailHtml({
        categoryBadge: "Subscription Renewal",
        heading: "Subscription renewal notice for {{customer_name}}",
        leadParagraph:
          "Hello {{customer_name}},\n\nYour TeaFloww subscription renewal is scheduled for <strong>{{dispatch_date}}</strong>. Review the exact total, pay online, choose eligible COD, skip or manage your subscription.",
        table: {
          caption: "Renewal Schedule",
          columns: ["Cycle Detail", "Information"],
          rows: [
            ["Dispatch Date", "<strong>{{dispatch_date}}</strong>"],
            ["Payment Policy", "Manual payment / Prepaid (No auto-debit)"],
            ["Hub", "Siliguri Packaging Facility, WB"],
            ["Flexibility", "Skip, pause, or change teas anytime"],
          ],
        },
        ctaButton: {
          label: "Review, Pay or Manage Subscription",
          url: "{{renewal_url}}",
        },
        secondaryNoteHtml:
          'Prepaid renewals require payment each time; there is no automatic debit. Delivery fees apply under the current shipping policy.<br><br>Direct link:<br><a href="{{renewal_url}}" style="color:#23483a;word-break:break-all;">{{renewal_url}}</a>',
      }),
      text_body: buildBrandEmailText({
        categoryBadge: "Subscription Renewal",
        heading: "Subscription renewal notice for {{customer_name}}",
        leadParagraph:
          "Hello {{customer_name}},\n\nYour TeaFloww subscription renewal is scheduled for {{dispatch_date}}. Review the exact total, pay online, choose eligible COD, skip or manage your subscription here:\n{{renewal_url}}",
        table: {
          columns: ["Cycle Detail", "Information"],
          rows: [
            ["Dispatch Date", "{{dispatch_date}}"],
            ["Payment Policy", "Manual payment / Prepaid (No auto-debit)"],
            ["Hub", "Siliguri Packaging Facility, WB"],
            ["Flexibility", "Skip, pause, or change teas anytime"],
          ],
        },
        ctaButton: {
          label: "Manage Link",
          url: "{{renewal_url}}",
        },
        secondaryNote:
          "Prepaid renewals require payment each time; there is no automatic debit. Delivery fees apply under the current shipping policy.\n\nTeaFloww",
      }),
    },
  ];
}

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
 * Supports the one {{#logo}}...{{/logo}} conditional used by the templates
 * (emitted only when logo_url is non-empty).
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

  const oneLineGoal = goal.replace(/\s+/g, " ").slice(0, 140);
  const subject = `${oneLineGoal.slice(0, 70)} — TeaFloww`;
  const opener = TONE_OPENERS[tone] ?? TONE_OPENERS.warm;

  const html_body = buildBrandEmailHtml({
    categoryBadge: tone.toUpperCase() + " UPDATE",
    heading: oneLineGoal,
    leadParagraph: opener,
    bodyHtml: `<p style="margin:0 0 16px 0;font-size:15px;line-height:1.6;color:#1d2a24;">${escapeHtml(goal)}</p>`,
    table: {
      caption: "Update Overview",
      columns: ["Topic", "Details"],
      rows: [
        ["Communication", escapeHtml(oneLineGoal)],
        ["Origin Hub", "Siliguri & Himalayan Estates"],
        ["Inquiries", "{{support_email}}"],
      ],
    },
    ctaButton: {
      label: cta,
      url: "mailto:{{support_email}}",
    },
    secondaryNoteHtml: "— {{store_name}} &middot; {{support_email}}",
  });

  const text_body = buildBrandEmailText({
    categoryBadge: tone.toUpperCase() + " UPDATE",
    heading: oneLineGoal,
    leadParagraph: `${opener}\n\n${goal}`,
    table: {
      columns: ["Topic", "Details"],
      rows: [
        ["Topic", "Details"],
        ["Communication", oneLineGoal],
        ["Origin Hub", "Siliguri & Himalayan Estates"],
        ["Inquiries", "{{support_email}}"],
      ],
    },
    ctaButton: {
      label: "Action",
      url: cta,
    },
    secondaryNote: "— {{store_name}} · {{support_email}}",
  });

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
