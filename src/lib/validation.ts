import { z } from "zod";
import { teaMomentsSchema } from "./teaMoments";
export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{4,24}$/, "Enter a valid coupon code.")
  .optional();
export const checkoutSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  address: z.string().trim().min(10).max(400),
  idempotencyKey: z.string().uuid(),
  couponCode: couponCodeSchema,
  items: z.array(z.object({
    variantId: z.number().int().positive(),
    quantity: z.number().int().min(1).max(20)
  })).min(1).max(30)
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

export const cartItemSchema = z.object({
  variantId: z.number().int().positive(),
  quantity: z.number().int().positive().max(10),
});
export type CartItemInput = z.infer<typeof cartItemSchema>;

// ---- Admin (§3 contracts) ----
const boolInt = z.union([z.boolean(), z.number().int().min(0).max(1)]).transform((v) => (v === true || v === 1 ? 1 : 0));
const isoDate = z.string().datetime({ offset: true }).or(z.string().datetime()).nullable().optional();
const urlRef = z.string().trim().min(1).max(500).refine(
  (s) => s.startsWith("/") || /^https?:\/\/.+/i.test(s), { message: "Must be a site-relative path or http(s) URL." });

export const idempotencyKeySchema = z.string().uuid().optional();
export const paginationSchema = z.object({
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const categorySchema = z.object({
  slug: z.string().trim().toLowerCase().min(3).max(40).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only."),
  name: z.string().trim().min(2).max(60),
  sort_order: z.number().int().min(0).default(0),
  is_active: boolInt.default(1),
  cover_image_url: z.string().trim().max(500).nullable().optional(),
  description: z.string().trim().max(1000).optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  seo_title: z.string().trim().max(200).nullable().optional(),
  seo_description: z.string().trim().max(500).nullable().optional(),
  canonical_override: z.string().trim().max(500).nullable().optional(),
  noindex: boolInt.default(0),
  idempotencyKey: idempotencyKeySchema,
});
export type CategoryInput = z.infer<typeof categorySchema>;

export const packagingFormatSchema = z.enum([
  "loose_leaf_pouch",
  "luxury_tin",
  "pyramid_bags",
]);
export type PackagingFormatType = z.infer<typeof packagingFormatSchema>;

export const imageVariantSkusSchema = z.array(z.string().trim().min(1).max(24)).max(100)
  .refine((skus) => new Set(skus).size === skus.length, "Select each variant only once.");
export const galleryImageSchema = z.object({
  id: z.number().int().positive().optional(),
  media_id: z.number().int().positive().nullable().optional(),
  url: urlRef,
  alt_text: z.string().trim().max(200).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_primary: boolInt.optional(),
  variant_skus: imageVariantSkusSchema.optional(),
});

export const productSchema = z.object({
  tea_moments: teaMomentsSchema.nullable().optional(),
  id: z.number().int().positive().optional(),
  slug: z.string().trim().toLowerCase().min(3).max(80).regex(/^[a-z0-9-]+$/),
  name: z.string().trim().min(2).max(120),
  category_id: z.number().int().positive().nullable().optional(),
  category: z.string().trim().max(100).optional(),
  origin: z.string().trim().max(120),
  verified_origin: z.string().trim().max(200).default(""),
  ingredients: z.union([
    z.string().trim().max(1000),
    z.array(z.string().trim().max(100)).transform((arr) => arr.join(", "))
  ]).default(""),
  status: z.enum(["draft", "published", "archived"]).default("published"),
  is_draft: boolInt.optional(),
  draft: z.boolean().optional(),
  estate: z.string().trim().max(120),
  flush: z.string().trim().max(60),
  harvest_date: z.string().trim().max(80),
  description: z.string().trim().max(2000),
  tasting_notes: z.string().trim().max(500),
  floral: z.number().int().min(0).max(5).default(0),
  fruity: z.number().int().min(0).max(5).default(0),
  malty: z.number().int().min(0).max(5).default(0),
  body: z.number().int().min(0).max(5).default(0),
  sweetness: z.number().int().min(0).max(5).default(0),
  earthy: z.number().int().min(0).max(5).default(0),
  aroma_tags: z.union([
    z.array(z.string().trim().min(1).max(50)).max(20),
    z.string().trim()
  ]).transform((val) => {
    if (Array.isArray(val)) return val;
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.map(String).filter((s) => s.trim().length > 0);
    } catch {
      if (val.trim()) return val.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }).default([]),
  dry_leaf_appearance: z.string().trim().max(300).default(""),
  dry_leaf_grade: z.string().trim().max(100).default(""),
  dry_leaf_aroma: z.string().trim().max(300).default(""),
  liquor_hue_hex: z.string().trim().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "Valid hex color code required").default("#b36b3d"),
  liquor_hue_name: z.string().trim().max(100).default(""),
  liquor_clarity: z.string().trim().max(100).default(""),
  liquor_body: z.string().trim().max(100).default(""),
  wet_leaf_aroma: z.string().trim().max(300).default(""),
  wet_leaf_oxidation: z.string().trim().max(100).default(""),
  brew_temp: z.number().int().min(50).max(100),
  brew_seconds: z.number().int().min(30).max(600),
  leaf_dose_grams: z.number().min(0.5).max(20).default(2.5),
  water_ml: z.number().int().min(50).max(2000).default(200),
  steep_count: z.number().int().min(1).max(10).default(3),
  steep_instructions: z.string().trim().max(1000).default(""),
  elevation_feet: z.number().int().min(0).max(30000).default(0),
  elevation_display: z.string().trim().max(100).default(""),
  lot_number: z.string().trim().max(60).default(""),
  cultivar: z.string().trim().max(100).default(""),
  estate_story: z.string().trim().max(3000).default(""),
  featured: boolInt.default(0),
  price: z.union([
    z.number().min(0, "Price cannot be negative"),
    z.string().regex(/^\d+(\.\d+)?$/, "Price must be non-negative"),
  ]).optional(),
  price_paise: z.number().int().min(0).optional(),
  price_inr: z.number().min(0).optional(),
  stock: z.number().int().min(0).optional(),
  inventory: z.number().int().min(0).optional(),
  variants: z.array(z.record(z.string(), z.unknown())).optional(),
  images: z.array(galleryImageSchema).max(100).optional(),
  pdf_url: z.string().trim().max(500).nullable().optional(),
  pdf_title: z.string().trim().max(200).nullable().optional(),
  seo_title: z.string().trim().max(200).nullable().optional(),
  seo_description: z.string().trim().max(500).nullable().optional(),
  canonical_override: z.string().trim().max(500).nullable().optional(),
  noindex: boolInt.default(0),
  idempotencyKey: idempotencyKeySchema,
});
export type ProductInput = z.input<typeof productSchema>;

/**
 * Normalizes loose product payloads (e.g. from API or MCP calls that provide
 * minimal fields like name, price, stock) without fabricating fictional details.
 */
export function normalizeProductInput(raw: unknown): Record<string, unknown> {
  const data = typeof raw === "object" && raw !== null ? { ...(raw as Record<string, unknown>) } : {};
  if (data.id !== undefined && data.id !== null) {
    const numId = Number(data.id);
    if (!isNaN(numId) && numId > 0) data.id = numId;
  }
  if (!data.slug && typeof data.name === "string" && data.name.trim()) {
    data.slug = data.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  } else if (typeof data.slug === "string") {
    data.slug = data.slug.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  // Handle inventory alias for stock
  if (data.inventory !== undefined && data.inventory !== null && data.stock === undefined) {
    const inv = Number(data.inventory);
    if (!isNaN(inv)) data.stock = Math.max(0, Math.round(inv));
  } else if (data.stock !== undefined && data.stock !== null && data.inventory === undefined) {
    const stk = Number(data.stock);
    if (!isNaN(stk)) data.inventory = Math.max(0, Math.round(stk));
  }

  // Handle draft / publish status
  if (data.publish === true || data.published === true || data.draft === false || data.is_draft === false || data.is_draft === 0 || data.status === "published" || data.draft_status === "published" || data.publication_status === "published" || data.publication_status_requested === "published") {
    data.status = "published";
    data.is_draft = 0;
  } else if (data.draft === true || data.is_draft === 1 || data.is_draft === true || data.status === "draft" || data.draft_status === "draft" || data.publication_status === "draft" || data.publication_status_requested === "draft") {
    data.status = "draft";
    data.is_draft = 1;
  } else if (data.status) {
    const st = String(data.status).toLowerCase().trim();
    if (["draft", "published", "archived"].includes(st)) {
      data.status = st;
      data.is_draft = st === "draft" ? 1 : 0;
    }
  }

  // Handle ingredients
  if (data.ingredients === undefined && data.ingredients_public !== undefined) {
    data.ingredients = data.ingredients_public;
  }
  if (Array.isArray(data.ingredients)) {
    data.ingredients = data.ingredients.map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const name = obj.ingredient || obj.name || obj.item || obj.title;
        const pct = obj.percentage || obj.percentage_draft || obj.percent;
        if (name && pct !== undefined && pct !== null) return `${name} (${pct}%)`;
        if (name) return String(name);
      }
      return String(item);
    }).filter(Boolean).join(", ");
  }

  // Handle steeping guide (flat or nested steeping / steeping_guide / steeping_trial_only)
  const steepObj = (data.steeping || data.steeping_guide || data.steeping_trial_only) as Record<string, unknown> | undefined;
  if (steepObj && typeof steepObj === "object") {
    if (data.brew_temp === undefined) data.brew_temp = steepObj.brew_temp ?? steepObj.brewTemp ?? steepObj.brew_temperature_C ?? steepObj.temp ?? steepObj.temperature;
    if (data.brew_seconds === undefined) data.brew_seconds = steepObj.brew_seconds ?? steepObj.brewSeconds ?? steepObj.steep_time_seconds ?? steepObj.seconds ?? steepObj.time;
    if (data.leaf_dose_grams === undefined) data.leaf_dose_grams = steepObj.leaf_dose_grams ?? steepObj.leafDoseGrams ?? steepObj.leaf_dose ?? steepObj.dose ?? steepObj.grams;
    if (data.water_ml === undefined) data.water_ml = steepObj.water_ml ?? steepObj.waterMl ?? steepObj.water ?? steepObj.volume;
    if (data.steep_count === undefined) data.steep_count = steepObj.steep_count ?? steepObj.steepCount ?? steepObj.re_steep_count ?? steepObj.steeps ?? steepObj.infusions;
    if (data.steep_instructions === undefined) data.steep_instructions = steepObj.steep_instructions ?? steepObj.steepInstructions ?? steepObj.instructions ?? steepObj.guide ?? steepObj.directions;
  }
  if (data.brew_temp === undefined && data.brewTemp !== undefined) data.brew_temp = data.brewTemp;
  if (data.brew_seconds === undefined && data.brewSeconds !== undefined) data.brew_seconds = data.brewSeconds;
  if (data.leaf_dose_grams === undefined && data.leafDoseGrams !== undefined) data.leaf_dose_grams = data.leafDoseGrams;
  if (data.water_ml === undefined && data.waterMl !== undefined) data.water_ml = data.waterMl;
  if (data.steep_count === undefined && data.steepCount !== undefined) data.steep_count = data.steepCount;
  if (data.steep_instructions === undefined && data.steepInstructions !== undefined) data.steep_instructions = data.steepInstructions;
  if (data.steep_instructions === undefined && data.instructions !== undefined) data.steep_instructions = data.instructions;

  // Numeric extraction helper for human/string inputs (e.g. "95°C", "2.5g", "200ml", "5,500 ft")
  const parseNum = (val: unknown): number | undefined => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "number" && !isNaN(val)) return val;
    if (typeof val === "string") {
      const match = val.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
      if (match) return Number(match[0]);
    }
    return undefined;
  };

  if (data.brew_temp !== undefined) {
    const n = parseNum(data.brew_temp);
    if (n !== undefined) data.brew_temp = Math.round(n);
  }
  if (data.brew_seconds !== undefined) {
    const n = parseNum(data.brew_seconds);
    if (n !== undefined) data.brew_seconds = Math.round(n);
  }
  if (data.leaf_dose_grams !== undefined) {
    const n = parseNum(data.leaf_dose_grams);
    if (n !== undefined) data.leaf_dose_grams = n;
  }
  if (data.water_ml !== undefined) {
    const n = parseNum(data.water_ml);
    if (n !== undefined) data.water_ml = Math.round(n);
  }
  if (data.steep_count !== undefined) {
    const n = parseNum(data.steep_count);
    if (n !== undefined) data.steep_count = Math.round(n);
  }
  if (data.elevation_feet !== undefined) {
    const n = parseNum(data.elevation_feet);
    if (n !== undefined) data.elevation_feet = Math.round(n);
  }
  for (const k of ["floral", "fruity", "malty", "body", "sweetness", "earthy"]) {
    if (data[k] !== undefined && typeof data[k] === "string") {
      const n = parseNum(data[k]);
      if (n !== undefined) data[k] = Math.round(n);
    }
  }

  // Handle cupping / sensory (flat or nested cupping / sensory_ratings_verified / dry_leaf / wet_leaf / liquor)
  const cupObj = data.cupping as Record<string, unknown> | undefined;
  if (cupObj && typeof cupObj === "object") {
    const scores = (cupObj.flavorScores || cupObj.scores) as Record<string, unknown> | undefined;
    if (scores && typeof scores === "object") {
      for (const k of ["floral", "fruity", "malty", "body", "sweetness", "earthy"]) {
        if (data[k] === undefined && scores[k] !== undefined) data[k] = scores[k];
      }
    }
    if (data.tasting_notes === undefined) data.tasting_notes = cupObj.tasting_notes ?? cupObj.tastingNotes;
    if (data.aroma_tags === undefined) data.aroma_tags = cupObj.aroma_tags ?? cupObj.aromaTags;
    const dry = cupObj.dryLeaf as Record<string, unknown> | undefined;
    if (dry && typeof dry === "object") {
      if (data.dry_leaf_appearance === undefined) data.dry_leaf_appearance = dry.appearance;
      if (data.dry_leaf_grade === undefined) data.dry_leaf_grade = dry.grade;
      if (data.dry_leaf_aroma === undefined) data.dry_leaf_aroma = dry.aroma;
    }
    const wet = cupObj.wetLeaf as Record<string, unknown> | undefined;
    if (wet && typeof wet === "object") {
      if (data.wet_leaf_aroma === undefined) data.wet_leaf_aroma = wet.aroma;
      if (data.wet_leaf_oxidation === undefined) data.wet_leaf_oxidation = wet.oxidation;
    }
    const liq = cupObj.liquor as Record<string, unknown> | undefined;
    if (liq && typeof liq === "object") {
      if (data.liquor_hue_hex === undefined) data.liquor_hue_hex = liq.hueHex ?? liq.hue_hex;
      if (data.liquor_hue_name === undefined) data.liquor_hue_name = liq.hueName ?? liq.hue_name;
      if (data.liquor_clarity === undefined) data.liquor_clarity = liq.clarity;
      if (data.liquor_body === undefined) data.liquor_body = liq.body;
    }
  }
  const sensoryObj = data.sensory_ratings_verified as Record<string, unknown> | undefined;
  if (sensoryObj && typeof sensoryObj === "object") {
    for (const k of ["floral", "fruity", "malty", "body", "sweetness", "earthy"]) {
      if (data[k] === undefined && sensoryObj[k] !== undefined && sensoryObj[k] !== null) data[k] = sensoryObj[k];
    }
  }
  const dryObj = data.dry_leaf as Record<string, unknown> | undefined;
  if (dryObj && typeof dryObj === "object") {
    if (data.dry_leaf_appearance === undefined) data.dry_leaf_appearance = dryObj.appearance ?? dryObj.appearance_verified;
    if (data.dry_leaf_grade === undefined) data.dry_leaf_grade = dryObj.grade ?? dryObj.grade_verified;
    if (data.dry_leaf_aroma === undefined) data.dry_leaf_aroma = dryObj.aroma ?? dryObj.dry_aroma_verified;
  }
  const wetObj = data.wet_leaf as Record<string, unknown> | undefined;
  if (wetObj && typeof wetObj === "object") {
    if (data.wet_leaf_aroma === undefined) data.wet_leaf_aroma = wetObj.aroma ?? wetObj.infusion_aroma_verified;
    if (data.wet_leaf_oxidation === undefined) data.wet_leaf_oxidation = wetObj.oxidation ?? wetObj.oxidation_character_verified;
  }
  const liqObj = data.liquor as Record<string, unknown> | undefined;
  if (liqObj && typeof liqObj === "object") {
    if (data.liquor_hue_hex === undefined) data.liquor_hue_hex = liqObj.hue_hex ?? liqObj.hue_hex_verified ?? liqObj.hueHex;
    if (data.liquor_hue_name === undefined) data.liquor_hue_name = liqObj.hue_name ?? liqObj.hue_name_verified ?? liqObj.hueName;
    if (data.liquor_clarity === undefined) data.liquor_clarity = liqObj.clarity ?? liqObj.clarity_and_body_verified;
    if (data.liquor_body === undefined) data.liquor_body = liqObj.body;
  }
  if (data.tasting_notes === undefined && data.tastingNotes !== undefined) data.tasting_notes = data.tastingNotes;
  if (data.tasting_notes === undefined && data.tasting_notes_summary_proposed !== undefined) data.tasting_notes = data.tasting_notes_summary_proposed;
  if (data.aroma_tags === undefined && data.aromaTags !== undefined) data.aroma_tags = data.aromaTags;
  if (data.aroma_tags === undefined && data.aroma_tags_proposed !== undefined) data.aroma_tags = data.aroma_tags_proposed;

  // Handle terroir / provenance (flat or nested terroir / provenance / provenance_verified)
  const terroirObj = (data.terroir || data.provenance || data.provenance_verified) as Record<string, unknown> | undefined;
  if (terroirObj && typeof terroirObj === "object") {
    if (data.origin === undefined) data.origin = terroirObj.origin ?? terroirObj.origin_region;
    if (data.verified_origin === undefined) data.verified_origin = terroirObj.verified_origin ?? terroirObj.origin_region ?? terroirObj.origin;
    if (data.estate === undefined) data.estate = terroirObj.estate ?? terroirObj.tea_estate;
    if (data.flush === undefined) data.flush = terroirObj.flush ?? terroirObj.flush_harvest_season;
    if (data.harvest_date === undefined) data.harvest_date = terroirObj.harvest_date ?? terroirObj.harvestDate;
    if (data.elevation_feet === undefined) data.elevation_feet = terroirObj.elevation_feet ?? terroirObj.elevationFeet ?? terroirObj.elevation;
    if (data.elevation_display === undefined) data.elevation_display = terroirObj.elevation_display ?? terroirObj.elevationDisplay;
    if (data.lot_number === undefined) data.lot_number = terroirObj.lot_number ?? terroirObj.lotNumber;
    if (data.cultivar === undefined) data.cultivar = terroirObj.cultivar;
    if (data.estate_story === undefined) data.estate_story = terroirObj.estate_story ?? terroirObj.estateStory;
  }
  if (data.harvest_date === undefined && data.harvestDate !== undefined) data.harvest_date = data.harvestDate;
  if (data.elevation_feet === undefined && data.elevationFeet !== undefined) data.elevation_feet = data.elevationFeet;
  if (data.elevation_display === undefined && data.elevationDisplay !== undefined) data.elevation_display = data.elevationDisplay;
  if (data.lot_number === undefined && data.lotNumber !== undefined) data.lot_number = data.lotNumber;
  if (data.estate_story === undefined && data.estateStory !== undefined) data.estate_story = data.estateStory;

  // Handle verified_origin and origin
  if (data.verified_origin === true) {
    data.verified_origin = data.origin ? String(data.origin) : "Verified Origin";
  } else if (data.verified_origin === false) {
    data.verified_origin = "";
  } else if (data.verified_origin !== undefined && data.verified_origin !== null) {
    data.verified_origin = String(data.verified_origin).trim();
  }
  if (data.verifiedOrigin === true) {
    data.verifiedOrigin = data.origin ? String(data.origin) : "Verified Origin";
  } else if (data.verifiedOrigin === false) {
    data.verifiedOrigin = "";
  } else if (data.verifiedOrigin !== undefined && data.verifiedOrigin !== null) {
    data.verifiedOrigin = String(data.verifiedOrigin).trim();
  }

  if (data.verified_origin && !data.origin) {
    data.origin = String(data.verified_origin);
  } else if (data.verifiedOrigin && !data.verified_origin) {
    data.verified_origin = String(data.verifiedOrigin);
    if (!data.origin) data.origin = String(data.verifiedOrigin);
  } else if (data.origin && !data.verified_origin) {
    data.verified_origin = String(data.origin);
  }
  if (data.origin === undefined) data.origin = "";
  if (data.verified_origin === undefined) data.verified_origin = "";
  if (data.ingredients === undefined) data.ingredients = "";
  if (data.estate === undefined) data.estate = "";
  if (data.flush === undefined) data.flush = "";
  if (data.harvest_date === undefined) data.harvest_date = "";
  if (data.description === undefined) data.description = "";
  if (data.tasting_notes === undefined) data.tasting_notes = "";
  if (data.brew_temp === undefined) data.brew_temp = 90;
  if (data.brew_seconds === undefined) data.brew_seconds = 180;

  // Handle ingredients array if passed as array
  if (Array.isArray(data.ingredients)) {
    data.ingredients = data.ingredients.map(String).join(", ");
  }

  // Handle category / category_id
  if (data.categoryId !== undefined && data.category_id === undefined) {
    data.category_id = Number(data.categoryId);
  }

  // Pricing normalization
  if (data.price !== undefined && data.price !== null) {
    const num = Number(data.price);
    if (!isNaN(num)) {
      data.price = num;
      if (data.price_paise === undefined) {
        data.price_paise = Math.round(num * 100);
      }
    }
  } else if (data.price_paise !== undefined && data.price_paise !== null) {
    const paise = Number(data.price_paise);
    if (!isNaN(paise)) {
      data.price_paise = Math.round(paise);
      if (data.price === undefined) {
        data.price = Number((paise / 100).toFixed(2));
      }
    }
  } else if (data.price_inr !== undefined && data.price_inr !== null) {
    const num = Number(data.price_inr);
    if (!isNaN(num)) {
      data.price = num;
      if (data.price_paise === undefined) {
        data.price_paise = Math.round(num * 100);
      }
    }
  }

  return data;
}

