import { parseTeaMoments, teaMomentsSchema } from "./teaMoments";
import { replaceProductImages } from "@/lib/productImages";
import { getDb } from "@/lib/db";
import { enabledProductCondition } from "@/lib/productAvailability";
import { idempotent } from "@/lib/adminStore";
import type { ProductInput, VariantInput } from "@/lib/validation";

export * from "@/lib/productModels";
import { parseAromaTags, getProductSpecs, type PackagingFormat, type Variant, type Product } from "@/lib/productModels";

type RawVariantRow = {
  id: number;
  product_id: number;
  sku: string;
  packaging_format?: string | null;
  grams: number;
  servings?: number | null;
  price_paise: number;
  compare_at_price_paise?: number | null;
  stock: number;
  product_name?: string | null;
  product_slug?: string | null;
  product_category?: string | null;
  product_estate?: string | null;
  product_image_url?: string | null;
};

type RawProductRow = {
  tea_moments?: string | null;
  id: number;
  slug: string;
  name: string;
  category: string;
  category_id?: number | null;
  origin: string;
  estate: string;
  flush: string;
  harvest_date: string;
  description: string;
  tasting_notes: string;
  floral?: number | null;
  fruity?: number | null;
  malty?: number | null;
  body?: number | null;
  sweetness?: number | null;
  earthy?: number | null;
  aroma_tags?: string | null;
  dry_leaf_appearance?: string | null;
  dry_leaf_grade?: string | null;
  dry_leaf_aroma?: string | null;
  liquor_hue_hex?: string | null;
  liquor_hue_name?: string | null;
  liquor_clarity?: string | null;
  liquor_body?: string | null;
  wet_leaf_aroma?: string | null;
  wet_leaf_oxidation?: string | null;
  brew_temp: number;
  brew_seconds: number;
  leaf_dose_grams?: number | null;
  water_ml?: number | null;
  steep_count?: number | null;
  steep_instructions?: string | null;
  elevation_feet?: number | null;
  elevation_display?: string | null;
  lot_number?: string | null;
  cultivar?: string | null;
  estate_story?: string | null;
  featured?: number | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_override?: string | null;
  noindex?: number | null;
  ingredients?: string | null;
  verified_origin?: string | null;
  status?: string | null;
  is_enabled?: number;
  pdf_url?: string | null;
  pdf_title?: string | null;
};

export function mapVariantRow(row: RawVariantRow): Variant {
  const format = (row.packaging_format as PackagingFormat) || "loose_leaf_pouch";
  const defaultServings = Math.max(1, Math.round(row.grams / 2));
  return {
    id: row.id,
    product_id: row.product_id,
    sku: row.sku,
    packaging_format: format,
    grams: row.grams,
    servings: row.servings != null ? row.servings : defaultServings,
    price_paise: row.price_paise,
    compare_at_price_paise: row.compare_at_price_paise != null ? row.compare_at_price_paise : null,
    stock: row.stock,
    ...(row.product_name ? { product_name: row.product_name } : {}),
    ...(row.product_slug ? { product_slug: row.product_slug } : {}),
    ...(row.product_category ? { product_category: row.product_category } : {}),
    ...(row.product_estate ? { product_estate: row.product_estate } : {}),
    ...(row.product_image_url ? { product_image_url: row.product_image_url } : {}),
  };
}

export function mapProductRow(
  row: RawProductRow,
  variants: Variant[],
  primaryImage?: { url: string; alt_text: string } | null
): Product {
  const minPaise = variants.length
    ? Math.min(...variants.map((v) => v.price_paise))
    : 19900;
  const priceInr = Math.round(minPaise / 100);

  const prod: Product = {
    tea_moments: parseTeaMoments(row.tea_moments),
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: row.category,
    category_id: row.category_id ?? null,
    origin: row.origin,
    estate: row.estate,
    flush: row.flush,
    harvest_date: row.harvest_date,
    description: row.description,
    tasting_notes: row.tasting_notes,
    floral: row.floral ?? 0,
    fruity: row.fruity ?? 0,
    malty: row.malty ?? 0,
    body: row.body ?? 0,
    sweetness: row.sweetness ?? 0,
    earthy: row.earthy ?? 0,
    aroma_tags: parseAromaTags(row.aroma_tags),
    dry_leaf_appearance: row.dry_leaf_appearance ?? "",
    dry_leaf_grade: row.dry_leaf_grade ?? "",
    dry_leaf_aroma: row.dry_leaf_aroma ?? "",
    liquor_hue_hex: row.liquor_hue_hex || "#b36b3d",
    liquor_hue_name: row.liquor_hue_name ?? "",
    liquor_clarity: row.liquor_clarity ?? "",
    liquor_body: row.liquor_body ?? "",
    wet_leaf_aroma: row.wet_leaf_aroma ?? "",
    wet_leaf_oxidation: row.wet_leaf_oxidation ?? "",
    brew_temp: row.brew_temp,
    brew_seconds: row.brew_seconds,
    leaf_dose_grams: row.leaf_dose_grams ?? 2.5,
    water_ml: row.water_ml ?? 200,
    steep_count: row.steep_count ?? 3,
    steep_instructions: row.steep_instructions ?? "",
    elevation_feet: row.elevation_feet ?? 0,
    elevation_display: row.elevation_display ?? "",
    lot_number: row.lot_number ?? "",
    cultivar: row.cultivar ?? "",
    estate_story: row.estate_story ?? "",
    featured: row.featured ?? 0,
    price: priceInr,
    price_paise: minPaise,
    seo_title: row.seo_title ?? null,
    seo_description: row.seo_description ?? null,
    canonical_override: row.canonical_override ?? null,
    noindex: row.noindex ?? 0,
    ingredients: row.ingredients ?? "",
    verified_origin: row.verified_origin ?? row.origin ?? "",
    status: (row.status as "draft" | "published" | "archived") || "published",
    is_draft: (row.status === "draft"),
    is_enabled: row.is_enabled ?? 1,
    inventory: variants.length ? variants.reduce((sum, v) => sum + (v.stock || 0), 0) : 0,
    pdf_url: row.pdf_url ?? null,
    pdf_title: row.pdf_title ?? null,
    primary_image: primaryImage ?? null,
    ...(primaryImage?.url ? { primary_image_url: primaryImage.url } : {}),
    variants,
  };
  prod.specs = getProductSpecs(prod);
  return prod;
}

