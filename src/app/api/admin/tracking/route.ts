import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import {
  getTrackingSettings,
  updateTrackingSettings,
  type TrackingSettings,
} from "@/lib/trackingSettings";

export const runtime = "nodejs";

const conversionRuleSchema = z
  .object({
    id: z.string().trim().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/, "Rule ID must be alphanumeric/hyphen/underscore"),
    name: z.string().trim().min(1, "Conversion name is required").max(120),
    enabled: z.boolean(),
    platform: z.enum(["google_ads", "meta", "ga4"]),
    delivery: z.enum(["admin_direct", "gtm_datalayer", "both"]),
    trigger_event: z.enum([
      "purchase",
      "generate_lead",
      "begin_checkout",
      "add_shipping_info",
      "add_payment_info",
      "add_to_cart",
      "view_item",
      "search",
    ]),
    lead_type_filter: z.string().trim().max(80).optional(),
    ads_conversion_id: z
      .string()
      .trim()
      .max(32)
      .refine((v) => v === "" || /^AW-\d+$/i.test(v), {
        message: "Google Ads Conversion ID should look like AW-18566488412",
      })
      .optional(),
    ads_conversion_label: z
      .string()
      .trim()
      .max(64)
      .refine((v) => v === "" || /^[a-zA-Z0-9_-]+$/.test(v), {
        message: "Conversion label may only contain letters, numbers, _ and -",
      })
      .optional(),
    meta_pixel_id: z
      .string()
      .trim()
      .max(32)
      .refine((v) => v === "" || /^\d+$/.test(v), {
        message: "Meta Pixel ID must contain digits only",
      })
      .optional(),
    meta_event_name: z
      .string()
      .trim()
      .max(64)
      .refine((v) => v === "" || /^[a-zA-Z0-9_ .-]+$/.test(v), {
        message: "Meta event name contains invalid characters",
      })
      .optional(),
    meta_is_custom_event: z.boolean().optional(),
    custom_event_name: z
      .string()
      .trim()
      .max(64)
      .refine((v) => v === "" || /^[a-zA-Z0-9_]+$/.test(v), {
        message: "Custom event name must be letters, numbers, or underscores",
      })
      .optional(),
    value_mode: z.enum(["order_total", "merchandise_subtotal", "fixed", "none"]),
    fixed_value: z.number().finite().min(0).max(100000000).optional(),
    currency: z
      .string()
      .trim()
      .max(8)
      .refine((v) => v === "" || v === "EVENT" || /^[A-Z]{3}$/i.test(v), {
        message: "Currency must be EVENT or a 3-letter ISO code like INR",
      })
      .optional(),
    paid_only: z.boolean().optional(),
  })
  .superRefine((rule, ctx) => {
    if (!rule.enabled) return;
    if (rule.platform === "google_ads" && rule.delivery !== "gtm_datalayer" && !rule.ads_conversion_label) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["ads_conversion_label"],
        message: "Google Ads Conversion Label is required for enabled direct rules",
      });
    }
    if (rule.platform === "meta" && !rule.meta_event_name) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["meta_event_name"],
        message: "Meta Event Name is required for enabled Meta rules",
      });
    }
  });

const trackingUpdateSchema = z.object({
  gtm_container_id: z
    .string()
    .trim()
    .max(50)
    .refine((val) => val === "" || /^GTM-[A-Z0-9]+$/i.test(val), {
      message: "GTM Container ID should be formatted like GTM-XXXXXXX",
    })
    .optional(),
  gtm_enabled: z.boolean().optional(),
  ga4_measurement_id: z
    .string()
    .trim()
    .max(50)
    .refine((val) => val === "" || /^G-[A-Z0-9]+$/i.test(val), {
      message: "GA4 Measurement ID should be formatted like G-XXXXXXXXXX",
    })
    .optional(),
  ga4_enabled: z.boolean().optional(),
  ga4_run_alongside_gtm: z.boolean().optional(),
  meta_pixel_id: z
    .string()
    .trim()
    .max(50)
    .refine((val) => val === "" || /^\d+$/.test(val), {
      message: "Meta Pixel ID should be a numeric identifier",
    })
    .optional(),
  meta_pixel_enabled: z.boolean().optional(),
  meta_run_alongside_gtm: z.boolean().optional(),
  google_ads_id: z
    .string()
    .trim()
    .max(32)
    .refine((val) => val === "" || /^AW-\d+$/i.test(val), {
      message: "Google Ads ID should be formatted like AW-18566488412",
    })
    .optional(),
  google_ads_enabled: z.boolean().optional(),
  conversion_rules: z.array(conversionRuleSchema).max(50).optional(),
  custom_head_script: z.string().max(10000).optional(),
  custom_body_script: z.string().max(10000).optional(),
});

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  try {
    const settings: TrackingSettings = getTrackingSettings();
    return NextResponse.json({ ok: true, settings });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to retrieve tracking settings.");
  }
}

export async function PUT(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const body: unknown = await request.json().catch(() => null);
  const parsed = trackingUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return invalid(parsed.error.flatten());
  }

  try {
    const updated = updateTrackingSettings(parsed.data);
    return NextResponse.json({ ok: true, settings: updated });
  } catch (e) {
    return conflict(e instanceof Error ? e.message : "Unable to save tracking settings.");
  }
}