/**
 * Normalizes loose variant payloads (e.g. from API or MCP calls).
 */
export function normalizeVariantInput(raw: unknown): Record<string, unknown> {
  const data = typeof raw === "object" && raw !== null ? { ...(raw as Record<string, unknown>) } : {};
  if (data.id !== undefined && data.id !== null) {
    const numId = Number(data.id);
    if (!isNaN(numId) && numId > 0) data.id = numId;
  }
  if (data.product_id !== undefined && data.product_id !== null) {
    const pId = Number(data.product_id);
    if (!isNaN(pId) && pId > 0) data.product_id = pId;
  }
  if (data.grams !== undefined && data.grams !== null) {
    const g = Number(data.grams);
    if (!isNaN(g) && g > 0) data.grams = Math.round(g);
  } else {
    data.grams = 100;
  }

  // Price normalization
  if (data.price !== undefined && data.price !== null) {
    const p = Number(data.price);
    if (!isNaN(p)) {
      data.price_paise = p > 10000 ? Math.round(p) : Math.round(p * 100);
    }
  } else if (data.price_inr !== undefined && data.price_inr !== null) {
    const p = Number(data.price_inr);
    if (!isNaN(p)) {
      data.price_paise = Math.round(p * 100);
    }
  } else if (data.price_paise !== undefined && data.price_paise !== null) {
    const p = Number(data.price_paise);
    if (!isNaN(p)) data.price_paise = Math.round(p);
  } else {
    data.price_paise = 19900;
  }

  // Stock / inventory normalization
  if (data.inventory !== undefined && data.inventory !== null && data.stock === undefined) {
    const inv = Number(data.inventory);
    if (!isNaN(inv)) data.stock = Math.max(0, Math.round(inv));
  } else if (data.stock !== undefined && data.stock !== null) {
    const stk = Number(data.stock);
    if (!isNaN(stk)) data.stock = Math.max(0, Math.round(stk));
  } else {
    data.stock = 50;
  }

  // MRP / compare-at normalization (discount strike-through price).
  // Canonical output: compare_at_price_paise (paise int >= 0) or null to
  // clear the discount. Absent entirely stays undefined so update paths can
  // preserve the stored MRP. Explicit null/"" resolves to null ("clear").
  // Aliases: mrp_paise (paise), mrp_inr / mrp / compare_at_price (rupees).
  // Invalid values resolve to undefined (aliases removed); callers that need
  // to distinguish "omitted" from "invalid" should inspect the original args.
  {
    const mrpKeys = ["compare_at_price_paise", "mrp_paise", "mrp_inr", "mrp", "compare_at_price"] as const;
    for (const key of mrpKeys) {
      const v = data[key];
      if (v === undefined) continue;
      if (v === null || (typeof v === "string" && v.trim() === "")) {
        data.compare_at_price_paise = null;
      } else {
        const n = Number(v);
        const paise = key === "compare_at_price_paise" || key === "mrp_paise" ? Math.round(n) : Math.round(n * 100);
        if (v !== "" && !isNaN(n) && paise >= 0 && paise <= 10000000) {
          data.compare_at_price_paise = paise;
        } else {
          delete data.compare_at_price_paise;
        }
      }
      if (key !== "compare_at_price_paise") delete data[key];
      break;
    }
  }

  // Packaging format normalization
  if (typeof data.packaging_format === "string") {
    const s = data.packaging_format.toLowerCase().replace(/[\s-]+/g, "_").trim();
    if (s.includes("tin")) data.packaging_format = "luxury_tin";
    else if (s.includes("bag") || s.includes("pyramid")) data.packaging_format = "pyramid_bags";
    else if (s.includes("pouch") || s.includes("loose")) data.packaging_format = "loose_leaf_pouch";
    else if (["loose_leaf_pouch", "luxury_tin", "pyramid_bags"].includes(s)) data.packaging_format = s;
    else data.packaging_format = "loose_leaf_pouch";
  } else if (!data.packaging_format) {
    data.packaging_format = "loose_leaf_pouch";
  }

  // SKU normalization
  if (typeof data.sku === "string" && data.sku.trim()) {
    data.sku = data.sku.trim().toUpperCase().replace(/[^A-Z0-9-]/g, "-").replace(/^-|-$/g, "");
  }

  if (data.servings !== undefined && data.servings !== null) {
    const srv = Number(data.servings);
    if (!isNaN(srv) && srv > 0) data.servings = Math.round(srv);
  } else {
    data.servings = Math.max(1, Math.round((Number(data.grams) || 100) / 2));
  }

  return data;
}

