/**
 * TeaFloww Private Label Studio — Strict Zod Input Validation Schemas
 * Milestone M1: Shared Architecture and Data Models
 */

import { z } from "zod";

// Base primitives
export const idSchema = z.string().trim().min(1, "Identifier required").max(64);

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Slug must be at least 3 characters")
  .max(120, "Slug cannot exceed 120 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must be lowercase alphanumeric with single hyphens");

export const skuSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3, "SKU must be at least 3 characters")
  .max(64, "SKU cannot exceed 64 characters")
  .regex(/^[A-Z0-9_-]+$/, "SKU must be uppercase alphanumeric with dashes/underscores");

export const revisionSchema = z.coerce.number().int().min(1, "Revision must be >= 1");

export const paiseSchema = z.coerce.number().int().min(0, "Amount in paise cannot be negative");

// 1. MOQ Input Schema
export const moqInputSchema = z.object({
  requestedUnits: z
    .coerce
    .number()
    .int()
    .min(1, "Requested units must be at least 1")
    .max(10_000_000, "Requested units exceed maximum allowed"),
  netWeightGrams: z.coerce.number().positive("Net weight must be > 0").max(100_000),
  teaMinBatchKg: z.coerce.number().nonnegative("Tea minimum batch kg must be >= 0"),
  packagingMOQ: z.coerce.number().int().nonnegative("Packaging MOQ must be >= 0"),
  printMOQ: z.coerce.number().int().nonnegative("Print MOQ must be >= 0"),
  fillingMOQ: z.coerce.number().int().nonnegative().default(100),
  orderMultiple: z.coerce.number().int().nonnegative().default(1),
  minOrderValuePaise: paiseSchema.default(0),
  unitEstimatedPricePaise: paiseSchema.default(0),
});

// 2. Compatibility Input Schema
export const compatibilityInputSchema = z.object({
  familyCode: z.enum(["pouch", "tin", "jar", "box", "carton", "sachet", "bag"]),
  variantSubstrate: z.string().trim().min(2).max(100).optional(),
  printMethodCode: z.enum([
    "paper_label",
    "bopp_label",
    "direct_digital",
    "gravure",
    "screen_print",
    "sleeve",
  ]),
  colorCount: z.coerce.number().int().min(1).max(12).default(1),
  requestedUnits: z.coerce.number().int().positive().optional(),
});

// 3. Project Draft Schemas
export const createProjectSchema = z.object({
  brandName: z.string().trim().min(2, "Brand name must be at least 2 characters").max(100).optional(),
  title: z.string().trim().min(2, "Project title must be at least 2 characters").max(150),
  targetMarket: z.string().trim().min(2).max(80).default("IN"),
  clientId: idSchema.optional(),
  brandId: idSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  initialConfig: z.record(z.string(), z.unknown()).default({}),
});

export const updateProjectDraftSchema = z.object({
  projectId: idSchema,
  expectedRevision: revisionSchema,
  title: z.string().trim().min(2).max(150).optional(),
  targetMarket: z.string().trim().min(2).max(80).optional(),
  notes: z.string().trim().max(2000).optional(),
  draftConfiguration: z.record(z.string(), z.unknown()).optional(),
  status: z
    .enum(["draft", "configured", "in_review", "quoted", "accepted", "archived", "cancelled"])
    .optional(),
});

// 4. Project Item Schema
export const projectItemInputSchema = z.object({
  id: idSchema.optional(),
  teaOptionId: idSchema.optional(),
  tea_option_id: idSchema.optional(),
  packagingVariantId: idSchema.optional(),
  packaging_variant_id: idSchema.optional(),
  printMethodId: idSchema.optional(),
  print_method_id: idSchema.optional(),
  fillWeightGrams: z.coerce.number().positive("Fill weight must be > 0").max(50000).optional(),
  fill_weight_grams: z.coerce.number().positive("Fill weight must be > 0").max(50000).optional(),
  quantityUnits: z.coerce.number().int().positive("Quantity units must be > 0").optional(),
  quantity_units: z.coerce.number().int().positive("Quantity units must be > 0").optional(),
  colorCount: z.coerce.number().int().min(1).max(12).default(1),
  color_count: z.coerce.number().int().min(1).max(12).optional(),
  designVersionId: idSchema.nullable().optional(),
  design_version_id: idSchema.nullable().optional(),
});

// Milestone M4 Schemas: Projects, Concurrency & Quotations
export const createProjectDraftRequestSchema = z.object({
  title: z.string().trim().min(2, "Project title must be at least 2 characters").max(150),
  targetMarket: z.string().trim().min(2).max(80).default("IN"),
  target_market: z.string().trim().min(2).max(80).optional(),
  brandName: z.string().trim().min(2).max(100).optional(),
  brand_name: z.string().trim().min(2).max(100).optional(),
  brandId: idSchema.optional(),
  brand_id: idSchema.optional(),
  clientId: idSchema.optional(),
  client_id: idSchema.optional(),
  notes: z.string().trim().max(2000).optional(),
  draftConfiguration: z.record(z.string(), z.unknown()).optional(),
  draft_configuration: z.record(z.string(), z.unknown()).optional(),
  initialConfig: z.record(z.string(), z.unknown()).optional(),
  items: z.array(projectItemInputSchema).optional(),
});

