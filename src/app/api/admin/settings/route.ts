import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import { getStoreSettings, updateStoreSettings, type StoreSettings } from "@/lib/storeSettings";

export const runtime = "nodejs";

const optionalNumber = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((val) => (val === "" || val === null || val === undefined ? undefined : val), schema.optional());

const optionalWebhookUrl = z
  .string()
  .trim()
  .max(500)
  .refine((val) => {
    if (!val) return true;
    try {
      const parsed = new URL(val);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Webhook URL must be a valid http:// or https:// URL")
  .optional();

const commaSeparatedEmails = z
  .string()
  .trim()
  .max(1000)
  .refine((val) => {
    if (!val) return true;
    const parts = val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return parts.every((p) => z.string().email().safeParse(p).success);
  }, "Notification emails must be a comma-separated list of valid email addresses")
  .optional();

const settingsSchema = z.object({
  store_name: z.string().min(1, "Store name is required").max(100),
  currency: z.string().min(1, "Currency is required").max(10).default("INR"),
  currency_code: z.string().min(1).max(10).optional(),
  tax_rate_percent: z.coerce.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%"),
  gst_tax_rate_percent: z.coerce.number().min(0).max(100).optional(),
  shipping_flat_fee_paise: optionalNumber(z.coerce.number().int().min(0, "Shipping fee cannot be negative")),
  shipping_fee_paise: optionalNumber(z.coerce.number().int().min(0)),
  free_shipping_threshold_paise: optionalNumber(z.coerce.number().int().min(0, "Free shipping threshold cannot be negative")),
  wholesale_moq: optionalNumber(z.coerce.number().int().min(1, "Wholesale MOQ must be at least 1")),
  wholesale_advance_percent: optionalNumber(z.coerce.number().min(0, "Advance percentage must be at least 0").max(100, "Advance percentage cannot exceed 100%")),
  wholesale_bank_beneficiary: z.string().max(100).optional(),
  wholesale_bank_name: z.string().max(100).optional(),
  wholesale_bank_account_number: z.string().max(50).optional(),
  wholesale_bank_ifsc: z.string().max(20).optional(),
  wholesale_bank_branch: z.string().max(100).optional(),
  wholesale_bank_upi_id: z.string().max(100).optional(),
  contact_email: z.string().email("Please enter a valid email address"),
  whatsapp_number: z.string().max(30).optional(),
  notification_emails: commaSeparatedEmails,
  webhook_secret: z.string().trim().max(256).optional(),
  webhook_url_enquiry: optionalWebhookUrl,
  webhook_url_bulk_order: optionalWebhookUrl,
  webhook_url_lead_modal: optionalWebhookUrl,
  webhook_url_newsletter: optionalWebhookUrl,
  webhook_url_private_label: optionalWebhookUrl,
  webhook_url_quote: optionalWebhookUrl,
  webhook_url_order: optionalWebhookUrl,
  webhook_url_subscription: optionalWebhookUrl,
});

export type StoreSettingsPayload = StoreSettings;

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const settings = getStoreSettings();
    return NextResponse.json({ settings });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to retrieve settings.");
  }
}

export async function PUT(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  try {
    const updated = updateStoreSettings(parsed.data);
    return NextResponse.json({ ok: true, settings: updated });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to save operational settings.");
  }
}