export const variantSchema = z.object({
  id: z.number().int().positive().optional(),
  product_id: z.number().int().positive(),
  sku: z.string().trim().min(3).max(24).regex(/^[A-Z0-9-]+$/, "Uppercase letters, numbers and hyphens only."),
  grams: z.number().int().positive(),
  price_paise: z.number().int().min(0),
  compare_at_price_paise: z.number().int().min(0).nullable().optional(),
  stock: z.number().int().min(0),
  packaging_format: packagingFormatSchema.default("loose_leaf_pouch"),
  servings: z.number().int().min(1).max(1000).default(50),
  idempotencyKey: idempotencyKeySchema,
});
export type VariantInput = z.input<typeof variantSchema>;

export const productImageSchema = z.object({
  variant_skus: imageVariantSkusSchema.optional(),
  product_id: z.number().int().positive(),
  media_id: z.number().int().positive().nullable().optional(),
  url: urlRef,
  alt_text: z.string().trim().max(200),
  sort_order: z.number().int().min(0).default(0),
  is_primary: boolInt.default(0),
  idempotencyKey: idempotencyKeySchema,
});
export type ProductImageInput = z.infer<typeof productImageSchema>;

export const sliderSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().max(200).default(""),
  image_url: urlRef,
  bg_image_url: urlRef.optional(),
  fg_image_url: z.union([urlRef, z.literal("")]).optional(),
  card_image_url: z.union([urlRef, z.literal("")]).optional(),
  cta_label: z.string().trim().max(40).default(""),
  cta_href: z.string().trim().max(500).default("").refine(
    (s) => s === "" || s.startsWith("/") || /^https?:\/\/.+/i.test(s), { message: "Must be empty, site-relative or http(s)." }),
  sort_order: z.number().int().min(0).default(0),
  is_active: boolInt.default(1),
  starts_at: isoDate,
  ends_at: isoDate,
  media_id: z.number().int().positive().nullable().optional(),
  fg_media_id: z.number().int().positive().nullable().optional(),
  card_tag: z.string().trim().max(100).default(""),
  card_title: z.string().trim().max(100).default(""),
  card_subtitle: z.string().trim().max(150).default(""),
  card_tasting_notes: z.string().trim().max(150).default(""),
  card_quote: z.string().trim().max(200).default(""),
  card_badge: z.string().trim().max(50).default(""),
  card_cta_label: z.string().trim().max(50).default(""),
  card_cta_href: z.string().trim().max(500).default("").refine(
    (s) => s === "" || s.startsWith("/") || /^https?:\/\/.+/i.test(s), { message: "Must be empty, site-relative or http(s)." }),
  card_enabled: boolInt.default(1),
  chapter_label: z.string().trim().max(80).default(""),
  page_target: z.enum(["home", "shop", "all"]).default("home"),
  category_slug: z.string().trim().max(50).default(""),
  idempotencyKey: idempotencyKeySchema,
});
export type SliderInput = z.input<typeof sliderSchema>;

