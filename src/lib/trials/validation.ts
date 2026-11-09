/**
 * TeaFloww Trials v3 — Validation, Invariant Enforcement & Security Projections
 *
 * Implements:
 * 1. Zod schemas for all mutation payloads and query options
 * 2. 4x50g kit component invariant engine
 * 3. Publication blocker gate validator
 * 4. Whitelist-based public projection (toPublicDto) redacting COGS and internal metadata
 */

import { z } from "zod";
import type {
  TrialWithDetails,
  TrialPublicDto,
  ComponentInput,
  PublicationValidationResult,
  TrialComponent,
  TrialAsset,
} from "./types";
import { TrialNotFoundError } from "./types";

// ============================================================================
// 1. Reusable Primitives & Zod Schemas
// ============================================================================

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters")
  .max(120, "Slug cannot exceed 120 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with single hyphens");

export const expectedRevisionSchema = z.coerce
  .number()
  .int("expected_revision must be an integer")
  .min(1, "expected_revision must be >= 1");

export const pricePaiseSchema = z.coerce
  .number()
  .int("Price must be an integer (paise)")
  .min(0, "Price cannot be negative");

export const assetStageSchema = z.enum([
  "packaging",
  "dry_leaf",
  "infused_leaf",
  "liquor",
  "milk_tea",
  "hero",
  "gallery",
]);

export const trialStatusSchema = z.enum(["draft", "in_review", "published", "archived"]);

export const componentInputSchema = z.object({
  id: z.string().optional(),
  slot_index: z.coerce.number().int().min(0).max(3),
  name: z.string().trim().min(2, "Component name required (min 2 chars)").max(120),
  estate: z.string().trim().default(""),
  grade: z.string().trim().default(""),
  flush: z.string().trim().default(""),
  elevation: z.string().trim().nullable().optional(),
  weight_g: z.coerce
    .number()
    .int()
    .min(50, "Sachet weight must be exactly 50g")
    .max(50, "Sachet weight must be exactly 50g")
    .default(50),
  quantity: z.coerce.number().int().min(1).max(1).default(1),
  tasting_notes: z
    .union([
      z.array(z.string().trim().min(1).max(100)),
      z.string().trim().transform((s) => {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) return parsed.map(String);
        } catch {}
        return s.split(",").map((v) => v.trim()).filter(Boolean);
      }),
    ])
    .default([]),
  brew_temp_c: z.coerce.number().int().min(50).max(100).default(95),
  brew_time_sec: z.coerce.number().int().min(30).max(600).default(240),
  leaf_dose_g: z.coerce.number().min(0.5).max(20).default(2.5),
  regular_product_id: z.union([z.string().trim(), z.number()]).nullable().optional(),
  regular_variant_id: z.union([z.string().trim(), z.number()]).nullable().optional(),
  sort_order: z.coerce.number().int().default(0),
});

export const replaceComponentsSchema = z
  .object({
    expected_revision: expectedRevisionSchema,
    components: z.array(componentInputSchema),
  })
  .superRefine((data, ctx) => {
    const inv = validateComponentInvariant(data.components);
    if (!inv.valid) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: inv.errors.join("; "),
        path: ["components"],
      });
    }
  });

export const createTrialSchema = z.object({
  idempotencyKey: z.string().trim().min(8).max(128).optional(),
  slug: slugSchema.optional(),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(180),
  tagline: z.string().trim().max(250).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  price_paise: z.coerce.number().int().min(0, "Price cannot be negative").default(20000), // Default ₹200.00
  compare_at_price_paise: pricePaiseSchema.nullable().optional(),
  cost_paise: pricePaiseSchema.nullable().optional(),
  sku: z.string().trim().max(60).optional(),
  inventory_quantity: z.coerce.number().int().min(0).default(0),
  inventory_policy: z.enum(["track", "continue"]).default("track"),
  hero_image_id: z.coerce.number().int().positive().nullable().optional(),
  meta_title: z.string().trim().max(200).nullable().optional(),
  meta_description: z.string().trim().max(500).nullable().optional(),
  components: z.array(componentInputSchema).optional(),
});