export const updateProjectRequestSchema = z
  .object({
    expectedRevision: revisionSchema.optional(),
    expected_revision: revisionSchema.optional(),
    title: z.string().trim().min(2).max(150).optional(),
    targetMarket: z.string().trim().min(2).max(80).optional(),
    target_market: z.string().trim().min(2).max(80).optional(),
    notes: z.string().trim().max(2000).optional(),
    status: z
      .enum(["draft", "configured", "in_review", "quoted", "accepted", "archived", "cancelled"])
      .optional(),
    draftConfiguration: z.record(z.string(), z.unknown()).optional(),
    draft_configuration: z.record(z.string(), z.unknown()).optional(),
    items: z.array(projectItemInputSchema).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.expected_revision === undefined && data.expectedRevision === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "expected_revision is required for optimistic concurrency control (CAS)",
        path: ["expected_revision"],
      });
    }
  });

export const customerCreateQuoteSchema = z
  .object({
    projectId: idSchema.optional(),
    project_id: idSchema.optional(),
    priceBookId: idSchema.optional(),
    price_book_id: idSchema.optional(),
    validityDays: z.coerce.number().int().min(1).max(90).default(14),
    validity_days: z.coerce.number().int().min(1).max(90).optional(),
    destinationZone: z.enum(["local", "metro", "national", "international"]).default("metro"),
    destination_zone: z.enum(["local", "metro", "national", "international"]).optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.projectId && !data.project_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "projectId or project_id is required",
        path: ["projectId"],
      });
    }
  });

export const liveMoqCalculateSchema = z.object({
  requestedUnits: z.coerce.number().int().positive("Requested units must be positive").max(10_000_000).optional(),
  requested_units: z.coerce.number().int().positive().optional(),
  netWeightGrams: z.coerce.number().positive("Net weight must be positive").max(100_000).optional(),
  net_weight_grams: z.coerce.number().positive().optional(),
  teaMinBatchKg: z.coerce.number().nonnegative().optional(),
  tea_min_batch_kg: z.coerce.number().nonnegative().optional(),
  packagingMOQ: z.coerce.number().int().nonnegative().optional(),
  packaging_moq: z.coerce.number().int().nonnegative().optional(),
  printMOQ: z.coerce.number().int().nonnegative().optional(),
  print_moq: z.coerce.number().int().nonnegative().optional(),
  fillingMOQ: z.coerce.number().int().nonnegative().default(100),
  filling_moq: z.coerce.number().int().nonnegative().optional(),
  orderMultiple: z.coerce.number().int().positive().default(1),
  order_multiple: z.coerce.number().int().positive().optional(),
  minOrderValuePaise: paiseSchema.default(0),
  min_order_value_paise: paiseSchema.optional(),
  unitEstimatedPricePaise: paiseSchema.default(0),
  unit_estimated_price_paise: paiseSchema.optional(),
  teaOptionId: idSchema.optional(),
  tea_option_id: idSchema.optional(),
  packagingVariantId: idSchema.optional(),
  packaging_variant_id: idSchema.optional(),
  printMethodId: idSchema.optional(),
  print_method_id: idSchema.optional(),
});

export const liveQuoteCalculateSchema = z.object({
  requestedUnits: z.coerce.number().int().positive("Requested units must be positive").max(10_000_000).optional(),
  requested_units: z.coerce.number().int().positive().optional(),
  netWeightGrams: z.coerce.number().positive("Net weight must be positive").max(100_000).optional(),
  net_weight_grams: z.coerce.number().positive().optional(),
  teaOptionId: idSchema.optional(),
  tea_option_id: idSchema.optional(),
  packagingVariantId: idSchema.optional(),
  packaging_variant_id: idSchema.optional(),
  printMethodId: idSchema.optional(),
  print_method_id: idSchema.optional(),
  colorCount: z.coerce.number().int().min(1).max(12).default(1),
  color_count: z.coerce.number().int().min(1).max(12).optional(),
  isNitrogenFlushEnabled: z.boolean().default(false),
  is_nitrogen_flush_enabled: z.boolean().optional(),
  destinationZone: z.enum(["local", "metro", "national", "international"]).default("metro"),
  destination_zone: z.enum(["local", "metro", "national", "international"]).optional(),
  priceBookId: idSchema.optional(),
  price_book_id: idSchema.optional(),
});

export const itemizedPricingCalculationSchema = z.object({
  requestedUnits: z.coerce.number().int().min(1).max(10_000_000),
  netWeightGrams: z.coerce.number().positive().max(100_000),
  teaOptionId: idSchema,
  packagingVariantId: idSchema,
  printMethodId: idSchema,
  colorCount: z.coerce.number().int().min(1).max(12).default(1),
  isNitrogenFlushEnabled: z.boolean().default(false),
  destinationZone: z.enum(["local", "metro", "national", "international"]).default("metro"),
  priceBookId: idSchema.optional(),
});

