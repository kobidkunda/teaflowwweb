import { NextResponse } from "next/server";
import { z } from "zod";
import { getVariant, getProduct } from "@/lib/products";
import { getProductImages } from "@/lib/storefront";
import { imagesForVariant } from "@/lib/imageVariants";
import { catalogItem, type TrackingItem } from "@/lib/seo/tracking";
import { TrialService } from "@/lib/trials/service";

export const runtime = "nodejs";
const querySchema = z.array(z.union([
  z.object({ variantId: z.number().int().positive() }).strict(),
  z.object({ trialId: z.string().trim().min(1).max(200) }).strict(),
])).max(100);

/** Public catalogue estimates; checkout still validates prices and stock independently. */
export function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("items");
  let input: unknown;
  try { input = JSON.parse(raw || "null"); } catch { input = null; }
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) return NextResponse.json({ error: "Invalid cart items." }, { status: 400 });

  try {
    const images: Record<string, string | null> = {};
    const tracking: Record<string, TrackingItem> = {};
    const prices: Record<string, number> = {};
    for (const item of parsed.data) {
      if ("trialId" in item) {
        const trial = TrialService.getPublicBySlug(item.trialId);
        images[`trial-${item.trialId}`] = trial?.hero_image?.url || null;
        if (trial) prices[`trial-${item.trialId}`] = trial.price_paise;
        if (trial) tracking[`trial-${item.trialId}`] = { item_id: trial.sku, item_name: trial.title, price: trial.price_paise / 100 };
      } else {
        const variant = getVariant(item.variantId);
        const product = variant ? getProduct(variant.product_id) : null;
        if (product?.status === "published" && product.is_enabled && variant) prices[`var-${item.variantId}`] = variant.price_paise;
        if (product?.status === "published" && product.is_enabled && variant) tracking[`var-${item.variantId}`] = catalogItem(product, variant);
        images[`var-${item.variantId}`] = product?.status === "published" && product.is_enabled
          ? imagesForVariant(getProductImages(product.id), variant!.sku, {
            format: variant!.packaging_format, variants: product.variants,
          })[0]?.url || null
          : null;
      }
    }
    return NextResponse.json({ images, ...(new URL(request.url).searchParams.get("includePrices") === "1" ? { prices } : {}), ...(new URL(request.url).searchParams.get("includeTracking") === "1" ? { tracking } : {}) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Unable to load cart images." }, { status: 500 });
  }
}