export const updateTrialSchema = z.object({
  expected_revision: z.coerce.number().int().optional(),
  title: z.string().trim().min(3).max(180).optional(),
  slug: slugSchema.optional(),
  tagline: z.string().trim().max(250).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  price_paise: pricePaiseSchema.optional(),
  compare_at_price_paise: pricePaiseSchema.nullable().optional(),
  cost_paise: pricePaiseSchema.nullable().optional(),
  sku: z.string().trim().max(60).optional(),
  inventory_quantity: z.coerce.number().int().min(0).optional(),
  inventory_policy: z.enum(["track", "continue"]).optional(),
  hero_image_id: z.coerce.number().int().positive().nullable().optional(),
  meta_title: z.string().trim().max(200).nullable().optional(),
  meta_description: z.string().trim().max(500).nullable().optional(),
});

export const attachAssetSchema = z
  .object({
    expected_revision: expectedRevisionSchema,
    component_id: z.string().nullable().optional(),
    slot_index: z.coerce.number().int().min(0).max(3).nullable().optional(),
    media_id: z.coerce.number().int().positive().nullable().optional(),
    asset_url: z.string().trim().max(500).optional(),
    url: z.string().trim().max(500).optional(),
    stage: assetStageSchema,
    alt_text: z.string().trim().min(2, "Descriptive alt text is required").max(250),
    caption: z.string().trim().max(250).nullable().optional(),
    rights_status: z.enum(["pending", "approved", "rejected"]).default("approved"),
    sort_order: z.coerce.number().int().default(0),
  })
  .transform((data) => ({
    ...data,
    asset_url: (data.asset_url || data.url || "").trim(),
  }))
  .refine((data) => data.asset_url.length >= 1, {
    message: "Asset URL is required",
    path: ["asset_url"],
  });

export const trialQuerySchema = z.object({
  status: z.enum(["draft", "in_review", "published", "archived", "all"]).default("all"),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  page: z.coerce.number().int().min(1).optional(),
  sort_by: z.enum(["created_at", "updated_at", "title", "price_paise"]).default("updated_at"),
  sort_dir: z.enum(["asc", "desc"]).default("desc"),
});

export const trialPublicQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  offset: z.coerce.number().int().min(0).default(0),
  page: z.coerce.number().int().min(1).optional(),
  sort_by: z.enum(["published_at", "title", "price_paise"]).default("published_at"),
  sort_dir: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================================================
// 2. 4x50g Component Invariant Engine
// ============================================================================

export interface ComponentInvariantResult {
  valid: boolean;
  errors: string[];
  totalWeight: number;
  count: number;
}

/**
 * Validates the foundational 4x50g assortment kit invariant:
 * - Exactly 4 component sachets
 * - Slots must be the unique set {0, 1, 2, 3}
 * - Each sachet must weigh exactly 50g with quantity = 1
 * - Net sum of weights must strictly equal 200g
 * - Each component must have a non-empty name (min 2 chars)
 */
export function validateComponentInvariant(
  components: Array<Partial<ComponentInput>>
): ComponentInvariantResult {
  const errors: string[] = [];
  const count = Array.isArray(components) ? components.length : 0;

  if (count !== 4) {
    errors.push(`Kit must contain exactly 4 sachets (received ${count}).`);
  }

  const seenSlots = new Set<number>();
  let totalWeight = 0;

  if (Array.isArray(components)) {
    for (let i = 0; i < components.length; i++) {
      const comp = components[i];
      const slot = comp.slot_index ?? i;

      // Slot range & uniqueness
      if (typeof slot !== "number" || slot < 0 || slot > 3 || !Number.isInteger(slot)) {
        errors.push(`Component #${i + 1} has invalid slot_index ${slot}. Expected 0, 1, 2, or 3.`);
      } else if (seenSlots.has(slot)) {
        errors.push(`Duplicate slot_index ${slot} detected. Slots 0, 1, 2, 3 must be unique.`);
      } else {
        seenSlots.add(slot);
      }

      // Name validation
      const name = comp.name?.trim() || "";
      if (name.length < 2) {
        errors.push(`Component in slot ${slot} is missing a valid name (minimum 2 characters).`);
      }

      // Weight and quantity checks
      const weight = comp.weight_g ?? 50;
      const quantity = comp.quantity ?? 1;

      if (quantity !== 1) {
        errors.push(`Component slot ${slot} quantity must be exactly 1 (got ${quantity}).`);
      }

      if (weight !== 50) {
        errors.push(`Component slot ${slot} ("${name || "unnamed"}") weight must be exactly 50g (got ${weight}g).`);
      }

      totalWeight += weight * quantity;
    }

    // Full slot coverage check
    if (count === 4) {
      for (let s = 0; s <= 3; s++) {
        if (!seenSlots.has(s)) {
          errors.push(`Missing component for slot_index ${s}. Slots 0, 1, 2, and 3 are required.`);
        }
      }
    }
  }

  if (totalWeight !== 200) {
    errors.push(`Total kit weight must be exactly 200g (got ${totalWeight}g).`);
  }

  return {
    valid: errors.length === 0,
    errors,
    totalWeight,
    count,
  };
}