export const projectDraftConfigSchema = z.object({
  step: z.enum(["tea", "packaging", "print", "artwork", "quantity", "summary"]).default("tea"),
  teaOptionId: idSchema.optional(),
  packagingVariantId: idSchema.optional(),
  printMethodId: idSchema.optional(),
  fillWeightGrams: z.coerce.number().positive().optional(),
  colorCount: z.coerce.number().int().min(1).max(12).default(1),
  isNitrogenFlushEnabled: z.boolean().default(false),
  requestedUnits: z.coerce.number().int().positive().optional(),
  destinationZone: z.enum(["local", "metro", "national", "international"]).default("metro"),
  brandName: z.string().trim().max(100).optional(),
  contactName: z.string().trim().max(100).optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().trim().max(20).optional(),
  companyName: z.string().trim().max(150).optional(),
});

export const publicQuoteItemDtoSchema = z.object({
  id: idSchema,
  project_item_id: idSchema.nullable().optional(),
  description: z.string(),
  quantity: z.number().int().nonnegative(),
  unit_price_paise: paiseSchema,
  line_total_paise: paiseSchema,
});

export const publicQuoteWithItemsDtoSchema = z.object({
  id: idSchema,
  quote_number: z.string(),
  status: z.string(),
  version: z.number().int().positive(),
  currency: z.literal("INR"),
  tea_subtotal_paise: paiseSchema,
  packaging_subtotal_paise: paiseSchema,
  printing_subtotal_paise: paiseSchema,
  tooling_setup_paise: paiseSchema,
  labor_subtotal_paise: paiseSchema,
  qc_subtotal_paise: paiseSchema,
  freight_paise: paiseSchema,
  tax_paise: paiseSchema,
  grand_total_paise: paiseSchema,
  issued_at: z.string().nullable(),
  valid_until: z.string().nullable(),
  accepted_at: z.string().nullable(),
  pdf_summary_url: z.string().nullable(),
  revision: z.number().int().positive(),
  items: z.array(publicQuoteItemDtoSchema),
  price_breakdown: z
    .object({
      taxDetails: z
        .object({
          teaGstPaise: paiseSchema,
          nonTeaGstPaise: paiseSchema,
        })
        .optional(),
      metrics: z
        .object({
          netTeaKg: z.number().nonnegative(),
          grossTeaKg: z.number().nonnegative(),
          cartonCount: z.number().int().nonnegative(),
          palletCount: z.number().int().nonnegative(),
          totalWeightKg: z.number().nonnegative(),
          batchCount: z.number().int().nonnegative(),
        })
        .optional(),
    })
    .optional(),
});

// 5. Quote Creation & Acceptance Schemas
export const createQuoteRequestSchema = z.object({
  projectId: idSchema,
  priceBookId: idSchema.optional(),
  validityDays: z.coerce.number().int().min(1).max(90).default(14),
});

export const acceptQuoteSchema = z.object({
  quoteId: idSchema,
  clientId: idSchema.optional(),
  acceptanceNotes: z.string().trim().max(500).optional(),
});

// 6. Artwork & Proof Approval Schemas
export const artworkUploadIntentSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  fileSizeBytes: z.coerce.number().int().positive().max(26_214_400), // 25 MB max
  mimeType: z.enum(["image/png", "image/jpeg", "image/webp", "image/svg+xml", "application/pdf"]),
  fileSha256: z.string().trim().length(64, "SHA-256 must be exactly 64 hex characters"),
  rightsAttestation: z.boolean().refine((val) => val === true, {
    message: "Customer must attest to legal ownership or license of submitted artwork",
  }),
});

export const proofApprovalSchema = z.object({
  designVersionId: idSchema,
  clientId: idSchema.optional(),
  legalDisclaimerAccepted: z.boolean().refine((val) => val === true, {
    message: "Legal proof disclaimer must be explicitly accepted",
  }),
  ipAddress: z.string().trim().max(45).optional(),
  userAgent: z.string().trim().max(300).optional(),
  notes: z.string().trim().max(500).optional(),
});

export const preflightValidateSchema = z.object({
  mime_type: z.string().trim().optional(),
  mimeType: z.string().trim().optional(),
  file_size_bytes: z.coerce.number().int().optional(),
  fileSizeBytes: z.coerce.number().int().optional(),
  width_px: z.coerce.number().int().optional(),
  widthPx: z.coerce.number().int().optional(),
  height_px: z.coerce.number().int().optional(),
  heightPx: z.coerce.number().int().optional(),
  target_width_mm: z.coerce.number().optional(),
  targetWidthMm: z.coerce.number().optional(),
  target_height_mm: z.coerce.number().optional(),
  targetHeightMm: z.coerce.number().optional(),
  file_data: z.string().optional(),
  fileData: z.string().optional(),
  svg_content: z.string().optional(),
  svgContent: z.string().optional(),
  filename: z.string().optional(),
  original_filename: z.string().optional(),
  is_encrypted: z.boolean().optional(),
  isEncrypted: z.boolean().optional(),
});

