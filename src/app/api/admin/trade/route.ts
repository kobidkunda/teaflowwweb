import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { guard, invalid } from "@/lib/adminHttp";
import { getDb } from "@/lib/db";
import { TrialService } from "@/lib/trials/service";
import {
  getTradeFunnelSummary,
  getTradeSettings,
  listAllTradeOffersAdmin,
  listLocalizedContent,
  listTradeEnquiries,
  listTradeLanes,
  listTradeOrdersAdmin,
  listTradeSharedPilots,
  updateTradeSettings,
} from "@/lib/trade/catalogue";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;

  const db = getDb();
  const products = db
    .prepare(
      "SELECT id, slug, name, category, CASE WHEN COALESCE(status, 'published') = 'published' THEN 1 ELSE 0 END AS enabled FROM products ORDER BY id ASC"
    )
    .all();
  const variants = db
    .prepare("SELECT id, product_id, sku, grams, price_paise, stock FROM variants ORDER BY product_id ASC, grams ASC")
    .all();
  const trials = TrialService.list({ status: "published" }).trials;

  return NextResponse.json({
    settings: getTradeSettings(),
    offers: listAllTradeOffersAdmin(),
    lanes: listTradeLanes(false),
    enquiries: listTradeEnquiries(),
    localizedContent: listLocalizedContent(),
    sharedPilots: listTradeSharedPilots(false),
    orders: listTradeOrdersAdmin(),
    funnelSummary: getTradeFunnelSummary(),
    catalog: { products, variants, trials },
  });
}

export async function PUT(req: NextRequest) {
  const denied = await guard(req);
  if (denied) return denied;

  try {
    const body = await req.json();
    const settings = updateTradeSettings(body);
    return NextResponse.json({ settings }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      return invalid(err.issues[0]?.message || "Invalid trade settings.");
    }
    return invalid(err instanceof Error ? err.message : "Failed to update trade settings.");
  }
}
