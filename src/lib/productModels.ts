export type PackagingFormat = "loose_leaf_pouch" | "luxury_tin" | "pyramid_bags";

export interface WholesaleSlab {
  id?: number;
  product_id?: number;
  variant_id: number;
  min_qty: number;
  price_paise: number;
  created_at?: string;
}

export interface Variant {
  id: number;
  product_id: number;
  sku: string;
  packaging_format: PackagingFormat;
  grams: number;
  servings: number;
  price_paise: number;
  compare_at_price_paise?: number | null;
  stock: number;
  wholesale_slabs?: WholesaleSlab[];
  product_name?: string;
  product_slug?: string;
  product_category?: string;
  product_estate?: string;
  product_image_url?: string;
}

import type { TeaMomentsContent } from "./teaMoments";

export interface Product {
  tea_moments?: TeaMomentsContent | null;
  id: number;
  slug: string;
  name: string;
  category: string;
  category_id: number | null;
  origin: string;
  estate: string;
  flush: string;
  harvest_date: string;
  description: string;
  tasting_notes: string;
  ingredients?: string;
  verified_origin?: string;
  status?: "draft" | "published" | "archived";
  is_enabled?: number;
  is_draft?: boolean;
  inventory?: number;
  pdf_url?: string | null;
  pdf_title?: string | null;
  wholesale_moq?: number | null;

  // 6-Axis sensory profile (integers 0–5)
  floral: number;
  fruity: number;
  malty: number;
  body: number;
  sweetness: number;
  earthy: number;

  // Descriptive aroma tags (parsed array of strings)
  aroma_tags: string[];

  // 3-Stage professional cupping attributes
  dry_leaf_appearance: string;
  dry_leaf_grade: string;
  dry_leaf_aroma: string;
  liquor_hue_hex: string;
  liquor_hue_name: string;
  liquor_clarity: string;
  liquor_body: string;
  wet_leaf_aroma: string;
  wet_leaf_oxidation: string;

  // Interactive steeping parameters
  brew_temp: number;
  brew_seconds: number;
  leaf_dose_grams: number;
  water_ml: number;
  steep_count: number;
  steep_instructions: string;

  // Estate terroir dossier
  elevation_feet: number;
  elevation_display: string;
  lot_number: string;
  cultivar: string;
  estate_story: string;

  featured: number;
  price?: number;
  price_paise?: number;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_override?: string | null;
  noindex?: number;
  primary_image?: {
    url: string;
    alt_text: string;
  } | null;
  primary_image_url?: string;
  variants: Variant[];
  specs?: ProductSpecs;
}

export interface ProductSpecs {
  cupping: CuppingProfile;
  steeping: SteepingGuide;
  terroir: TerroirDossier;
  pricing: {
    price?: number;
    price_paise?: number;
    priceInr: number;
    pricePaise: number;
    minPricePaise: number;
    maxPricePaise: number;
    minPriceInr: number;
    maxPriceInr: number;
    variantCount: number;
  };
  packaging: {
    availableFormats: PackagingFormat[];
    variants: Array<{
      id: number;
      sku: string;
      format: PackagingFormat;
      grams: number;
      servings: number;
      pricePaise: number;
      priceInr: number;
      stock: number;
    }>;
  };
}

export interface CuppingProfile {
  dryLeaf: {
    appearance: string;
    grade: string;
    aroma: string;
  };
  liquor: {
    hueHex: string;
    hueName: string;
    clarity: string;
    body: string;
  };
  wetLeaf: {
    aroma: string;
    oxidation: string;
  };
  flavorScores: {
    floral: number;
    fruity: number;
    malty: number;
    body: number;
    sweetness: number;
    earthy: number;
  };
  scores?: {
    floral: number;
    fruity: number;
    malty: number;
    body: number;
    sweetness: number;
    earthy: number;
  };
  aromaTags: string[];
}

export interface SteepingGuide {
  brewTemp: number;
  brewSeconds: number;
  brew_temp?: number;
  brew_seconds?: number;
  leafDoseGrams: number;
  waterMl: number;
  steepCount: number;
  instructions: string;
}

export interface TerroirDossier {
  origin: string;
  estate: string;
  flush: string;
  harvestDate: string;
  elevationFeet: number;
  elevationDisplay: string;
  lotNumber: string;
  cultivar: string;
  estateStory: string;
}

export function parseAromaTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
  }
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed || trimmed === "[]") return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
          .map((item) => item.trim());
      }
    } catch {
      return trimmed
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  return [];
}

/**
 * Resolves a specific product variant matching the requested packaging format and pack size (in grams).
 */
export function resolveVariant(
  variants: Variant[],
  format: PackagingFormat,
  grams: number
): Variant | undefined {
  if (!Array.isArray(variants)) return undefined;
  return variants.find((v) => v.packaging_format === format && v.grams === grams);
}