export const createDesignVersionRequestSchema = z.object({
  project_item_id: idSchema.optional(),
  projectItemId: idSchema.optional(),
  expected_revision: z.coerce.number().int().positive().optional(),
  expectedRevision: z.coerce.number().int().positive().optional(),
  scene_json: z.record(z.string(), z.unknown()).optional().default({}),
  sceneJson: z.record(z.string(), z.unknown()).optional(),
  asset_url: z.string().optional().nullable(),
  assetUrl: z.string().optional().nullable(),
  front_artwork_asset_id: idSchema.optional().nullable(),
  back_artwork_asset_id: idSchema.optional().nullable(),
  preview_render_url: z.string().optional().nullable(),
  print_ready_pdf_url: z.string().optional().nullable(),
  preflight_report: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const proofApprovalRequestSchema = z.object({
  disclaimer_accepted: z.boolean().optional(),
  legal_disclaimer_accepted: z.boolean().optional(),
  legalDisclaimerAccepted: z.boolean().optional(),
  signer_name: z.string().trim().max(100).optional(),
  signerName: z.string().trim().max(100).optional(),
  revision: z.coerce.number().int().positive().optional(),
  expected_revision: z.coerce.number().int().positive().optional(),
  expectedRevision: z.coerce.number().int().positive().optional(),
  notes: z.string().trim().max(1000).optional(),
  ip_address: z.string().trim().max(45).optional(),
  user_agent: z.string().trim().max(300).optional(),
});

export const proofRejectRequestSchema = z.object({
  reason: z.string().trim().min(1, "Rejection reason is required").max(1000),
  revision: z.coerce.number().int().positive().optional(),
  expected_revision: z.coerce.number().int().positive().optional(),
  expectedRevision: z.coerce.number().int().positive().optional(),
});

export const updateArtworkRequestSchema = z.object({
  expected_revision: z.coerce.number().int().positive().optional(),
  expectedRevision: z.coerce.number().int().positive().optional(),
  logo_asset_id: z.string().trim().optional(),
  logoAssetId: z.string().trim().optional(),
  artwork_url: z.string().trim().optional(),
  artworkUrl: z.string().trim().optional(),
  scene_json: z.record(z.string(), z.unknown()).optional(),
  sceneJson: z.record(z.string(), z.unknown()).optional(),
});

// 7. Admin Price Book Tier Schema
export const priceBookTierAdminSchema = z
  .object({
    priceBookId: idSchema,
    itemType: z.enum(["packaging", "print_method", "tea_markup"]),
    itemId: idSchema,
    minQty: z.coerce.number().int().nonnegative(),
    maxQty: z.coerce.number().int().nonnegative().nullable().optional(),
    unitPricePaise: paiseSchema,
  })
  .superRefine((data, ctx) => {
    if (data.maxQty !== null && data.maxQty !== undefined && data.maxQty < data.minQty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "maxQty cannot be less than minQty",
        path: ["maxQty"],
      });
    }
  });

// 8. Admin Job Release Gate Schema
export const releaseJobSchema = z.object({
  orderId: idSchema,
  targetCompletionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date must be YYYY-MM-DD")
    .optional(),
  operatorNotes: z.string().trim().max(1000).optional(),
});

