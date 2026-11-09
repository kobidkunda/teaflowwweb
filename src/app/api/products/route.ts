import { NextResponse } from "next/server";
import { listProducts, upsertProduct, getProduct } from "@/lib/products";
import { productSchema, normalizeProductInput } from "@/lib/validation";
import { getPrimaryImage } from "@/lib/storefront";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";

/**
 * Storefront catalogue read. Adds optional categoryId + featured passthrough
 * per contracts; embeds the primary product image when the product_images
 * table exists. Prices always come from server variants. No tokens or PII.
 */
export function GET(request: Request) {
  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").slice(0, 100);
  const category = (url.searchParams.get("category") || "").slice(0, 40);
  const categoryIdRaw = url.searchParams.get("categoryId") || "";
  const featuredRaw = url.searchParams.get("featured") || "";
  const categoryId = /^\d+$/.test(categoryIdRaw)
    ? Number(categoryIdRaw)
    : undefined;
  const featured = ["1", "true", "yes"].includes(featuredRaw.toLowerCase())
    ? true
    : undefined;
  const statusParam = url.searchParams.get("status") || "published";

  let products = listProducts({ q, category, status: statusParam });
  if (categoryId !== undefined) {
    try {
      const cols = (
        getDb().prepare("PRAGMA table_info(products)").all() as {
          name: string;
        }[]
      ).map((c) => c.name);
      if (cols.includes("category_id")) {
        const rows = getDb()
          .prepare("SELECT id FROM products WHERE category_id=?")
          .all(categoryId) as { id: number }[];
        const ids = new Set(rows.map((r) => r.id));
        products = products.filter((p) => ids.has(p.id));
      }
    } catch {
      /* category table absent: keep legacy category filter */
    }
  }
  if (featured !== undefined) products = products.filter((p) => p.featured === 1);

  const withImages = products.map((p) => {
    const primary = getPrimaryImage(p.id);
    return {
      ...p,
      primaryImage: primary
        ? { url: primary.url, alt_text: primary.alt_text }
        : null,
    };
  });
  return NextResponse.json({ products: withImages });
}

export async function POST(request: Request) {
  const rawBody: unknown = await request.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json({ error: "Invalid JSON request body." }, { status: 400 });
  }

  const normalized = normalizeProductInput(rawBody);
  const parsed = productSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid product parameters", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const result = upsertProduct(parsed.data);
    const product = getProduct(result.id);
    return NextResponse.json(
      {
        success: true,
        product,
        id: result.id,
        slug: result.slug,
        price: result.price,
        price_paise: result.price_paise,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create product." },
      { status: 400 }
    );
  }
}