function hydrate(rows: RawProductRow[]): Product[] {
  if (rows.length === 0) return [];
  const db = getDb();

  if (rows.length === 1) {
    const row = rows[0];
    const stmt = db.prepare(
      "SELECT * FROM variants WHERE product_id=? ORDER BY grams ASC, id ASC"
    );
    const variantRows = stmt.all(row.id) as RawVariantRow[];
    const variants = variantRows.map(mapVariantRow);

    let primaryImage: { url: string; alt_text: string } | null = null;
    try {
      const imgRow = db
        .prepare(
          "SELECT url, alt_text FROM product_images WHERE product_id=? ORDER BY is_primary DESC, sort_order ASC, id ASC LIMIT 1"
        )
        .get(row.id) as { url: string; alt_text?: string } | undefined;
      if (imgRow?.url) {
        primaryImage = {
          url: imgRow.url,
          alt_text: imgRow.alt_text || row.name || "",
        };
      }
    } catch {
      // product_images table may not exist in bootstrap
    }

    const prod = mapProductRow(row, variants, primaryImage);
    if (primaryImage?.url) {
      prod.primary_image_url = primaryImage.url;
    }
    return [prod];
  }

  // Batch query for variants
  const ids = rows.map((r) => r.id);
  const placeholders = ids.map(() => "?").join(",");
  const variantRows = db
    .prepare(
      `SELECT * FROM variants WHERE product_id IN (${placeholders}) ORDER BY grams ASC, id ASC`
    )
    .all(...ids) as RawVariantRow[];

  const variantsByProduct = new Map<number, Variant[]>();
  for (const v of variantRows) {
    const list = variantsByProduct.get(v.product_id) || [];
    list.push(mapVariantRow(v));
    variantsByProduct.set(v.product_id, list);
  }

  // Batch query for primary images
  const primaryImagesByProduct = new Map<number, { url: string; alt_text: string }>();
  try {
    const imgRows = db
      .prepare(
        `SELECT product_id, url, alt_text FROM product_images WHERE product_id IN (${placeholders}) ORDER BY is_primary DESC, sort_order ASC, id ASC`
      )
      .all(...ids) as { product_id: number; url: string; alt_text?: string }[];
    for (const img of imgRows) {
      if (!primaryImagesByProduct.has(img.product_id) && img.url) {
        primaryImagesByProduct.set(img.product_id, {
          url: img.url,
          alt_text: img.alt_text || "",
        });
      }
    }
  } catch {
    // product_images table may not exist in bootstrap
  }

  return rows.map((row) => {
    const variants = variantsByProduct.get(row.id) || [];
    const primaryImage = primaryImagesByProduct.get(row.id) || null;
    if (primaryImage && !primaryImage.alt_text) {
      primaryImage.alt_text = row.name || "";
    }
    const prod = mapProductRow(row, variants, primaryImage);
    if (primaryImage?.url) {
      prod.primary_image_url = primaryImage.url;
    }
    return prod;
  });
}

export function listProducts(options: {
  q?: string;
  category?: string;
  categoryId?: number;
  featured?: boolean;
  status?: string;
  includeDisabled?: boolean;
} = {}): Product[] {
  const clauses: string[] = [];
  const params: (string | number)[] = [];
  if (options.q) {
    clauses.push("(name LIKE ? OR origin LIKE ? OR tasting_notes LIKE ?)");
    const q = "%" + options.q.trim() + "%";
    params.push(q, q, q);
  }
  if (options.category) {
    clauses.push("category = ?");
    params.push(options.category);
  }
  if (options.categoryId) {
    clauses.push("category_id = ?");
    params.push(options.categoryId);
  }
  if (options.featured) clauses.push("featured = 1");
  const targetStatus = options.status ?? "published";
  if (targetStatus !== "all") {
    clauses.push("status = ?");
    params.push(targetStatus);
  }
  if (!options.includeDisabled) clauses.push(enabledProductCondition());
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const rows = getDb().prepare("SELECT * FROM products" + where + " ORDER BY featured DESC,id ASC").all(...params) as RawProductRow[];
  return hydrate(rows);
}

