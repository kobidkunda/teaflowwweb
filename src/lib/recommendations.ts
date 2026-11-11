import { getDb } from "@/lib/db";
import { enabledProductCondition } from "@/lib/productAvailability";
import { TrialService } from "@/lib/trials/service";
import { getProductImages } from "@/lib/storefront";
import { logger } from "@/lib/logger";
import type { Product, Variant, RawProductRow, RawVariantRow } from "@/lib/products";

export interface RecommendationItem {
  id: string; // e.g. "prod-48" or "trial-4-x-25-gm"
  type: "product" | "sample";
  slug: string;
  name: string;
  category: string;
  badge: string; // e.g. "Sample Pack" | "Similar Recipe" | "Artisan Blend"
  tagline?: string;
  origin?: string;
  flush?: string;
  tastingNotes: string;
  sampleComponents?: Array<{ name: string; weightG: number }>;
  weightDisplay: string; // e.g. "100g Pouch" or "4 × 25g (100g total)"
  pricePaise: number;
  compareAtPricePaise?: number | null;
  imageUrl?: string | null;
  href: string; // "/tea/elaichi-milk-chai" or "/trials/4-x-25-gm"
  inStock: boolean;
  cartPayload?: {
    variantId: number;
    trialId?: string;
    sku?: string;
    slug: string;
    name: string;
    grams: number;
    pricePaise: number;
  };
}

export interface RecommendationOptions {
  maxSimilar?: number;
  maxSamples?: number;
}

/**
 * Retrieves similar full-size orthodox/CTC teas and curated discovery sample kits
 * for a given tea PDP.
 */