// ============================================================================
// 3. Publication Blocker Engine
// ============================================================================

/**
 * Evaluates whether a trial dossier satisfies all publication gates:
 * 1. Identity & SEO: Title >= 3 chars, valid slug, SEO metadata/tagline.
 * 2. Pricing & Stock: Price > 0, compare_at >= price (if set), stock >= 1 if track.
 * 3. 4x50g Components: Exactly 4 sachets of 50g summing to 200g.
 * 4. Photography & Accessibility: Packaging/hero image present, non-empty alt text on all assets.
 * 5. Packaging, Label & Provenance Evidence: Evidence registered in claims with evidence_ref.
 */
export function validatePublication(details: TrialWithDetails): PublicationValidationResult {
  const blockers: string[] = [];
  const warnings: string[] = [];

  const { title, slug, price_paise, compare_at_price_paise, cost_paise, inventory_policy, inventory_quantity, hero_image_id } = details;
  const components = details.components || [];
  const assets = details.assets || [];
  const claims = details.claims || [];

  // Gate 1: Identity & Metadata
  if (!title || title.trim().length < 3) {
    blockers.push("Trial title is required (minimum 3 characters).");
  }
  if (!slug || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    blockers.push("Trial slug must be valid lowercase kebab-case.");
  }
  if (!details.meta_title && !details.tagline) {
    blockers.push("SEO meta title or tagline is required.");
  }
  if (!details.meta_description && !details.description) {
    blockers.push("SEO meta description or product description is required.");
  }

  // Gate 2: Commercial Pricing & Inventory
  if (typeof price_paise !== "number" || price_paise <= 0) {
    blockers.push("Trial price must be greater than 0 paise (free kits prohibited).");
  }
  if (compare_at_price_paise != null && compare_at_price_paise < price_paise) {
    blockers.push("Compare-at price cannot be lower than the selling price.");
  }
  if (cost_paise != null && cost_paise >= price_paise) {
    warnings.push(`Internal cost (₹${cost_paise / 100}) meets or exceeds selling price (₹${price_paise / 100}).`);
  }
  if (inventory_policy === "track" && inventory_quantity < 1) {
    blockers.push("Inventory stock must be at least 1 unit when tracking inventory.");
  }

  // Gate 3: 4x50g Kit Packaging Invariant
  const compResult = validateComponentInvariant(components);
  if (!compResult.valid) {
    blockers.push(...compResult.errors);
  } else {
    for (const c of components) {
      if (!c.estate || c.estate.trim().length === 0) {
        blockers.push(`Component at slot ${c.slot_index} ("${c.name}") is missing estate provenance.`);
      }
    }
  }

  // Gate 4: Media, Hero Image & Accessibility Alt Text
  const hasHero = hero_image_id != null || assets.some((a) => a.stage === "packaging" || a.stage === "hero");
  if (!hasHero) {
    blockers.push("Packaging or hero photograph must be attached before publication.");
  }

  for (const asset of assets) {
    if (!asset.alt_text || asset.alt_text.trim().length < 2) {
      blockers.push(`Asset for stage '${asset.stage}' (${asset.asset_url}) is missing required accessibility alt text.`);
    }
  }

  // Gate 5: Packaging, Label & Provenance Evidence
  const hasVerifiedClaim = claims.some((cl) => Boolean(cl.verified) && Boolean(cl.evidence_ref?.trim()));
  if (claims.length > 0 && !hasVerifiedClaim) {
    blockers.push("Attached regulatory and origin claims must have verified evidence references.");
  }

  return {
    can_publish: blockers.length === 0,
    blockers,
  };
}

// ============================================================================
// 4. Whitelist-Based Public Projection Engine (`toPublicDto`)
// ============================================================================

export interface PublicDtoOptions {
  allowDraftPreview?: boolean;
}

/**
 * Projects a TrialWithDetails record into a safe, whitelisted TrialPublicDto.
 * Strictly redacts internal COGS (cost_paise), supplier foreign keys,
 * inventory counts, private notes, and unverified claims.
 */