export const sliderUpdateSchema = z.object({
  id: z.number().int().positive().optional(),
  title: z.string().trim().min(2).max(80).optional(),
  subtitle: z.string().trim().max(200).optional(),
  image_url: urlRef.optional(),
  bg_image_url: urlRef.optional(),
  fg_image_url: z.union([urlRef, z.literal("")]).optional(),
  card_image_url: z.union([urlRef, z.literal("")]).optional(),
  cta_label: z.string().trim().max(40).optional(),
  cta_href: z.string().trim().max(500).refine(
    (s) => s === "" || s.startsWith("/") || /^https?:\/\/.+/i.test(s), { message: "Must be empty, site-relative or http(s)." }).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: boolInt.optional(),
  starts_at: isoDate,
  ends_at: isoDate,
  media_id: z.number().int().positive().nullable().optional(),
  fg_media_id: z.number().int().positive().nullable().optional(),
  card_tag: z.string().trim().max(100).optional(),
  card_title: z.string().trim().max(100).optional(),
  card_subtitle: z.string().trim().max(150).optional(),
  card_tasting_notes: z.string().trim().max(150).optional(),
  card_quote: z.string().trim().max(200).optional(),
  card_badge: z.string().trim().max(50).optional(),
  card_cta_label: z.string().trim().max(50).optional(),
  card_cta_href: z.string().trim().max(500).refine(
    (s) => s === "" || s.startsWith("/") || /^https?:\/\/.+/i.test(s), { message: "Must be empty, site-relative or http(s)." }).optional(),
  card_enabled: boolInt.optional(),
  chapter_label: z.string().trim().max(80).optional(),
  page_target: z.enum(["home", "shop", "all"]).optional(),
  category_slug: z.string().trim().max(50).optional(),
  idempotencyKey: idempotencyKeySchema,
});
export type SliderUpdateInput = z.infer<typeof sliderUpdateSchema>;

