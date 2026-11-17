import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { guard } from "@/lib/adminHttp";

export const runtime = "nodejs";

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const db = getDb();
  // The availability flag lives in products.is_enabled (migration 028); there is no `enabled` column.
  const products = db
    .prepare("SELECT id, slug, name, category, is_enabled FROM products ORDER BY id ASC")
    .all();
  const variants = db
    .prepare("SELECT id, product_id, sku, grams, price_paise, stock FROM variants ORDER BY product_id ASC, grams ASC")
    .all();

  return NextResponse.json({ products, variants });
}