/**
 * Returns the distinct list of packaging formats present among the variants.
 * Optional options.inStockOnly filters to formats with at least one in-stock variant.
 */
export function getAvailableFormats(
  variants: Variant[],
  options?: { inStockOnly?: boolean }
): PackagingFormat[] {
  if (!Array.isArray(variants)) return [];
  const formats: PackagingFormat[] = [];
  for (const v of variants) {
    if (options?.inStockOnly && v.stock <= 0) continue;
    if (v.packaging_format && !formats.includes(v.packaging_format)) {
      formats.push(v.packaging_format);
    }
  }
  return formats;
}

/**
 * Returns the distinct pack sizes (in grams) for a given packaging format, sorted ascending.
 * Optional options.inStockOnly filters to sizes that are currently in stock.
 */
export function getAvailableSizesForFormat(
  variants: Variant[],
  format: PackagingFormat,
  options?: { inStockOnly?: boolean }
): number[] {
  if (!Array.isArray(variants)) return [];
  const sizes = new Set<number>();
  for (const v of variants) {
    if (v.packaging_format === format && typeof v.grams === "number" && v.grams > 0) {
      if (options?.inStockOnly && v.stock <= 0) continue;
      sizes.add(v.grams);
    }
  }
  return Array.from(sizes).sort((a, b) => a - b);
}

/**
 * Returns whether a combination of packaging format and pack size exists and has available stock (> 0).
 */
export function isCombinationAvailable(
  variants: Variant[],
  format: PackagingFormat,
  grams: number
): boolean {
  const variant = resolveVariant(variants, format, grams);
  return Boolean(variant && variant.stock > 0);
}

export function getProductSpecs(product: Product): ProductSpecs {
  const vars = Array.isArray(product.variants) ? product.variants : [];
  const minPaise = vars.length > 0 ? Math.min(...vars.map((v) => v.price_paise)) : (product.price_paise ?? 19900);
  const maxPaise = vars.length > 0 ? Math.max(...vars.map((v) => v.price_paise)) : (product.price_paise ?? 19900);
  const pricePaise = product.price_paise ?? minPaise;
  const priceInr = product.price ?? Math.round(pricePaise / 100);

  return {
    cupping: {
      dryLeaf: {
        appearance: product.dry_leaf_appearance || "",
        grade: product.dry_leaf_grade || "",
        aroma: product.dry_leaf_aroma || "",
      },
      liquor: {
        hueHex: product.liquor_hue_hex || "#b36b3d",
        hueName: product.liquor_hue_name || "",
        clarity: product.liquor_clarity || "",
        body: product.liquor_body || "",
      },
      wetLeaf: {
        aroma: product.wet_leaf_aroma || "",
        oxidation: product.wet_leaf_oxidation || "",
      },
      flavorScores: {
        floral: product.floral ?? 0,
        fruity: product.fruity ?? 0,
        malty: product.malty ?? 0,
        body: product.body ?? 0,
        sweetness: product.sweetness ?? 0,
        earthy: product.earthy ?? 0,
      },
      scores: {
        floral: product.floral ?? 0,
        fruity: product.fruity ?? 0,
        malty: product.malty ?? 0,
        body: product.body ?? 0,
        sweetness: product.sweetness ?? 0,
        earthy: product.earthy ?? 0,
      },
      aromaTags: Array.isArray(product.aroma_tags) ? product.aroma_tags : parseAromaTags(product.aroma_tags),
    },
    steeping: {
      brewTemp: product.brew_temp,
      brewSeconds: product.brew_seconds,
      brew_temp: product.brew_temp,
      brew_seconds: product.brew_seconds,
      leafDoseGrams: product.leaf_dose_grams ?? 2.5,
      waterMl: product.water_ml ?? 200,
      steepCount: product.steep_count ?? 3,
      instructions: product.steep_instructions || "",
    },
    terroir: {
      origin: product.origin,
      estate: product.estate,
      flush: product.flush,
      harvestDate: product.harvest_date,
      elevationFeet: product.elevation_feet ?? 0,
      elevationDisplay: product.elevation_display || "",
      lotNumber: product.lot_number || "",
      cultivar: product.cultivar || "",
      estateStory: product.estate_story || "",
    },
    pricing: {
      price: priceInr,
      price_paise: pricePaise,
      priceInr,
      pricePaise,
      minPricePaise: minPaise,
      maxPricePaise: maxPaise,
      minPriceInr: Math.round(minPaise / 100),
      maxPriceInr: Math.round(maxPaise / 100),
      variantCount: vars.length,
    },
    packaging: {
      availableFormats: getAvailableFormats(vars),
      variants: vars.map((v) => ({
        id: v.id,
        sku: v.sku,
        format: v.packaging_format,
        grams: v.grams,
        servings: v.servings,
        pricePaise: v.price_paise,
        priceInr: Math.round(v.price_paise / 100),
        stock: v.stock,
      })),
    },
  };
}