export function toPublicDto(
  details: TrialWithDetails,
  options: PublicDtoOptions = {}
): TrialPublicDto {
  if (details.status !== "published" && !options.allowDraftPreview) {
    throw new TrialNotFoundError(
      `Trial '${details.slug}' is not published (status: ${details.status}).`
    );
  }

  const in_stock = details.inventory_policy === "continue" || details.inventory_quantity > 0;

  const approvedAssets = (details.assets || []).filter(
    (a) => !a.rights_status || a.rights_status === "approved"
  );

  // Resolve hero image
  let hero_image: { url: string; alt_text: string } | null = null;
  if (details.hero_image) {
    hero_image = details.hero_image;
  } else {
    const heroAsset =
      approvedAssets.find((a) => a.stage === "hero") ||
      approvedAssets.find((a) => a.stage === "gallery") ||
      approvedAssets.find((a) => a.stage === "packaging") ||
      approvedAssets[0];
    if (heroAsset) {
      hero_image = {
        url: heroAsset.asset_url,
        alt_text: heroAsset.alt_text,
      };
    }
  }

  // Resolve pack gallery images
  const galleryAssets = approvedAssets
    .filter((a) => a.stage === "gallery" || (!a.slot_index && a.stage === "hero"))
    .map((a) => ({ url: a.asset_url, alt_text: a.alt_text }));

  const gallery_images: Array<{ url: string; alt_text: string }> = [
    ...(hero_image ? [hero_image] : []),
    ...galleryAssets.filter((g) => !hero_image || g.url !== hero_image.url),
  ];

  // Map 4 components with strict whitelist
  const components = (details.components || [])
    .slice()
    .sort((a, b) => a.slot_index - b.slot_index)
    .map((c: TrialComponent) => {
      // Parse tasting notes
      let tasting_notes: string[] = [];
      if (typeof c.tasting_notes === "string") {
        try {
          const parsed = JSON.parse(c.tasting_notes);
          if (Array.isArray(parsed)) {
            tasting_notes = parsed.map(String);
          } else if (typeof parsed === "string") {
            tasting_notes = parsed.split(",").map((s) => s.trim()).filter(Boolean);
          }
        } catch {
          tasting_notes = c.tasting_notes.split(",").map((s) => s.trim()).filter(Boolean);
        }
      } else if (Array.isArray(c.tasting_notes)) {
        tasting_notes = c.tasting_notes;
      }

      // Brewing parameters
      const brewing = {
        temp_c: c.brew_temp_c || 95,
        time_sec: c.brew_time_sec || 240,
        dose_g: c.leaf_dose_g || 2.5,
      };

      // Associated stage assets
      const componentAssets = (details.assets || [])
        .filter(
          (a: TrialAsset) =>
            (a.component_id === c.id || a.slot_index === c.slot_index) &&
            (!a.rights_status || a.rights_status === "approved")
        )
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((a: TrialAsset) => ({
          stage: a.stage,
          url: a.asset_url,
          alt_text: a.alt_text,
        }));

      // Associated bulk link
      const bulkLink = details.bulk_links?.find(
        (bl) => bl.component_id === c.id || (bl as { slot_index?: number }).slot_index === c.slot_index
      );

      const bulk_link = bulkLink
        ? {
            product_slug: bulkLink.product_slug || null,
            variant_title: bulkLink.variant_title || null,
          }
        : null;

      return {
        slot_index: c.slot_index,
        name: c.name,
        estate: c.estate,
        grade: c.grade,
        flush: c.flush,
        elevation: c.elevation || null,
        weight_g: 50,
        tasting_notes,
        brewing,
        bulk_link,
        assets: componentAssets,
      };
    });

  // Whitelist verified claims only
  const claims = (details.claims || [])
    .filter((cl) => Boolean(cl.verified))
    .map((cl) => ({
      claim_type: cl.claim_type,
      label: cl.label || cl.claim_text,
      verified: true,
    }));

  return {
    id: details.id,
    slug: details.slug,
    title: details.title,
    tagline: details.tagline,
    description: details.description,
    status: "published",
    pack_format: "4x50g_sachets",
    net_weight_g: 200,
    price_paise: details.price_paise,
    compare_at_price_paise: details.compare_at_price_paise,
    sku: details.sku,
    in_stock,
    hero_image,
    gallery_images,
    components,
    claims,
    meta: {
      title: details.meta_title,
      description: details.meta_description,
    },
  };
}
