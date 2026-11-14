import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getDeliverySettings } from "@/lib/deliverySettings";

export const dynamic = "force-dynamic";

const PIN_PREFIX_STATE: Array<{ match: RegExp; state: string; city?: string }> = [
  { match: /^7340/, state: "West Bengal", city: "Siliguri" },
  { match: /^734/, state: "West Bengal", city: "Darjeeling" },
  { match: /^735/, state: "West Bengal", city: "Jalpaiguri" },
  { match: /^700/, state: "West Bengal", city: "Kolkata" },
  { match: /^7[0-4]/, state: "West Bengal" },
  { match: /^110/, state: "Delhi", city: "New Delhi" },
  { match: /^1[23]/, state: "Haryana" },
  { match: /^1[45]/, state: "Punjab" },
  { match: /^160/, state: "Chandigarh", city: "Chandigarh" },
  { match: /^17/, state: "Himachal Pradesh" },
  { match: /^1[89]/, state: "Jammu and Kashmir" },
  { match: /^2[0-3]/, state: "Uttar Pradesh" },
  { match: /^24[4-9]|^26[0-3]/, state: "Uttarakhand" },
  { match: /^2[5-8]/, state: "Uttar Pradesh" },
  { match: /^3[0-4]/, state: "Rajasthan" },
  { match: /^3[6-9]/, state: "Gujarat" },
  { match: /^400/, state: "Maharashtra", city: "Mumbai" },
  { match: /^411/, state: "Maharashtra", city: "Pune" },
  { match: /^4[0-4]/, state: "Maharashtra" },
  { match: /^403/, state: "Goa" },
  { match: /^4[5-8]/, state: "Madhya Pradesh" },
  { match: /^49/, state: "Chhattisgarh" },
  { match: /^500/, state: "Telangana", city: "Hyderabad" },
  { match: /^50/, state: "Telangana" },
  { match: /^5[1-3]/, state: "Andhra Pradesh" },
  { match: /^560/, state: "Karnataka", city: "Bengaluru" },
  { match: /^5[6-9]/, state: "Karnataka" },
  { match: /^600/, state: "Tamil Nadu", city: "Chennai" },
  { match: /^6[0-4]/, state: "Tamil Nadu" },
  { match: /^6[7-9]/, state: "Kerala" },
  { match: /^75|^76|^77/, state: "Odisha" },
  { match: /^781/, state: "Assam", city: "Guwahati" },
  { match: /^78/, state: "Assam" },
  { match: /^793|^794/, state: "Meghalaya" },
  { match: /^737/, state: "Sikkim", city: "Gangtok" },
  { match: /^8[0-5]/, state: "Bihar" },
  { match: /^8[1-3]/, state: "Jharkhand" },
];

function inferLocationFromPrefix(pincode: string): { city: string; state: string } | null {
  for (const entry of PIN_PREFIX_STATE) {
    if (entry.match.test(pincode)) {
      return { city: entry.city || "", state: entry.state };
    }
  }
  return null;
}

/**
 * GET /api/shipping/pincode-lookup?pincode=734001
 * Resolves city, state, and estimated delivery/COD info for a 6-digit Indian PIN code.
 */
export async function GET(req: NextRequest) {
  const pincode = (req.nextUrl.searchParams.get("pincode") || "").trim();
  if (!/^[1-9][0-9]{5}$/.test(pincode)) {
    return NextResponse.json(
      { ok: false, error: "Please enter a valid 6-digit Indian PIN code." },
      { status: 400 }
    );
  }

  let city = "";
  let state = "";
  let serviceable = true;
  let estimatedDays = pincode.startsWith("734") ? "1–2 business days (Local Siliguri Hub)" : "2–5 business days";

  // 1. Check local database coverage table first
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT city, state, serviceable, estimated_days FROM bl_pincode_coverage WHERE pincode = ?")
      .get(pincode) as
      | { city?: string; state?: string; serviceable?: number; estimated_days?: string }
      | undefined;
    if (row) {
      city = row.city || "";
      state = row.state || "";
      if (typeof row.serviceable === "number") serviceable = row.serviceable === 1;
      if (row.estimated_days) estimatedDays = row.estimated_days;
    }
  } catch {
    // Table may not exist in all environments
  }

  // 2. Fallback to India Post public API when city/state are not in local DB
  if (!city || !state) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`https://api.postalpincode.in/pincode/${pincode}`, {
        signal: controller.signal,
        next: { revalidate: 86400 },
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const data = (await res.json()) as Array<{
          Status?: string;
          PostOffice?: Array<{ District?: string; Block?: string; State?: string }>;
        }>;
        const po = data?.[0]?.Status === "Success" ? data[0].PostOffice?.[0] : undefined;
        if (po) {
          city = city || po.Block || po.District || "";
          if (city === "NA") city = po.District || "";
          state = state || po.State || "";
        }
      }
    } catch {
      // Network unavailable or timed out — fall back to prefix map
    }
  }

  // 3. Deterministic prefix fallback (ensures offline/test reliability)
  if (!state) {
    const inferred = inferLocationFromPrefix(pincode);
    if (inferred) {
      city = city || inferred.city;
      state = inferred.state;
    }
  }

  const delivery = getDeliverySettings();
  const codAllowed =
    delivery.cod_enabled &&
    (delivery.cod_postcodes.length === 0 || delivery.cod_postcodes.includes(pincode));

  return NextResponse.json({
    ok: true,
    pincode,
    city,
    state,
    serviceable,
    codAllowed,
    estimatedDays,
    flatShippingRupees: delivery.shipping_flat_fee_rupees,
    freeShippingThresholdRupees: delivery.free_shipping_threshold_rupees,
  });
}