// 9. QC Milestone Schema
export const qcMilestoneSchema = z.object({
  jobId: idSchema.optional(),
  job_id: idSchema.optional(),
  milestoneName: z.string().trim().min(2).max(100).optional(),
  milestone_name: z.string().trim().min(2).max(100).optional(),
  stage: z.enum([
    "raw_material",
    "raw_material_in",
    "packaging_incoming",
    "print_proof",
    "fill_weight",
    "seal_integrity",
    "sensory_cupping",
    "packaging_cartoning",
    "final",
    "final_pack",
  ]),
  status: z.enum(["pending", "passed", "failed", "waived", "conditionally_passed"]),
  inspectorName: z.string().trim().min(2).max(100).optional(),
  inspector_name: z.string().trim().min(2).max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  evidenceNotes: z.string().trim().max(1000).optional(),
  evidence_notes: z.string().trim().max(1000).optional(),
  evidencePhotoUrl: z
    .string()
    .trim()
    .url("Evidence photo must be a valid URL")
    .regex(/^https?:\/\//i, "Evidence photo must be an HTTP or HTTPS URL")
    .max(500)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  evidence_photo_url: z
    .string()
    .trim()
    .url("Evidence photo must be a valid URL")
    .regex(/^https?:\/\//i, "Evidence photo must be an HTTP or HTTPS URL")
    .max(500)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  evidence_url: z
    .string()
    .trim()
    .url("Evidence photo must be a valid URL")
    .regex(/^https?:\/\//i, "Evidence photo must be an HTTP or HTTPS URL")
    .max(500)
    .nullable()
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  cupping_score: z.coerce.number().min(0).max(100).optional(),
  recorded_weight_g: z.coerce.number().positive().optional(),
  target_weight_g: z.coerce.number().positive().optional(),
});

// ============================================================================
// Milestone M2: Admin Management Schemas
// ============================================================================

// 10. Admin Catalogue Query & Mutation Schemas
export const adminCatalogueQuerySchema = z.object({
  entity: z.enum(["packaging", "tea", "print_methods", "families"]).default("packaging"),
  status: z.enum(["draft", "published", "archived", "all"]).default("all"),
  family_code: z.enum(["pouch", "tin", "jar", "box", "carton", "sachet", "bag"]).optional(),
  search: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort_by: z.enum(["title", "sku", "created_at", "unit_cost_paise", "name"]).default("created_at"),
  sort_dir: z.enum(["asc", "desc"]).default("desc"),
});

export const urlOrPathSchema = z
  .string()
  .trim()
  .max(1000)
  .refine(
    (val) =>
      !val ||
      val.startsWith("/") ||
      val.startsWith("http://") ||
      val.startsWith("https://") ||
      val.startsWith("data:") ||
      val.startsWith("blob:"),
    { message: "Must be a valid URL, relative path, or data URI" }
  )
  .nullable()
  .optional()
  .or(z.literal(""));

function preprocessPackagingPayload(val: unknown): unknown {
  if (!val || typeof val !== "object") return val;
  const obj = { ...(val as Record<string, unknown>) };
  if (!obj.title && typeof obj.name === "string") {
    obj.title = obj.name;
  }
  if (!obj.hero_image_url && typeof obj.image_url === "string") {
    obj.hero_image_url = obj.image_url;
  }
  if (!obj.dieline_url && typeof obj.dieline_pdf_url === "string") {
    obj.dieline_url = obj.dieline_pdf_url;
  }
  if (!obj.compatible_print_method_ids && Array.isArray(obj.compatible_print_methods)) {
    obj.compatible_print_method_ids = obj.compatible_print_methods;
  }
  if (obj.depth_mm === "") obj.depth_mm = null;
  if (obj.supplier_sku === "") obj.supplier_sku = null;
  if (obj.dieline_url === "") obj.dieline_url = null;
  if (obj.hero_image_url === "") obj.hero_image_url = null;
  if (obj.unit_cost_paise === undefined && typeof obj.unit_cost_rupees === "number") {
    obj.unit_cost_paise = Math.round(obj.unit_cost_rupees * 100);
  }
  return obj;
}

const adminPackagingBaseSchema = z.object({
  id: idSchema.optional(),
  family_id: idSchema,
  slug: slugSchema,
  sku: skuSchema,
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  material: z.string().trim().min(2, "Material specification required").max(200),
  finish: z.string().trim().min(2).max(100),
  closure_type: z.string().trim().min(2).max(100),
  capacity_description: z.string().trim().min(2).max(100),
  net_weight_capacity_grams: z.coerce.number().positive("Net weight capacity must be > 0"),
  width_mm: z.coerce.number().positive("Width must be > 0"),
  height_mm: z.coerce.number().positive("Height must be > 0"),
  depth_mm: z.coerce.number().nonnegative().nullable().optional(),
  label_safe_width_mm: z.coerce.number().positive("Safe width must be > 0"),
  label_safe_height_mm: z.coerce.number().positive("Safe height must be > 0"),
  supplier_name: z.string().trim().min(2, "Supplier name required").max(150),
  supplier_sku: z.string().trim().max(100).nullable().optional(),
  unit_cost_paise: paiseSchema,
  lead_time_days: z.coerce.number().int().positive().default(14),
  moq_units: z.coerce.number().int().positive().default(500),
  order_multiple: z.coerce.number().int().positive().default(50),
  dieline_url: urlOrPathSchema,
  hero_image_url: urlOrPathSchema,
  image_illustrative: z.boolean().default(true),
  status: z.enum(["draft", "published", "archived"]).default("draft"),
  compatible_print_method_ids: z.array(idSchema).default([]),
});

export const adminCreatePackagingSchema = z.preprocess(
  preprocessPackagingPayload,
  adminPackagingBaseSchema
);

export const adminUpdatePackagingSchema = z.preprocess(
  preprocessPackagingPayload,
  adminPackagingBaseSchema.partial().extend({
    expected_revision: revisionSchema.optional(),
    expectedRevision: revisionSchema.optional(),
  })
);

export const adminCreateTeaOptionSchema = z.object({
  id: idSchema.optional(),
  slug: slugSchema,
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(150),
  origin_estate: z.string().trim().min(2, "Origin estate required").max(100),
  region: z.string().trim().min(2).max(100),
  grade: z.string().trim().min(1, "Grade required").max(50),
  flush: z.string().trim().min(1).max(50),
  tea_category: z.enum(["black", "green", "white", "oolong", "chai_blend", "herbal"]),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(2000),
  caffeine_level: z.enum(["none", "low", "medium", "high"]),
  base_cost_per_kg_paise: paiseSchema,
  min_batch_kg: z.coerce.number().positive().default(5.0),
  tasting_notes: z.array(z.string().trim()).default([]),
  regular_product_id: z.coerce.number().int().positive().nullable().optional(),
  is_published: z.boolean().default(true),
  sample_available: z.boolean().default(true),
});

export const adminUpdateTeaOptionSchema = adminCreateTeaOptionSchema
  .partial()
  .extend({
    expected_revision: revisionSchema.optional(),
    expectedRevision: revisionSchema.optional(),
  });

export const adminUpsertPrintMethodSchema = z.object({
  id: idSchema.optional(),
  code: z.enum(["paper_label", "bopp_label", "direct_digital", "gravure", "screen_print", "sleeve"]),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(1000).default(""),
  color_model: z.enum(["cmyk", "pantone", "spot"]),
  max_colors: z.coerce.number().int().positive().default(4),
  setup_fee_paise: paiseSchema.default(0),
  cylinder_fee_per_color_paise: paiseSchema.default(0),
  min_order_units: z.coerce.number().int().positive().default(100),
  lead_time_days: z.coerce.number().int().positive().default(10),
  is_active: z.boolean().default(true),
});

export const adminCompatibilityToggleSchema = z.object({
  packagingVariantId: idSchema,
  printMethodId: idSchema,
  isSupported: z.boolean(),
  notes: z.string().trim().max(500).nullable().optional(),
});

// 11. Admin Price Book Schemas
export const adminPriceBookQuerySchema = z.object({
  status: z.enum(["draft", "active", "archived", "all"]).default("all"),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminTierItemSchema = z.object({
  item_type: z.enum(["packaging", "print_method", "tea_markup"]),
  item_id: idSchema,
  min_qty: z.coerce.number().int().nonnegative(),
  max_qty: z.coerce.number().int().nonnegative().nullable().optional(),
  unit_price_paise: paiseSchema,
});

export const adminCreatePriceBookSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  currency: z.enum(["INR", "USD", "EUR", "GBP"]).default("INR"),
  is_default: z.boolean().default(false),
  effective_from: z.string().optional(),
  effective_to: z.string().nullable().optional(),
  margin_rate: z.coerce.number().min(0).max(0.99).default(0.25),
  filling_labor_paise_per_unit: paiseSchema.default(300),
  qc_charge_paise_per_batch: paiseSchema.default(250000),
  contingency_rate: z.coerce.number().min(0).max(0.5).default(0.05),
  loss_allowance_rate: z.coerce.number().min(0).max(0.2).default(0.03),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  tiers: z
    .array(adminTierItemSchema)
    .optional()
    .superRefine((tiers, ctx) => {
      if (!tiers) return;
      for (let i = 0; i < tiers.length; i++) {
        const t = tiers[i];
        if (t.max_qty !== null && t.max_qty !== undefined && t.max_qty < t.min_qty) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Tier ${i}: max_qty cannot be less than min_qty`,
            path: [i, "max_qty"],
          });
        }
      }
      const groups = new Map<string, typeof tiers>();
      for (const t of tiers) {
        const key = `${t.item_type}:${t.item_id}`;
        const list = groups.get(key) ?? [];
        list.push(t);
        groups.set(key, list);
      }
      for (const [key, group] of groups.entries()) {
        const sorted = [...group].sort((a, b) => a.min_qty - b.min_qty);
        for (let i = 0; i < sorted.length - 1; i++) {
          const cur = sorted[i];
          const next = sorted[i + 1];
          const curMax = cur.max_qty === null || cur.max_qty === undefined ? Infinity : cur.max_qty;
          if (curMax >= next.min_qty) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Overlapping quantity brackets detected for ${key} [${cur.min_qty}-${curMax}] overlaps [${next.min_qty}]`,
              path: [i, "max_qty"],
            });
          }
        }
      }
    }),
});

