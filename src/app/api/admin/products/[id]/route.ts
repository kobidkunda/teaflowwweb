import { NextResponse } from "next/server";
import { getProduct, deleteProduct, archiveProduct, upsertProduct } from "@/lib/products";
import { productSchema } from "@/lib/validation";
import { guard, invalid, notFound, conflict } from "@/lib/adminHttp";
import { listProductImages } from "@/lib/productImages";
import { getDb } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const prodId = Number(id);
  const product = getProduct(prodId);
  if (!product) return notFound("Product not found.");

  // Attach images from product_images table
  let images: unknown[] = [];
  try {
    images = listProductImages(prodId);
  } catch {
    images = [];
  }

  return NextResponse.json({
    product: {
      ...product,
      images,
    },
  });
}

async function handleUpdate(request: Request, params: Promise<{ id: string }>) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const prodId = Number(id);
  const current = getProduct(prodId);
  if (!current) return notFound("Product not found.");

  const rawBody: unknown = await request.json().catch(() => null);
  const parsed = productSchema.partial().safeParse(rawBody);
  if (!parsed.success) return invalid(parsed.error.flatten());

  // Zod field defaults must not turn omitted PATCH fields into destructive writes.
  const supplied = rawBody as Record<string, unknown>;
  for (const key of Object.keys(parsed.data)) {
    if (!Object.prototype.hasOwnProperty.call(supplied, key)) {
      delete (parsed.data as Record<string, unknown>)[key];
    }
  }

  try {
    const merged = productSchema.parse({
      id: prodId,
      slug: parsed.data.slug ?? current.slug,
      name: parsed.data.name ?? current.name,
      category_id: parsed.data.category_id !== undefined ? parsed.data.category_id : (current.category_id ?? undefined),
      category: parsed.data.category ?? current.category,
      origin: parsed.data.origin ?? current.origin,
      estate: parsed.data.estate ?? current.estate,
      flush: parsed.data.flush ?? current.flush,
      harvest_date: parsed.data.harvest_date ?? current.harvest_date,
      description: parsed.data.description ?? current.description,
      tasting_notes: parsed.data.tasting_notes ?? current.tasting_notes,
      floral: parsed.data.floral ?? current.floral,
      fruity: parsed.data.fruity ?? current.fruity,
      malty: parsed.data.malty ?? current.malty,
      body: parsed.data.body ?? current.body,
      sweetness: parsed.data.sweetness ?? current.sweetness,
      earthy: parsed.data.earthy ?? current.earthy,
      aroma_tags: parsed.data.aroma_tags ?? current.aroma_tags,
      dry_leaf_appearance: parsed.data.dry_leaf_appearance ?? current.dry_leaf_appearance,
      dry_leaf_grade: parsed.data.dry_leaf_grade ?? current.dry_leaf_grade,
      dry_leaf_aroma: parsed.data.dry_leaf_aroma ?? current.dry_leaf_aroma,
      liquor_hue_hex: parsed.data.liquor_hue_hex ?? current.liquor_hue_hex,
      liquor_hue_name: parsed.data.liquor_hue_name ?? current.liquor_hue_name,
      liquor_clarity: parsed.data.liquor_clarity ?? current.liquor_clarity,
      liquor_body: parsed.data.liquor_body ?? current.liquor_body,
      wet_leaf_aroma: parsed.data.wet_leaf_aroma ?? current.wet_leaf_aroma,
      wet_leaf_oxidation: parsed.data.wet_leaf_oxidation ?? current.wet_leaf_oxidation,
      brew_temp: parsed.data.brew_temp ?? current.brew_temp,
      brew_seconds: parsed.data.brew_seconds ?? current.brew_seconds,
      leaf_dose_grams: parsed.data.leaf_dose_grams ?? current.leaf_dose_grams,
      water_ml: parsed.data.water_ml ?? current.water_ml,
      steep_count: parsed.data.steep_count ?? current.steep_count,
      steep_instructions: parsed.data.steep_instructions ?? current.steep_instructions,
      elevation_feet: parsed.data.elevation_feet ?? current.elevation_feet,
      elevation_display: parsed.data.elevation_display ?? current.elevation_display,
      lot_number: parsed.data.lot_number ?? current.lot_number,
      cultivar: parsed.data.cultivar ?? current.cultivar,
      estate_story: parsed.data.estate_story ?? current.estate_story,
      tea_moments: parsed.data.tea_moments,
      featured: parsed.data.featured ?? current.featured,
      ingredients: parsed.data.ingredients ?? current.ingredients ?? "",
      verified_origin: parsed.data.verified_origin ?? current.verified_origin ?? current.origin ?? "",
      status: parsed.data.status ?? current.status ?? "published",
      pdf_url: parsed.data.pdf_url !== undefined ? parsed.data.pdf_url : (current.pdf_url ?? null),
      pdf_title: parsed.data.pdf_title !== undefined ? parsed.data.pdf_title : (current.pdf_title ?? null),
      seo_title: parsed.data.seo_title !== undefined ? parsed.data.seo_title : (current.seo_title ?? null),
      seo_description: parsed.data.seo_description !== undefined ? parsed.data.seo_description : (current.seo_description ?? null),
      canonical_override: parsed.data.canonical_override !== undefined ? parsed.data.canonical_override : (current.canonical_override ?? null),
      noindex: parsed.data.noindex !== undefined ? parsed.data.noindex : (current.noindex ?? 0),
    });

    const stockParam = parsed.data.stock ?? (rawBody && typeof rawBody === "object" ? ((rawBody as Record<string, unknown>).inventory ?? (rawBody as Record<string, unknown>).stock) : undefined) as number | undefined;

    const result = upsertProduct({
      ...merged,
      images: parsed.data.images,
      id: prodId,
      slug: parsed.data.slug ?? current.slug,
      stock: stockParam,
      inventory: stockParam,
      price: parsed.data.price ?? (rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>).price : undefined) as number | string | undefined,
      price_paise: parsed.data.price_paise ?? (rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>).price_paise : undefined) as number | undefined,
      price_inr: parsed.data.price_inr ?? (rawBody && typeof rawBody === "object" ? (rawBody as Record<string, unknown>).price_inr : undefined) as number | undefined,
      // Variants ride the shared embedded upsert (MRP resolve/preserve/validate).
      // Never inline duplicate variant writes here: an older inline loop wiped
      // stored Original MRPs and accepted price_paise 0 on partial entries.
      variants: (rawBody && typeof rawBody === "object" && Array.isArray((rawBody as { variants?: unknown }).variants)
        ? (rawBody as { variants: Array<Record<string, unknown>> }).variants
        : undefined),
    });

    // Variants are handled inside upsertProduct's embedded upsert above
    // (MRP resolve/preserve/validate). No second write pass here.

    return NextResponse.json({ ...result, deduped: false });
  } catch (e) {
    logger.error("Admin products update error: " + (e instanceof Error ? e.message : String(e)));
    return conflict(e instanceof Error ? e.message : "Unable to update the product.");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleUpdate(request, params);
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleUpdate(request, params);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = guard(request);
  if (denied) return denied;

  const { id } = await params;
  const prodId = Number(id);
  const current = getProduct(prodId);
  if (!current) return notFound("Product not found.");

  const url = new URL(request.url);
  const forceArchive = url.searchParams.get("archive") === "true" || url.searchParams.get("soft") === "true";

  const db = getDb();
  // Safe deletion guard: check if any order_items reference this product's variants
  let orderCount = 0;
  try {
    const orderItemsCheck = db.prepare(`
      SELECT COUNT(*) AS count
      FROM order_items oi
      JOIN variants v ON oi.variant_id = v.id
      WHERE v.product_id = ?
    `).get(prodId) as { count: number } | undefined;
    orderCount = orderItemsCheck?.count ?? 0;
  } catch {
    orderCount = 0;
  }

  if (forceArchive) {
    archiveProduct(prodId);
    return NextResponse.json({
      archived: true,
      deleted: true,
      preserved_orders: orderCount > 0,
      order_count: orderCount,
      message: "Product has been archived and removed from active catalog."
    }, { status: 200 });
  }

  if (orderCount > 0) {
    return conflict(
      `Product cannot be deleted because it is referenced by ${orderCount} active or historical order item(s). Deletion is blocked to preserve order records. Pass ?archive=true to archive.`
    );
  }

  const deleted = deleteProduct(prodId, { archiveIfReferenced: false });
  return deleted ? new NextResponse(null, { status: 204 }) : notFound("Product not found.");
}
