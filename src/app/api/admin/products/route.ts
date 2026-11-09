import { NextResponse } from "next/server";
import { listProducts, upsertProduct, getProduct } from "@/lib/products";
import { productSchema, normalizeProductInput } from "@/lib/validation";
import { guard, invalid, conflict, keyOf } from "@/lib/adminHttp";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export function GET(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 1), 100);
  const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10) || 1, 1);
  const q = (url.searchParams.get("q") || "").slice(0, 100);
  const categoryIdParam = url.searchParams.get("categoryId");
  const categoryId = categoryIdParam ? parseInt(categoryIdParam, 10) : undefined;
  const stockFilter = url.searchParams.get("stockStatus") || url.searchParams.get("stock");
  const statusFilter = url.searchParams.get("status");
  const sort = url.searchParams.get("sort");

  let products = listProducts({
    q: q || undefined,
    categoryId: Number.isFinite(categoryId) ? categoryId : undefined,
    status: statusFilter ?? "all",
    includeDisabled: true,
  });

  // Stock status filtering
  if (stockFilter === "in_stock") {
    products = products.filter((p) => p.variants.reduce((acc, v) => acc + v.stock, 0) > 0);
  } else if (stockFilter === "out_of_stock") {
    products = products.filter((p) => p.variants.reduce((acc, v) => acc + v.stock, 0) === 0);
  } else if (stockFilter === "low_stock") {
    products = products.filter((p) => {
      const totalStock = p.variants.reduce((acc, v) => acc + v.stock, 0);
      return totalStock > 0 && totalStock <= 10;
    });
  }

  // Sorting
  if (sort === "name_asc") {
    products.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sort === "name_desc") {
    products.sort((a, b) => b.name.localeCompare(a.name));
  } else if (sort === "price_asc") {
    products.sort((a, b) => {
      const minA = a.variants.length ? Math.min(...a.variants.map((v) => v.price_paise)) : 0;
      const minB = b.variants.length ? Math.min(...b.variants.map((v) => v.price_paise)) : 0;
      return minA - minB;
    });
  } else if (sort === "price_desc") {
    products.sort((a, b) => {
      const minA = a.variants.length ? Math.min(...a.variants.map((v) => v.price_paise)) : 0;
      const minB = b.variants.length ? Math.min(...b.variants.map((v) => v.price_paise)) : 0;
      return minB - minA;
    });
  } else if (sort === "newest") {
    products.sort((a, b) => b.id - a.id);
  }

  const total = products.length;
  const offset = (page - 1) * limit;
  const pagedProducts = products.slice(offset, offset + limit);

  return NextResponse.json({
    products: pagedProducts,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit) || 1,
  });
}

export async function POST(request: Request) {
  const denied = guard(request);
  if (denied) return denied;

  const rawBody: unknown = await request.json().catch(() => null);
  const normalized = normalizeProductInput(rawBody);
  const parsed = productSchema.safeParse(normalized);
  if (!parsed.success) return invalid(parsed.error.flatten());

  try {
    // Variants[] and images[] ride inside upsertProduct's embedded sync
    // (MRP resolve/preserve/validate + single gallery write). Never duplicate
    // variant/image writes here: older inline loops overwrote rupee prices
    // with paise 0, wiped stored MRPs, and double-inserted gallery rows.
    const result = upsertProduct({ ...parsed.data, idempotencyKey: keyOf(request, parsed.data) });
    const productId = result.id;

    const fullProd = getProduct(productId);
    return NextResponse.json({
      ...result,
      ingredients: fullProd?.ingredients ?? "",
      verified_origin: fullProd?.verified_origin ?? "",
      status: fullProd?.status ?? "published",
      inventory: fullProd?.inventory ?? 0,
      product: fullProd,
      deduped: result.deduped
    }, { status: result.deduped ? 200 : 201 });
  } catch (e) {
    logger.error("Admin products POST error: " + (e instanceof Error ? e.message : String(e)));
    return conflict(e instanceof Error ? e.message : "Unable to save the product.");
  }
}