export const couponSchema = z.object({
  code: z.string().trim().toUpperCase().min(4).max(24).regex(/^[A-Z0-9-]+$/),
  kind: z.enum(["percent", "flat"]),
  value: z.number().int().positive(),
  min_subtotal_paise: z.number().int().min(0).default(0),
  max_uses: z.number().int().positive().nullable().optional(),
  starts_at: isoDate,
  ends_at: isoDate,
  is_active: boolInt.default(1),
  max_discount_paise: z.number().int().positive().nullable().optional(),
  per_user_limit: z.number().int().min(1).default(1).optional(),
  single_use_per_customer: boolInt.default(0).optional(),
  rule_type: z.enum(["standard", "lead_incentive", "exclusive_sample"]).default("standard").optional(),
  idempotencyKey: idempotencyKeySchema,
}).refine((c) => (c.kind === "percent" ? c.value >= 1 && c.value <= 50 : c.value >= 1),
  { message: "Percent coupons allow 1–50; flat coupons need value ≥ 1 paise.", path: ["value"] });
export type CouponInput = z.infer<typeof couponSchema>;

export const dispatchSchema = z.object({
  to: z.enum(["unfulfilled", "preparing", "shipped", "delivered", "cancelled", "returned"]),
  idempotencyKey: z.string().uuid().optional(),
});
export type DispatchInput = z.infer<typeof dispatchSchema>;