export function getProductBySlug(slug: string): Product | null {
  const row = getDb().prepare("SELECT * FROM products WHERE slug=?").get(slug) as RawProductRow | undefined;
  return row ? hydrate([row])[0] : null;
}

export function getProduct(id: number): Product | null {
  const row = getDb().prepare("SELECT * FROM products WHERE id=?").get(id) as RawProductRow | undefined;
  return row ? hydrate([row])[0] : null;
}

// Canonical admin/MCP upserts (single SQL owner). Idempotency-key replays return the original.
export function upsertProduct(input: ProductInput): {
  id: number;
  slug: string;
  price?: number;
  price_paise?: number;
  deduped: boolean;
} {
  const { body, deduped } = idempotent("product", input.idempotencyKey, () => getDb().transaction(() => {
    const db = getDb();
    const cols = (db.prepare("PRAGMA table_info(products)").all() as { name: string }[]).map((c) => c.name);
    const hasCategoryId = cols.includes("category_id");
    const hasCupping = cols.includes("sweetness");
    const hasSeo = cols.includes("seo_title");
    const hasIngredients = cols.includes("ingredients");
    const hasVerifiedOrigin = cols.includes("verified_origin");
    const hasStatus = cols.includes("status");
    const hasPdf = cols.includes("pdf_url");

    let resolvedCategoryId = input.category_id ?? null;
    let legacyCategory = input.category ?? "";
    if (resolvedCategoryId != null) {
      const cat = db.prepare("SELECT id, name FROM categories WHERE id=?").get(resolvedCategoryId) as { id: number; name: string } | undefined;
      if (!cat) throw new Error("Category not found.");
      if (!legacyCategory) legacyCategory = cat.name;
    } else if (legacyCategory) {
      const cat = db.prepare("SELECT id, name FROM categories WHERE name = ? OR slug = ?").get(legacyCategory, legacyCategory.toLowerCase().replace(/[^a-z0-9]+/g, "-")) as { id: number; name: string } | undefined;
      if (cat) {
        resolvedCategoryId = cat.id;
        legacyCategory = cat.name;
      }
    }

    const targetId = input.id ? Number(input.id) : undefined;
    const slug = (input.slug || (input.name ? input.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") : "")).slice(0, 80);
    const existing = (targetId ? (db.prepare("SELECT id, slug FROM products WHERE id=?").get(targetId) as { id: number; slug: string } | undefined) : null) ||
      (slug ? (db.prepare("SELECT id, slug FROM products WHERE slug=?").get(slug) as { id: number; slug: string } | undefined) : undefined);
    const finalSlug = slug || existing?.slug || "tea";

    const aromaSerialized = Array.isArray(input.aroma_tags)
      ? JSON.stringify(input.aroma_tags)
      : typeof input.aroma_tags === "string" ? input.aroma_tags : "[]";

    const ingredientsVal = typeof input.ingredients === "string"
      ? input.ingredients.trim()
      : Array.isArray(input.ingredients)
      ? (input.ingredients as string[]).join(", ")
      : "";
    const verifiedOriginVal = input.verified_origin?.trim() || input.origin?.trim() || "";
    const statusVal = input.status || (input.is_draft || input.draft ? "draft" : "published");

    let targetPaise: number | undefined;
    if (typeof input.price_paise === "number" && input.price_paise >= 0) {
      targetPaise = Math.round(input.price_paise);
    } else if (typeof input.price_inr === "number" && input.price_inr >= 0) {
      targetPaise = Math.round(input.price_inr * 100);
    } else if (input.price !== undefined && input.price !== null) {
      const num = typeof input.price === "string" ? parseFloat(input.price) : Number(input.price);
      if (!Number.isNaN(num) && num >= 0) {
        targetPaise = num > 10000 ? Math.round(num) : Math.round(num * 100);
      }
    }

    const targetStock = input.stock !== undefined ? input.stock : (input.inventory !== undefined ? input.inventory : undefined);

    let productId: number;

    if (existing) {
      productId = existing.id;
      if (hasCupping) {
        db.prepare(`
          UPDATE products SET
            slug=?, name=?, category=?, origin=?, estate=?, flush=?, harvest_date=?,
            description=?, tasting_notes=?, floral=?, fruity=?, malty=?, body=?,
            brew_temp=?, brew_seconds=?, featured=?,
            sweetness=?, earthy=?, aroma_tags=?,
            dry_leaf_appearance=?, dry_leaf_grade=?, dry_leaf_aroma=?,
            liquor_hue_hex=?, liquor_hue_name=?, liquor_clarity=?, liquor_body=?,
            wet_leaf_aroma=?, wet_leaf_oxidation=?,
            leaf_dose_grams=?, water_ml=?, steep_count=?, steep_instructions=?,
            elevation_feet=?, elevation_display=?, lot_number=?, cultivar=?, estate_story=?
            ${hasCategoryId ? ", category_id=?" : ""}
            ${hasSeo ? ", seo_title=?, seo_description=?, canonical_override=?, noindex=?" : ""}
            ${hasIngredients ? ", ingredients=?" : ""}
            ${hasVerifiedOrigin ? ", verified_origin=?" : ""}
            ${hasStatus ? ", status=?" : ""}
          WHERE id=?
        `).run(
          finalSlug, input.name, legacyCategory, input.origin ?? "", input.estate ?? "", input.flush ?? "", input.harvest_date ?? "",
          input.description ?? "", input.tasting_notes ?? "", input.floral ?? 0, input.fruity ?? 0, input.malty ?? 0, input.body ?? 0,
          input.brew_temp ?? 90, input.brew_seconds ?? 180, input.featured ?? 0,
          input.sweetness ?? 0, input.earthy ?? 0, aromaSerialized,
          input.dry_leaf_appearance ?? "", input.dry_leaf_grade ?? "", input.dry_leaf_aroma ?? "",
          input.liquor_hue_hex ?? "#b36b3d", input.liquor_hue_name ?? "", input.liquor_clarity ?? "", input.liquor_body ?? "",
          input.wet_leaf_aroma ?? "", input.wet_leaf_oxidation ?? "",
          input.leaf_dose_grams ?? 2.5, input.water_ml ?? 200, input.steep_count ?? 3, input.steep_instructions ?? "",
          input.elevation_feet ?? 0, input.elevation_display ?? "", input.lot_number ?? "", input.cultivar ?? "", input.estate_story ?? "",
          ...(hasCategoryId ? [resolvedCategoryId] : []),
          ...(hasSeo ? [input.seo_title ?? null, input.seo_description ?? null, input.canonical_override ?? null, input.noindex ? 1 : 0] : []),
          ...(hasIngredients ? [ingredientsVal] : []),
          ...(hasVerifiedOrigin ? [verifiedOriginVal] : []),
          ...(hasStatus ? [statusVal] : []),
          existing.id
        );
      } else {
        db.prepare([
          "UPDATE products SET slug=?, name=?, category=?, origin=?, estate=?, flush=?, harvest_date=?,",
          "description=?, tasting_notes=?, floral=?, fruity=?, malty=?, body=?, brew_temp=?, brew_seconds=?, featured=?",
          hasCategoryId ? ", category_id=?" : "",
          hasSeo ? ", seo_title=?, seo_description=?, canonical_override=?, noindex=?" : "",
          hasIngredients ? ", ingredients=?" : "",
          hasVerifiedOrigin ? ", verified_origin=?" : "",
          hasStatus ? ", status=?" : "",
          " WHERE id=?",
        ].join("")).run(
          finalSlug, input.name, legacyCategory, input.origin ?? "", input.estate ?? "", input.flush ?? "", input.harvest_date ?? "",
          input.description ?? "", input.tasting_notes ?? "", input.floral ?? 0, input.fruity ?? 0, input.malty ?? 0, input.body ?? 0,
          input.brew_temp ?? 90, input.brew_seconds ?? 180, input.featured ?? 0,
          ...(hasCategoryId ? [resolvedCategoryId] : []),
          ...(hasSeo ? [input.seo_title ?? null, input.seo_description ?? null, input.canonical_override ?? null, input.noindex ? 1 : 0] : []),
          ...(hasIngredients ? [ingredientsVal] : []),
          ...(hasVerifiedOrigin ? [verifiedOriginVal] : []),
          ...(hasStatus ? [statusVal] : []),
          existing.id
        );
      }
    } else {
      if (hasCupping) {
        const info = db.prepare(`
          INSERT INTO products (
            slug, name, category, origin, estate, flush, harvest_date,
            description, tasting_notes, floral, fruity, malty, body,
            brew_temp, brew_seconds, featured,
            sweetness, earthy, aroma_tags,
            dry_leaf_appearance, dry_leaf_grade, dry_leaf_aroma,
            liquor_hue_hex, liquor_hue_name, liquor_clarity, liquor_body,
            wet_leaf_aroma, wet_leaf_oxidation,
            leaf_dose_grams, water_ml, steep_count, steep_instructions,
            elevation_feet, elevation_display, lot_number, cultivar, estate_story
            ${hasCategoryId ? ", category_id" : ""}
            ${hasSeo ? ", seo_title, seo_description, canonical_override, noindex" : ""}
            ${hasIngredients ? ", ingredients" : ""}
            ${hasVerifiedOrigin ? ", verified_origin" : ""}
            ${hasStatus ? ", status" : ""}
          ) VALUES (
            ?, ?, ?, ?, ?, ?, ?,
            ?, ?, ?, ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?,
            ?, ?, ?, ?,
            ?, ?,
            ?, ?, ?, ?,
            ?, ?, ?, ?, ?
            ${hasCategoryId ? ", ?" : ""}
            ${hasSeo ? ", ?, ?, ?, ?" : ""}
            ${hasIngredients ? ", ?" : ""}
            ${hasVerifiedOrigin ? ", ?" : ""}
            ${hasStatus ? ", ?" : ""}
          )
        `).run(
          finalSlug, input.name, legacyCategory, input.origin ?? "", input.estate ?? "", input.flush ?? "", input.harvest_date ?? "",
          input.description ?? "", input.tasting_notes ?? "", input.floral ?? 0, input.fruity ?? 0, input.malty ?? 0, input.body ?? 0,
          input.brew_temp ?? 90, input.brew_seconds ?? 180, input.featured ?? 0,
          input.sweetness ?? 0, input.earthy ?? 0, aromaSerialized,
          input.dry_leaf_appearance ?? "", input.dry_leaf_grade ?? "", input.dry_leaf_aroma ?? "",
          input.liquor_hue_hex ?? "#b36b3d", input.liquor_hue_name ?? "", input.liquor_clarity ?? "", input.liquor_body ?? "",
          input.wet_leaf_aroma ?? "", input.wet_leaf_oxidation ?? "",
          input.leaf_dose_grams ?? 2.5, input.water_ml ?? 200, input.steep_count ?? 3, input.steep_instructions ?? "",
          input.elevation_feet ?? 0, input.elevation_display ?? "", input.lot_number ?? "", input.cultivar ?? "", input.estate_story ?? "",
          ...(hasCategoryId ? [resolvedCategoryId] : []),
          ...(hasSeo ? [input.seo_title ?? null, input.seo_description ?? null, input.canonical_override ?? null, input.noindex ? 1 : 0] : []),
          ...(hasIngredients ? [ingredientsVal] : []),
          ...(hasVerifiedOrigin ? [verifiedOriginVal] : []),
          ...(hasStatus ? [statusVal] : [])
        );
        productId = Number(info.lastInsertRowid);
        if (!productId || isNaN(productId)) {
          const row = db.prepare("SELECT id FROM products WHERE slug = ?").get(finalSlug) as { id: number } | undefined;
          if (row) productId = row.id;
        }
      } else {
        const info = db.prepare(
          "INSERT INTO products (slug,name,category,origin,estate,flush,harvest_date,description,tasting_notes,floral,fruity,malty,body,brew_temp,brew_seconds,featured" +
          (hasCategoryId ? ",category_id" : "") +
          (hasIngredients ? ",ingredients" : "") +
          (hasVerifiedOrigin ? ",verified_origin" : "") +
          (hasStatus ? ",status" : "") +
          ") VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?" +
          (hasCategoryId ? ",?" : "") +
          (hasIngredients ? ",?" : "") +
          (hasVerifiedOrigin ? ",?" : "") +
          (hasStatus ? ",?" : "") +
          ")"
        ).run(
          finalSlug, input.name, legacyCategory, input.origin ?? "", input.estate ?? "", input.flush ?? "", input.harvest_date ?? "",
          input.description ?? "", input.tasting_notes ?? "", input.floral ?? 0, input.fruity ?? 0, input.malty ?? 0, input.body ?? 0,
          input.brew_temp ?? 90, input.brew_seconds ?? 180, input.featured ?? 0,
          ...(hasCategoryId ? [resolvedCategoryId] : []),
          ...(hasIngredients ? [ingredientsVal] : []),
          ...(hasVerifiedOrigin ? [verifiedOriginVal] : []),
          ...(hasStatus ? [statusVal] : [])
        );
        productId = Number(info.lastInsertRowid);
        if (!productId || isNaN(productId)) {
          const row = db.prepare("SELECT id FROM products WHERE slug = ?").get(finalSlug) as { id: number } | undefined;
          if (row) productId = row.id;
        }
      }
    }

    if (input.tea_moments !== undefined) {
      const moments = input.tea_moments === null ? null : teaMomentsSchema.parse(input.tea_moments);
      db.prepare("UPDATE products SET tea_moments=? WHERE id=?").run(moments === null ? null : JSON.stringify(moments), productId);
    }

    if (hasPdf && (input.pdf_url !== undefined || input.pdf_title !== undefined)) {
      const cur = db.prepare("SELECT pdf_url, pdf_title FROM products WHERE id=?").get(productId) as { pdf_url?: string | null; pdf_title?: string | null } | undefined;
      const finalPdfUrl = input.pdf_url !== undefined ? (input.pdf_url ? input.pdf_url.trim() : null) : (cur?.pdf_url ?? null);
      const finalPdfTitle = input.pdf_title !== undefined ? (input.pdf_title ? input.pdf_title.trim() : null) : (cur?.pdf_title ?? null);
      db.prepare("UPDATE products SET pdf_url=?, pdf_title=? WHERE id=?").run(finalPdfUrl, finalPdfTitle, productId);
    }

    // Handle price / variants on existing or new product
    let activePaise = targetPaise;
    const existingVars = db.prepare("SELECT id, price_paise, stock FROM variants WHERE product_id=? ORDER BY grams ASC, id ASC").all(productId) as { id: number; price_paise: number; stock: number }[];

    if (targetPaise !== undefined || targetStock !== undefined) {
      if (existingVars.length > 0) {
        if (targetPaise !== undefined && targetStock !== undefined) {
          db.prepare("UPDATE variants SET price_paise=?, stock=? WHERE id=?").run(targetPaise, targetStock, existingVars[0].id);
        } else if (targetPaise !== undefined) {
          db.prepare("UPDATE variants SET price_paise=? WHERE id=?").run(targetPaise, existingVars[0].id);
          db.prepare("UPDATE variants SET price_paise=? WHERE product_id=? AND price_paise=74900").run(targetPaise, productId);
        } else if (targetStock !== undefined) {
          db.prepare("UPDATE variants SET stock=? WHERE id=?").run(targetStock, existingVars[0].id);
        }
        activePaise = targetPaise !== undefined ? targetPaise : existingVars[0].price_paise;
      } else if (input.variants && Array.isArray(input.variants) && input.variants.length > 0) {
        // Explicit variants follow below: do NOT mint a stray default SKU.
        // activePaise resolves from the first embedded variant during upsert.
      } else {
        const sku = `${finalSlug.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 16) || "TEA"}-100G`;
        db.prepare("INSERT INTO variants (product_id, sku, grams, price_paise, stock, packaging_format, servings) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(productId, sku, 100, targetPaise ?? 19900, targetStock ?? 50, "loose_leaf_pouch", 50);
        activePaise = targetPaise ?? 19900;
      }
    } else if (existingVars.length > 0) {
      activePaise = existingVars[0].price_paise;
    }

    // If explicit variants array was provided, upsert each
    if (input.variants && Array.isArray(input.variants) && input.variants.length > 0) {
      for (const v of input.variants) {
        if (v && typeof v === "object") {
          const varObj = v as Record<string, unknown>;
          const sku = String(varObj.sku || "").trim();
          if (sku) {
            const grams = Number(varObj.grams) || 100;
            const pPaise = varObj.price_paise !== undefined
              ? Number(varObj.price_paise)
              : (varObj.price !== undefined ? Math.round(Number(varObj.price) * 100) : (targetPaise ?? 19900));
            const vStock = varObj.stock !== undefined
              ? Number(varObj.stock)
              : (varObj.inventory !== undefined ? Number(varObj.inventory) : (targetStock ?? 50));
            const pkg = (varObj.packaging_format as PackagingFormat) || "loose_leaf_pouch";
            const srv = Number(varObj.servings) || Math.max(1, Math.round(grams / 2));
            // Resolve the Original MRP (discount strike-through): an explicit
            // null/"" clears it, an omitted key preserves the stored value so
            // partial variant updates never wipe discounts by accident.
            const mrpKeys = ["compare_at_price_paise", "mrp_paise", "mrp_inr", "mrp", "compare_at_price"];
            const mrpKey = mrpKeys.find((k) => varObj[k] !== undefined);
            let mrpPaise: number | null;
            if (mrpKey !== undefined) {
              const rawMrp = varObj[mrpKey];
              if (rawMrp === null || (typeof rawMrp === "string" && rawMrp.trim() === "")) {
                mrpPaise = null;
              } else {
                const n = Number(rawMrp);
                const paise = mrpKey === "compare_at_price_paise" || mrpKey === "mrp_paise" ? Math.round(n) : Math.round(n * 100);
                if (isNaN(n) || paise < 0 || paise > 10000000) {
                  throw new Error(`Enter a valid Original MRP for SKU ${sku}: a non-negative amount (paise integer for *_paise, Rupees for mrp/mrp_inr), empty to clear, or omit to keep the stored MRP.`);
                }
                mrpPaise = paise;
              }
              if (mrpPaise !== null && mrpPaise < pPaise) {
                throw new Error(`Original MRP for SKU ${sku} is below its price. MRP must be empty or at least the selling price.`);
              }
            } else {
              const stored = db.prepare("SELECT compare_at_price_paise FROM variants WHERE sku = ?").get(sku) as { compare_at_price_paise: number | null } | undefined;
              mrpPaise = stored?.compare_at_price_paise ?? null;
            }
            upsertVariant({
              product_id: productId,
              sku,
              grams,
              price_paise: pPaise,
              compare_at_price_paise: mrpPaise,
              stock: vStock,
              packaging_format: pkg,
              servings: srv,
            });
            if (activePaise === undefined) activePaise = pPaise;
          }
        }
      }
    }

    if (input.images !== undefined) replaceProductImages(productId, input.images);

    const retPaise = activePaise !== undefined ? activePaise : 19900;
    return { id: productId, slug: finalSlug, price: Math.round(retPaise / 100), price_paise: retPaise };
  })());
  return { ...body, deduped };
}

export function upsertVariant(input: VariantInput): { id: number; sku: string; deduped: boolean } {
  const { body, deduped } = idempotent("variant", input.idempotencyKey, () => {
    const db = getDb();
    const prod = db.prepare("SELECT id FROM products WHERE id=?").get(input.product_id) as { id: number } | undefined;
    if (!prod) throw new Error("Product not found.");
    const cols = (db.prepare("PRAGMA table_info(variants)").all() as { name: string }[]).map((c) => c.name);
    const hasPackaging = cols.includes("packaging_format");
    const hasComparePrice = cols.includes("compare_at_price_paise");

    const existing = db.prepare("SELECT id, product_id FROM variants WHERE sku=?").get(input.sku) as { id: number; product_id: number } | undefined;
    if (existing) {
      if (hasPackaging && hasComparePrice) {
        db.prepare("UPDATE variants SET product_id=?, grams=?, price_paise=?, compare_at_price_paise=?, stock=?, packaging_format=?, servings=? WHERE id=?")
          .run(input.product_id, input.grams, input.price_paise, input.compare_at_price_paise ?? null, input.stock, input.packaging_format ?? "loose_leaf_pouch", input.servings ?? 50, existing.id);
      } else if (hasPackaging) {
        db.prepare("UPDATE variants SET product_id=?, grams=?, price_paise=?, stock=?, packaging_format=?, servings=? WHERE id=?")
          .run(input.product_id, input.grams, input.price_paise, input.stock, input.packaging_format ?? "loose_leaf_pouch", input.servings ?? 50, existing.id);
      } else {
        db.prepare("UPDATE variants SET product_id=?, grams=?, price_paise=?, stock=? WHERE id=?")
          .run(input.product_id, input.grams, input.price_paise, input.stock, existing.id);
      }
      return { id: existing.id, sku: input.sku, price_paise: input.price_paise, stock: input.stock };
    }

    if (hasPackaging && hasComparePrice) {
      const info = db.prepare("INSERT INTO variants (product_id, sku, grams, price_paise, compare_at_price_paise, stock, packaging_format, servings) VALUES (?,?,?,?,?,?,?,?)")
        .run(input.product_id, input.sku, input.grams, input.price_paise, input.compare_at_price_paise ?? null, input.stock, input.packaging_format ?? "loose_leaf_pouch", input.servings ?? 50);
      return { id: Number(info.lastInsertRowid), sku: input.sku, price_paise: input.price_paise, stock: input.stock };
    }

    if (hasPackaging) {
      const info = db.prepare("INSERT INTO variants (product_id, sku, grams, price_paise, stock, packaging_format, servings) VALUES (?,?,?,?,?,?,?)")
        .run(input.product_id, input.sku, input.grams, input.price_paise, input.stock, input.packaging_format ?? "loose_leaf_pouch", input.servings ?? 50);
      return { id: Number(info.lastInsertRowid), sku: input.sku, price_paise: input.price_paise, stock: input.stock };
    }

    const info = db.prepare("INSERT INTO variants (product_id, sku, grams, price_paise, stock) VALUES (?,?,?,?,?)")
      .run(input.product_id, input.sku, input.grams, input.price_paise, input.stock);
    return { id: Number(info.lastInsertRowid), sku: input.sku, price_paise: input.price_paise, stock: input.stock };
  });
  return { ...body, deduped };
}

export function archiveProduct(idOrSlug: number | string): boolean {
  const db = getDb();
  let prodId: number | undefined;
  if (typeof idOrSlug === "number") {
    prodId = idOrSlug;
  } else {
    const num = Number(idOrSlug);
    if (!Number.isNaN(num) && String(num) === String(idOrSlug).trim()) {
      prodId = num;
    } else {
      const p = getProductBySlug(String(idOrSlug).trim());
      if (p) prodId = p.id;
    }
  }
  if (!prodId) return false;

  return db.transaction(() => {
    db.prepare("UPDATE variants SET stock = 0 WHERE product_id = ?").run(prodId);
    const cols = (db.prepare("PRAGMA table_info(products)").all() as { name: string }[]).map((c) => c.name);
    if (cols.includes("status")) {
      db.prepare("UPDATE products SET status = 'archived' WHERE id = ?").run(prodId);
    }
    return true;
  })();
}

export function deleteProduct(id: number, options?: { archiveIfReferenced?: boolean }): boolean {
  const db = getDb();
  let orderCount = 0;
  try {
    const orderItemsCheck = db.prepare(`
      SELECT COUNT(*) AS count
      FROM order_items oi
      JOIN variants v ON oi.variant_id = v.id
      WHERE v.product_id = ?
    `).get(id) as { count: number } | undefined;
    orderCount = orderItemsCheck?.count ?? 0;
  } catch {
    orderCount = 0;
  }

  if (orderCount > 0) {
    if (options?.archiveIfReferenced === false) {
      throw new Error(
        `Product cannot be deleted because it is referenced by ${orderCount} active or historical order item(s). Deletion is blocked to preserve order records.`
      );
    }
    return archiveProduct(id);
  }

  return db.transaction(() => {
    db.prepare("DELETE FROM variants WHERE product_id=?").run(id);
    db.prepare("DELETE FROM product_images WHERE product_id=?").run(id);
    return db.prepare("DELETE FROM products WHERE id=?").run(id).changes > 0;
  })();
}

export function deleteProductBySlug(slug: string, options?: { archiveIfReferenced?: boolean }): boolean {
  const prod = getProductBySlug(slug);
  if (!prod) return false;
  return deleteProduct(prod.id, options);
}

export function deleteVariant(id: number): boolean {
  return getDb().prepare("DELETE FROM variants WHERE id=?").run(id).changes > 0;
}

export function deleteVariantBySku(sku: string): boolean {
  const row = getDb().prepare("SELECT id FROM variants WHERE sku = ?").get(sku) as { id: number } | undefined;
  if (!row) return false;
  return deleteVariant(row.id);
}

export function listAllVariants(productId?: number): Variant[] {
  const db = getDb();
  const query = productId != null
    ? "SELECT * FROM variants WHERE product_id = ? ORDER BY grams ASC, id ASC"
    : "SELECT * FROM variants ORDER BY product_id ASC, grams ASC, id ASC LIMIT 500";
  const rows = (productId != null ? db.prepare(query).all(productId) : db.prepare(query).all()) as RawVariantRow[];
  return rows.map(mapVariantRow);
}

export function getVariant(id: number): Variant | null {
  const row = getDb().prepare(`
    SELECT v.*, p.name AS product_name, p.slug AS product_slug, p.category AS product_category, p.estate AS product_estate,
      (SELECT url FROM product_images WHERE product_id = v.product_id AND is_primary = 1 LIMIT 1) AS product_image_url
    FROM variants v
    LEFT JOIN products p ON v.product_id = p.id
    WHERE v.id=?
  `).get(id) as RawVariantRow | undefined;
  return row ? mapVariantRow(row) : null;
}

export function updateVariant(id: number, patch: Partial<VariantInput>): Variant | null {
  const db = getDb();
  if (!getVariant(id)) return null;
  const cols = (db.prepare("PRAGMA table_info(variants)").all() as { name: string }[]).map((c) => c.name);
  const hasPackaging = cols.includes("packaging_format");
  const hasComparePrice = cols.includes("compare_at_price_paise");
  if (hasPackaging && hasComparePrice) {
    db.prepare(`
      UPDATE variants SET
        product_id = COALESCE(?, product_id),
        sku = COALESCE(?, sku),
        grams = COALESCE(?, grams),
        price_paise = COALESCE(?, price_paise),
        compare_at_price_paise = CASE WHEN ? THEN ? ELSE compare_at_price_paise END,
        stock = COALESCE(?, stock),
        packaging_format = COALESCE(?, packaging_format),
        servings = COALESCE(?, servings)
      WHERE id = ?
    `).run(
      patch.product_id ?? null,
      patch.sku ?? null,
      patch.grams ?? null,
      patch.price_paise ?? null,
      patch.compare_at_price_paise !== undefined ? 1 : 0,
      patch.compare_at_price_paise ?? null,
      patch.stock ?? null,
      patch.packaging_format ?? null,
      patch.servings ?? null,
      id
    );
  } else if (hasPackaging) {
    db.prepare(`
      UPDATE variants SET
        product_id = COALESCE(?, product_id),
        sku = COALESCE(?, sku),
        grams = COALESCE(?, grams),
        price_paise = COALESCE(?, price_paise),
        stock = COALESCE(?, stock),
        packaging_format = COALESCE(?, packaging_format),
        servings = COALESCE(?, servings)
      WHERE id = ?
    `).run(
      patch.product_id ?? null,
      patch.sku ?? null,
      patch.grams ?? null,
      patch.price_paise ?? null,
      patch.stock ?? null,
      patch.packaging_format ?? null,
      patch.servings ?? null,
      id
    );
  } else {
    db.prepare("UPDATE variants SET product_id=COALESCE(?,product_id), sku=COALESCE(?,sku), grams=COALESCE(?,grams), price_paise=COALESCE(?,price_paise), stock=COALESCE(?,stock) WHERE id=?")
      .run(patch.product_id ?? null, patch.sku ?? null, patch.grams ?? null, patch.price_paise ?? null, patch.stock ?? null, id);
  }
  return getVariant(id);
}

export function listVariants(productId?: number): Variant[] {
  const db = getDb();
  const query = productId !== undefined
    ? `SELECT v.*, p.name AS product_name, p.slug AS product_slug, p.category AS product_category, p.estate AS product_estate,
         (SELECT url FROM product_images WHERE product_id = v.product_id AND is_primary = 1 LIMIT 1) AS product_image_url
       FROM variants v
       LEFT JOIN products p ON v.product_id = p.id
       WHERE v.product_id = ?
       ORDER BY v.grams ASC, v.id ASC`
    : `SELECT v.*, p.name AS product_name, p.slug AS product_slug, p.category AS product_category, p.estate AS product_estate,
         (SELECT url FROM product_images WHERE product_id = v.product_id AND is_primary = 1 LIMIT 1) AS product_image_url
       FROM variants v
       LEFT JOIN products p ON v.product_id = p.id
       ORDER BY v.product_id ASC, v.grams ASC, v.id ASC
       LIMIT 500`;
  const rows = (productId !== undefined ? db.prepare(query).all(productId) : db.prepare(query).all()) as RawVariantRow[];
  return rows.map(mapVariantRow);
}