export function getRecommendationsForProduct(
  product: Product,
  options: RecommendationOptions = {}
): RecommendationItem[] {
  const maxSimilar = options.maxSimilar ?? 4;
  const maxSamples = options.maxSamples ?? 2;
  const db = getDb();

  // 1. Query similar products in the same category (or closely related category)
  const similarRows = db
    .prepare(
      `SELECT * FROM products
       WHERE category = ?
         AND id != ?
         AND status = 'published'
         AND ${enabledProductCondition()}
       ORDER BY featured DESC, id ASC
       LIMIT ?`
    )
    .all(product.category, product.id, maxSimilar) as RawProductRow[];

  // If fewer than desired similar products in the exact category, find products in related categories
  if (similarRows.length < maxSimilar) {
    const needed = maxSimilar - similarRows.length;
    const existingIds = [product.id, ...similarRows.map((r) => r.id)];
    const placeholders = existingIds.map(() => "?").join(",");

    let fallbackQuery = "";
    const isChaiOrMilkTea =
      product.category.toLowerCase().includes("chai") ||
      product.category.toLowerCase().includes("milk") ||
      product.name.toLowerCase().includes("chai") ||
      product.name.toLowerCase().includes("kadak");

    if (isChaiOrMilkTea) {
      // Find other chai or bold CTC black teas
      fallbackQuery = `
        SELECT * FROM products
        WHERE id NOT IN (${placeholders})
          AND status = 'published'
          AND ${enabledProductCondition()}
          AND (
            category IN ('Chai', 'Everyday Milk Chai', 'Regional Tea Origins', 'Bengal Signature Blends')
            OR name LIKE '%chai%'
            OR name LIKE '%ctc%'
            OR name LIKE '%kadak%'
          )
        ORDER BY featured DESC, id ASC
        LIMIT ?
      `;
    } else {
      // Find other teas of similar style or featured
      fallbackQuery = `
        SELECT * FROM products
        WHERE id NOT IN (${placeholders})
          AND status = 'published'
          AND ${enabledProductCondition()}
        ORDER BY featured DESC, id ASC
        LIMIT ?
      `;
    }

    const fallbackRows = db
      .prepare(fallbackQuery)
      .all(...existingIds, needed) as RawProductRow[];

    similarRows.push(...fallbackRows);
  }

  // Map similar products into RecommendationItem
  const similarItems: RecommendationItem[] = [];
  for (const row of similarRows) {
    const rawVariants = db
      .prepare("SELECT * FROM variants WHERE product_id = ? ORDER BY price_paise ASC")
      .all(row.id) as RawVariantRow[];

    const inStockVariant =
      rawVariants.find((v) => v.stock > 0) || rawVariants[0];

    const images = getProductImages(row.id);
    const primaryImg =
      inStockVariant?.product_image_url ||
      (images.length > 0 ? images[0].url : null);

    const pricePaise = inStockVariant?.price_paise ?? 0;
    const grams = inStockVariant?.grams ?? 100;
    const inStock = Boolean(inStockVariant && inStockVariant.stock > 0);

    const isSameCategory = row.category === product.category;
    const badge = isSameCategory ? "SIMILAR RECIPE" : "EXPLORE BLEND";

    similarItems.push({
      id: `prod-${row.id}`,
      type: "product",
      slug: row.slug,
      name: row.name,
      category: row.category,
      badge,
      origin: row.origin,
      flush: row.flush,
      tastingNotes: row.tasting_notes || "",
      weightDisplay: `${grams}g pouch`,
      pricePaise,
      compareAtPricePaise: inStockVariant?.compare_at_price_paise || null,
      imageUrl: primaryImg,
      href: `/tea/${row.slug}`,
      inStock,
      cartPayload: inStockVariant
        ? {
            variantId: inStockVariant.id,
            sku: inStockVariant.sku,
            slug: row.slug,
            name: row.name,
            grams,
            pricePaise,
          }
        : undefined,
    });
  }

  // 2. Query published discovery trials / sample kits
  const sampleItems: RecommendationItem[] = [];
  try {
    const { trials } = TrialService.listPublic({ limit: 10 });
    const isChaiOrMilkTea =
      product.category.toLowerCase().includes("chai") ||
      product.category.toLowerCase().includes("milk") ||
      product.name.toLowerCase().includes("chai") ||
      product.name.toLowerCase().includes("kadak");

    // Prioritize trials relevant to the product style
    const sortedTrials = [...trials].sort((a, b) => {
      if (isChaiOrMilkTea) {
        const aIsChai =
          a.title.toLowerCase().includes("chai") ||
          a.slug.includes("4-x-25-gm") ||
          a.slug.includes("discovery") ||
          a.slug.includes("stall");
        const bIsChai =
          b.title.toLowerCase().includes("chai") ||
          b.slug.includes("4-x-25-gm") ||
          b.slug.includes("discovery") ||
          b.slug.includes("stall");
        if (aIsChai && !bIsChai) return -1;
        if (!aIsChai && bIsChai) return 1;
      }
      return 0;
    });

    const selectedTrials = sortedTrials.slice(0, maxSamples);

    for (const trial of selectedTrials) {
      // Illustrated / pack artwork fallback if hero image not uploaded
      const imageUrl =
        trial.hero_image?.url || "/images/trials/discovery-shelf-kit.webp";

      const componentNames = trial.components.map((c) => ({
        name: c.name,
        weightG: c.weight_g,
      }));

      const pouchCount = trial.components.length || 4;
      const pouchWeight = trial.components[0]?.weight_g ?? Math.round(trial.net_weight_g / pouchCount);

      sampleItems.push({
        id: `trial-${trial.id}`,
        type: "sample",
        slug: trial.slug,
        name: trial.title,
        category: "Tasting Sample Kit",
        badge: "SAMPLE PACK",
        tagline: trial.tagline || "4 craft teas to taste & compare in your own kettle",
        tastingNotes:
          trial.description
            ? trial.description.slice(0, 140) + "…"
            : "Taste four single-estate teas before committing to a full caddy.",
        sampleComponents: componentNames,
        weightDisplay: `${pouchCount} × ${pouchWeight}g (${trial.net_weight_g}g total)`,
        pricePaise: trial.price_paise,
        compareAtPricePaise: trial.compare_at_price_paise,
        imageUrl,
        href: `/trials/${trial.slug}`,
        inStock: trial.in_stock,
        cartPayload: {
          variantId: 0,
          trialId: trial.id,
          sku: trial.sku,
          slug: trial.slug,
          name: trial.title,
          grams: trial.net_weight_g,
          pricePaise: trial.price_paise,
        },
      });
    }
  } catch (err) {
    // Graceful degradation if trials service encounters an issue
    logger.warn("recommendations: failed to load trial samples", { error: String(err) });
  }

  // Check if Gift Discovery Flight product (id 6) is available as an additional sample option
  if (sampleItems.length < maxSamples) {
    const giftFlightRow = db
      .prepare(
        `SELECT * FROM products
         WHERE (slug = 'discovery-flight' OR id = 6)
           AND status = 'published'
           AND ${enabledProductCondition()}
         LIMIT 1`
      )
      .get() as RawProductRow | undefined;

    if (giftFlightRow && giftFlightRow.id !== product.id) {
      const rawVariants = db
        .prepare("SELECT * FROM variants WHERE product_id = ? ORDER BY price_paise ASC")
        .all(giftFlightRow.id) as RawVariantRow[];
      const firstVar = rawVariants[0];
      const images = getProductImages(giftFlightRow.id);

      sampleItems.push({
        id: `prod-${giftFlightRow.id}`,
        type: "sample",
        slug: giftFlightRow.slug,
        name: giftFlightRow.name,
        category: "Tasting Flight",
        badge: "SAMPLER FLIGHT",
        tagline: "Curated 4-tin tasting flight spanning single-estate Himalayan harvests",
        tastingNotes: giftFlightRow.tasting_notes,
        weightDisplay: "Curated gift flight",
        pricePaise: firstVar?.price_paise ?? 0,
        compareAtPricePaise: firstVar?.compare_at_price_paise || null,
        imageUrl: images[0]?.url || firstVar?.product_image_url || "/uploads/product-herbal-tin.jpg",
        href: `/tea/${giftFlightRow.slug}`,
        inStock: Boolean(firstVar && firstVar.stock > 0),
        cartPayload: firstVar
          ? {
              variantId: firstVar.id,
              sku: firstVar.sku,
              slug: giftFlightRow.slug,
              name: giftFlightRow.name,
              grams: firstVar.grams,
              pricePaise: firstVar.price_paise,
            }
          : undefined,
      });
    }
  }

  // Combine recommendations: sample pack placed prominently alongside similar teas
  // Layout in "All Suggestions": Sample Pack first or right next to similar teas
  const combined: RecommendationItem[] = [];
  if (sampleItems.length > 0) {
    combined.push(sampleItems[0]); // Primary sample pack (e.g. 4x25g discovery trial pack)
  }
  for (const sim of similarItems) {
    combined.push(sim);
  }
  if (sampleItems.length > 1) {
    combined.push(sampleItems[1]);
  }

  return combined;
}