// ---- Admin auth (§8 contracts) ----
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9-_]+$/, "Lowercase letters, numbers, hyphens and underscores only.");
export const passwordSchema = z.string().min(12).max(200);
export const roleSchema = z.enum(["root", "admin"]);

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(200),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z.object({
  username: usernameSchema,
  password: passwordSchema,
  role: roleSchema.default("admin"),
  email: z.string().trim().email().max(254).optional(),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z
  .object({
    password: passwordSchema.optional(),
    role: roleSchema.optional(),
    is_active: boolInt.optional(),
    email: z.string().trim().email().max(254).nullable().optional(),
  })
  .refine((u) => u.password !== undefined || u.role !== undefined || u.is_active !== undefined || u.email !== undefined, {
    message: "Nothing to update.",
  });
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const forgotSchema = z.object({
  email: z.string().trim().email().max(254),
});
export type ForgotInput = z.infer<typeof forgotSchema>;

export const resetSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: passwordSchema,
});
export type ResetInput = z.infer<typeof resetSchema>;

// ---- Dynamic Media & Placements ----
export const mediaUploadSchema = z.object({
  alt_text: z.string().trim().max(300).default(""),
  caption: z.string().trim().max(500).default(""),
  sort_order: z.number().int().min(0).default(0),
  idempotencyKey: idempotencyKeySchema,
});
export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;

