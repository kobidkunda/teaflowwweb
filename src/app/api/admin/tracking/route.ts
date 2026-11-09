import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, invalid, conflict } from "@/lib/adminHttp";
import {
  getTrackingSettings,
  updateTrackingSettings,
  type TrackingSettings,
} from "@/lib/trackingSettings";

export const runtime = "nodejs";

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
  meta_pixel_id: z
    .string()
    .trim()
    .max(50)
    .refine((val) => val === "" || /^\d+$/.test(val), {
      message: "Meta Pixel ID should be a numeric identifier",
    })
    .optional(),
  meta_pixel_enabled: z.boolean().optional(),
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
