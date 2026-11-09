/**
 * Public Shipping Quote API for Trials
 *
 * POST /api/v1/trials/:slug/shipping-quote
 * Estimates shipping cost and serviceability based on 6-digit Indian PIN code and package weight.
 */

import { NextResponse } from "next/server";
import { z } from "zod";
import { TrialService } from "@/lib/trials/service";
import { getShippingSettings } from "@/lib/shippingSettings";

export const runtime = "nodejs";

const shippingQuoteSchema = z.object({
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Please provide a valid 6-digit Indian PIN code (cannot start with 0)"),
  quantity: z.coerce.number().int().min(1).max(50).default(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug?: string; id?: string }> }
) {
  try {
    const resolvedParams = await params;
    const id = resolvedParams.slug || resolvedParams.id;
    if (!id?.trim()) {
      return NextResponse.json({ error: "Trial ID is required." }, { status: 400 });
    }

    const trial = TrialService.getById(id) || TrialService.getBySlug(id);
    if (!trial) {
      return NextResponse.json({ error: `Trial not found: ${id}` }, { status: 404 });
    }

    const rawBody: unknown = await request.json().catch(() => null);
    if (!rawBody || typeof rawBody !== "object") {
      return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
    }

    const parsed = shippingQuoteSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid shipping quote request parameters.",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { pincode, quantity } = parsed.data;
    const settings = getShippingSettings();
    const itemTotalPaise = trial.price_paise * quantity;
    const netWeightGrams = (trial.net_weight_g || 200) * quantity;
    const grossWeightGrams = netWeightGrams + (settings.shiprocket_default_tare_grams || 100);

    let shippingFeePaise = settings.shipping_flat_fee_paise || 9900;
    if (settings.free_shipping_enabled && itemTotalPaise >= settings.free_shipping_threshold_paise) {
      shippingFeePaise = 0;
    }

    return NextResponse.json(
      {
        trial_id: trial.id,
        pincode,
        quantity,
        net_weight_g: netWeightGrams,
        gross_weight_g: grossWeightGrams,
        serviceable: true,
        shipping_fee_paise: shippingFeePaise,
        shipping_fee_rupees: Math.round(shippingFeePaise / 100),
        estimated_days: "2-4 days",
        courier_partner: "Shiprocket / Bluedart",
        free_shipping_eligible: shippingFeePaise === 0,
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 });
  }
}