export const mediaUpdateSchema = z
  .object({
    alt_text: z.string().trim().max(300).optional(),
    caption: z.string().trim().max(500).optional(),
    sort_order: z.number().int().min(0).optional(),
    idempotencyKey: idempotencyKeySchema,
  })
  .refine(
    (d) => d.alt_text !== undefined || d.caption !== undefined || d.sort_order !== undefined,
    { message: "At least one field (alt_text, caption, sort_order) must be provided." }
  );
export type MediaUpdateInput = z.infer<typeof mediaUpdateSchema>;

export const mediaQuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(100).optional(),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]).optional(),
});
export type MediaQueryInput = z.infer<typeof mediaQuerySchema>;

// ---- Inventory exact-quantity update (§3 contracts) ----
export const MAX_INVENTORY_QTY = 999999;

export const inventoryUpdateSchema = z.object({
  product: z.union([
    z.number().int().positive(),
    z.string().trim().min(1).max(120),
  ]).optional(),
  sku: z.string().trim().min(1).max(30).optional(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().min(0).max(MAX_INVENTORY_QTY),
  idempotencyKey: idempotencyKeySchema,
}).refine(
  (v) => v.product !== undefined || v.sku !== undefined || v.variantId !== undefined,
  { message: "Either product, sku, or variantId is required." }
);
export type InventoryUpdateInput = z.infer<typeof inventoryUpdateSchema>;

/**
 * Normalizes loose inventory payloads (API/MCP aliases) to the canonical
 * { product, sku, variantId, quantity } shape without fabricating values.
 * Aliases: product_id/product_slug/slug/id/idOrSlug → product;
 * variant_id → variantId; stock/inventory/qty/count → quantity.
 */
export function normalizeInventoryInput(raw: unknown): Record<string, unknown> {
  const data = typeof raw === "object" && raw !== null ? { ...(raw as Record<string, unknown>) } : {};
  const pick = (...keys: string[]): unknown => {
    for (const k of keys) {
      const v = data[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return v;
    }
    return undefined;
  };

  if (data.product === undefined || data.product === null || String(data.product).trim() === "") {
    const alias = pick("product_id", "product_slug", "slug", "idOrSlug", "id");
    if (alias !== undefined) {
      if (typeof alias === "number" && Number.isFinite(alias) && alias > 0) {
        data.product = Math.round(alias);
      } else if (typeof alias === "string" && alias.trim()) {
        const t = alias.trim();
        data.product = /^\d+$/.test(t) ? Number(t) : t;
      } else {
        data.product = alias;
      }
    }
  } else if (typeof data.product === "string" && /^\d+$/.test(data.product.trim())) {
    data.product = Number(data.product.trim());
  }
  if (typeof data.product === "number" && !Number.isFinite(data.product)) delete data.product;

  if (data.sku !== undefined && data.sku !== null) {
    const s = String(data.sku).trim().toUpperCase().replace(/\s+/g, "-");
    if (s) data.sku = s.slice(0, 30);
    else delete data.sku;
  }

  if (data.variantId === undefined || data.variantId === null) {
    const vAlias = pick("variant_id", "variantId");
    if (vAlias !== undefined) {
      const n = Number(vAlias);
      if (Number.isFinite(n) && n > 0) data.variantId = Math.round(n);
    }
  } else {
    const n = Number(data.variantId);
    if (Number.isFinite(n) && n > 0) data.variantId = Math.round(n);
    else delete data.variantId;
  }

  if (data.quantity === undefined || data.quantity === null || String(data.quantity).trim() === "") {
    const qAlias = pick("quantity", "stock", "inventory", "qty", "count");
    if (qAlias !== undefined) data.quantity = qAlias;
  }
  if (data.quantity !== undefined && data.quantity !== null && typeof data.quantity !== "number") {
    const n = Number(data.quantity);
    data.quantity = Number.isFinite(n) ? Math.round(n) : data.quantity;
  }

  return data;
}

export const sitePlacementSchema = z.object({
  section_key: z.enum(["home_hero", "home_story", "shop_hero", "gifts_hero"]),
  media_id: z.number().int().positive().nullable().optional(),
  image_url: z.string().trim().max(500).default(""),
  alt_text: z.string().trim().max(300).default(""),
  title: z.string().trim().max(120).default(""),
  subtitle: z.string().trim().max(300).default(""),
  cta_label: z.string().trim().max(60).default(""),
  cta_href: z.string().trim().max(500).default(""),
  idempotencyKey: idempotencyKeySchema,
});
export type SitePlacementInput = z.infer<typeof sitePlacementSchema>;

