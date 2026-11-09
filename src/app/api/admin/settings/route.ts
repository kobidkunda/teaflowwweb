import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import { getStoreSettings, updateStoreSettings, type StoreSettings } from "@/lib/storeSettings";

export const runtime = "nodejs";

const settingsSchema = z.object({
  store_name: z.string().min(1, "Store name is required").max(100),
  currency: z.string().min(1, "Currency is required").max(10).default("INR"),
  currency_code: z.string().min(1).max(10).optional(),
  tax_rate_percent: z.coerce.number().min(0, "Tax rate cannot be negative").max(100, "Tax rate cannot exceed 100%"),
  gst_tax_rate_percent: z.coerce.number().min(0).max(100).optional(),
  shipping_flat_fee_paise: z.coerce.number().int().min(0, "Shipping fee cannot be negative"),
  shipping_fee_paise: z.coerce.number().int().min(0).optional(),
  free_shipping_threshold_paise: z.coerce.number().int().min(0, "Free shipping threshold cannot be negative"),
  contact_email: z.string().email("Please enter a valid email address"),
  whatsapp_number: z.string().max(30).optional(),
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