export const adminUpdatePriceBookSchema = adminCreatePriceBookSchema
  .partial()
  .extend({
    expected_revision: revisionSchema.optional(),
    expectedRevision: revisionSchema.optional(),
  });

export const adminUpsertMoqRuleSchema = z.object({
  id: idSchema.optional(),
  rule_type: z.enum(["tea", "packaging", "print", "global"]),
  target_id: idSchema.nullable().optional(),
  min_quantity: z.coerce.number().positive(),
  unit_basis: z.enum(["kg", "units", "orders"]),
  order_multiple: z.coerce.number().int().positive().default(1),
  min_order_value_paise: paiseSchema.default(0),
  effective_from: z.string().optional(),
  effective_to: z.string().nullable().optional(),
});

// 12. Admin Quote Schemas
export const adminQuoteQuerySchema = z.object({
  status: z
    .enum([
      "draft",
      "pricing_pending",
      "estimated",
      "firm_issued",
      "customer_accepted",
      "expired",
      "superseded",
      "converted",
      "all",
    ])
    .default("all"),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const adminUpdateQuoteSchema = z.object({
  expected_revision: revisionSchema.optional(),
  expectedRevision: revisionSchema.optional(),
  status: z
    .enum(["draft", "pricing_pending", "estimated", "firm_issued", "customer_accepted", "expired"])
    .optional(),
  tea_subtotal_paise: paiseSchema.optional(),
  packaging_subtotal_paise: paiseSchema.optional(),
  printing_subtotal_paise: paiseSchema.optional(),
  tooling_setup_paise: paiseSchema.optional(),
  labor_subtotal_paise: paiseSchema.optional(),
  qc_subtotal_paise: paiseSchema.optional(),
  freight_paise: paiseSchema.optional(),
  margin_paise: paiseSchema.optional(),
  extend_validity_days: z.coerce.number().int().min(1).max(90).optional(),
  operator_notes: z.string().trim().max(2000).optional(),
});

export const adminQuotePriceOverrideSchema = z.object({
  quoteId: idSchema.optional(),
  expected_revision: revisionSchema.optional(),
  expectedRevision: revisionSchema.optional(),
  teaSubtotalPaise: paiseSchema.optional(),
  packagingSubtotalPaise: paiseSchema.optional(),
  printingSubtotalPaise: paiseSchema.optional(),
  toolingSetupPaise: paiseSchema.optional(),
  laborSubtotalPaise: paiseSchema.optional(),
  qcSubtotalPaise: paiseSchema.optional(),
  freightPaise: paiseSchema.optional(),
  marginPaise: paiseSchema.optional(),
  tea_subtotal_paise: paiseSchema.optional(),
  packaging_subtotal_paise: paiseSchema.optional(),
  printing_subtotal_paise: paiseSchema.optional(),
  tooling_setup_paise: paiseSchema.optional(),
  labor_subtotal_paise: paiseSchema.optional(),
  qc_subtotal_paise: paiseSchema.optional(),
  freight_paise: paiseSchema.optional(),
  margin_paise: paiseSchema.optional(),
  operatorNotes: z.string().trim().max(1000).optional(),
  operator_notes: z.string().trim().max(1000).optional(),
});

export const adminIssueFirmQuoteSchema = z.object({
  quoteId: idSchema.optional(),
  expected_revision: revisionSchema.optional(),
  expectedRevision: revisionSchema.optional(),
  validityDays: z.coerce.number().int().min(1).max(90).default(14),
  validity_days: z.coerce.number().int().min(1).max(90).optional(),
});

// 13. Admin Production Job & QC Schemas
export const adminJobQuerySchema = z.object({
  status: z
    .enum([
      "scheduled",
      "procurement",
      "printing",
      "blending",
      "filling_packing",
      "qc",
      "ready_to_ship",
      "completed",
      "halted",
      "all",
    ])
    .default("all"),
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const adminReleaseJobSchema = z.object({
  orderId: idSchema.optional(),
  order_id: idSchema.optional(),
  targetCompletionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date must be YYYY-MM-DD")
    .optional(),
  target_completion_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Target date must be YYYY-MM-DD")
    .optional(),
  operatorNotes: z.string().trim().max(1000).optional(),
  operator_notes: z.string().trim().max(1000).optional(),
  operatorId: z.string().trim().max(100).optional(),
  operator_id: z.string().trim().max(100).optional(),
  override_justification: z.string().trim().max(2000).optional(),
  overrideJustification: z.string().trim().max(2000).optional(),
});

export const adminUpdateJobSchema = z.object({
  expected_revision: revisionSchema.optional(),
  expectedRevision: revisionSchema.optional(),
  status: z
    .enum([
      "scheduled",
      "procurement",
      "printing",
      "blending",
      "filling_packing",
      "qc",
      "ready_to_ship",
      "completed",
      "halted",
    ])
    .optional(),
  target_completion_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  actual_completion_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  operator_notes: z.string().trim().max(2000).optional(),
});

// 14. Milestone M3: Public Storefront Schemas
export const publicCatalogueQuerySchema = z.object({
  category: z.enum(["pouch", "tin", "jar", "carton", "sachet", "bag"]).optional(),
  capacity_min: z.coerce.number().nonnegative().optional(),
  capacity_max: z.coerce.number().nonnegative().optional(),
  material: z.string().trim().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  type: z.enum(["all", "packaging", "print_methods"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type PublicCatalogueQuery = z.infer<typeof publicCatalogueQuerySchema>;

export const startingPriceIndicatorSchema = z.object({
  currency: z.string().length(3),
  unit_price_paise: z.number().int().nonnegative(),
  formatted_unit_price: z.string(),
  min_quantity: z.number().int().positive(),
  tier_label: z.string().optional(),
});
export type StartingPriceIndicator = z.infer<typeof startingPriceIndicatorSchema>;

export const publicPackagingVariantDtoSchema = z.object({
  id: z.string().min(1),
  family_id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  sku: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  family: z.string().min(1),
  capacity_description: z.string(),
  net_capacity_grams: z.number().positive(),
  net_weight_capacity_grams: z.number().positive(),
  dimensions_mm: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
    depth: z.number().nonnegative().nullable(),
  }),
  label_safe_area_mm: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  material: z.string().min(1),
  finish: z.string(),
  closure_type: z.string(),
  barrier_properties: z.union([z.string(), z.array(z.string())]),
  moq_units: z.number().int().positive(),
  order_multiple: z.number().int().positive(),
  lead_time_days: z.number().int().nonnegative(),
  image_url: z.string().nullable(),
  hero_image_url: z.string().nullable(),
  image_illustrative: z.boolean(),
  dieline_url: z.string().nullable(),
  dieline_available: z.boolean(),
  supported_print_methods: z.array(z.string()),
  compatible_print_method_codes: z.array(z.string()),
  compatible_print_methods: z.array(z.unknown()).optional(),
  status: z.literal("published"),
  starting_price: startingPriceIndicatorSchema.nullable().optional(),
});
export type PublicPackagingVariantDtoSchema = z.infer<typeof publicPackagingVariantDtoSchema>;

export const publicCatalogueResponseSchema = z.object({
  items: z.array(publicPackagingVariantDtoSchema),
  packaging: z.array(publicPackagingVariantDtoSchema).optional(),
  print_methods: z.array(z.unknown()).optional(),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  has_more: z.boolean(),
});
export type PublicCatalogueResponse = z.infer<typeof publicCatalogueResponseSchema>;

export const publicPackagingDetailResponseSchema = publicPackagingVariantDtoSchema.extend({
  compatible_print_methods: z.array(z.unknown()).optional(),
  starting_price: startingPriceIndicatorSchema.nullable().optional(),
});
export type PublicPackagingDetailResponse = z.infer<typeof publicPackagingDetailResponseSchema>;

// ============================================================================
// Milestone M6: Samples, Orders & Production Lifecycle Schemas
// ============================================================================

export const sampleAddressSchema = z.object({
  name: z.string().trim().min(2, "Contact name must be at least 2 characters").max(100).optional(),
  line1: z.string().trim().min(3, "Address line 1 is required").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(2, "City is required").max(100),
  state: z.string().trim().max(100).optional(),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit Indian PIN code")
    .optional(),
  postal_code: z.string().trim().max(20).optional(),
  phone: z.string().trim().max(20).optional(),
  country: z.string().trim().max(60).default("IN"),
});
export type SampleAddressInput = z.infer<typeof sampleAddressSchema>;

export const customerCreateSampleOrderSchema = z.object({
  sample_type: z
    .enum([
      "tea_kit",
      "printed_proof",
      "packaged_mockup",
      "full_pack_sample",
      "tea_tasting_kit",
      "tasting_kit",
      "swatch_pack",
      "packaging_swatch",
    ])
    .default("tea_kit"),
  tea_recipe_ids: z.array(z.string().trim()).max(10).optional(),
  tea_option_id: idSchema.optional(),
  packaging_variant_id: idSchema.optional(),
  project_id: idSchema.optional(),
  quantity: z
    .coerce
    .number()
    .int()
    .min(1, "Quantity must be at least 1")
    .max(10, "Maximum sample quantity per order is 10")
    .default(1),
  coupon_code: z.string().trim().max(50).nullable().optional(),
  shipping_address: sampleAddressSchema.optional(),
  notes: z.string().trim().max(1000).optional(),
});
export type CustomerCreateSampleOrderInput = z.infer<typeof customerCreateSampleOrderSchema>;

export const customerOrderCheckoutSchema = z.object({
  quote_id: idSchema,
  idempotency_key: z.string().trim().max(128).optional(),
  expected_revision: revisionSchema.optional(),
  gateway_currency: z.string().trim().length(3).default("INR"),
  notes: z.string().trim().max(1000).optional(),
  acceptance_notes: z.string().trim().max(1000).optional(),
  shipping_address: z.record(z.string(), z.unknown()).optional(),
});
export type CustomerOrderCheckoutInput = z.infer<typeof customerOrderCheckoutSchema>;

export const customerPaymentIntentSchema = z.object({
  quote_id: idSchema.optional(),
  order_id: idSchema.optional(),
  deposit_percentage: z.coerce.number().min(1).max(100).default(50),
});
export type CustomerPaymentIntentInput = z.infer<typeof customerPaymentIntentSchema>;

export const customerReorderSchema = z.object({
  original_order_id: idSchema,
  quantity: z.coerce.number().int().positive("Reorder quantity must be positive"),
  notes: z.string().trim().max(1000).optional(),
});
export type CustomerReorderInput = z.infer<typeof customerReorderSchema>;

export const adminDispatchSampleSchema = z.object({
  courier: z.string().trim().max(100).nullable().optional(),
  carrier: z.string().trim().max(100).nullable().optional(),
  tracking_number: z.string().trim().min(3, "Tracking number required").max(100),
});
export type AdminDispatchSampleInput = z.infer<typeof adminDispatchSampleSchema>;

export const adminValidateReleaseSchema = z.object({
  order_id: idSchema.optional(),
  orderId: idSchema.optional(),
});
export type AdminValidateReleaseInput = z.infer<typeof adminValidateReleaseSchema>;


