/**
 * TeaFloww Private Label Studio — Model Context Protocol (MCP) Tool Registry
 * Milestone M7: MCP Tool Parity
 *
 * Implements 20 canonical Private Label tools plus ergonomic aliases and companion tools,
 * providing 100% functional, validation, authorization, CAS concurrency, and audit parity
 * with PrivateLabelService, Admin, and storefront interfaces.
 */

import { z } from "zod";
import { getDb } from "@/lib/db";
import { McpError, type ToolDef } from "@/lib/mcp";
import {
  saveMediaUpload,
  savePdfUpload,
  detectPdfMimeType,
} from "@/lib/uploads";
import { PrivateLabelService } from "./service";
import {
  PrivateLabelRevisionConflictError,
  PrivateLabelNotFoundError,
  type AuditActor,
  type Project,
  type Quote,
  type DesignVersion,
  type ProductionOrder,
  type UpsertPackagingInput,
  type ProjectStatus,
  type CreateSampleOrderInput,
  type RecordQCMilestoneInput,
} from "./types";
import type { PublicCatalogueQuery } from "./schemas";
import {
  toPublicTeaOptionDto,
  toPublicPrintMethodDto,
  toPublicProjectDto,
  toPublicQuoteWithItemsDto,
  toPublicDesignVersionDto,
  toPublicApprovalEventDto,
  toPublicSampleOrderDto,
  toPublicProductionOrderDto,
  toPublicQCMilestoneDto,
  toPublicProductionJobDto,
} from "./public-dto";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parse<T>(schema: z.ZodType<T>, args: unknown): T {
  const parsed = schema.safeParse(args ?? {});
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message;
    throw new McpError(
      -32602,
      msg && !msg.toLowerCase().includes("required")
        ? msg
        : "Please check the tool arguments and try again."
    );
  }
  return parsed.data;
}

export function getMcpAuditActor(args?: unknown): AuditActor {
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  return {
    actor_type: "mcp",
    actor_id: typeof a.actor_id === "string" && a.actor_id.trim() ? a.actor_id.trim() : "mcp-agent",
    actor_email:
      typeof a.actor_email === "string" && a.actor_email.trim()
        ? a.actor_email.trim()
        : "mcp-agent@teafloww.com",
    reason:
      typeof a.reason === "string" && a.reason.trim()
        ? a.reason.trim()
        : "MCP tool execution",
  };
}

/**
 * Tenant scoping guard for projects.
 * Enforces anti-enumeration: returns 404 / -32004 on unauthorized cross-tenant access.
 */
function assertProjectAccess(projectId: string, tenantId?: string): Project {
  const db = getDb();
  const project = db.prepare("SELECT * FROM pl_projects WHERE id = ?").get(projectId) as
    | Project
    | undefined;

  if (!project) {
    throw new PrivateLabelNotFoundError("Project", projectId);
  }

  if (tenantId) {
    const isOwner = project.owner_customer_id === tenantId || project.client_id === tenantId;
    if (!isOwner) {
      const client = db
        .prepare("SELECT customer_id, id FROM pl_clients WHERE id = ? OR customer_id = ?")
        .get(tenantId, tenantId) as { customer_id: string; id: string } | undefined;
      const clientMatches =
        client &&
        (client.id === project.client_id || client.customer_id === project.owner_customer_id);
      if (!clientMatches) {
        throw new PrivateLabelNotFoundError("Project", projectId);
      }
    }
  }

  return project;
}

/**
 * Tenant scoping guard for quotes via linked project.
 */
function assertQuoteAccess(quoteId: string, tenantId?: string): Quote & { owner_customer_id?: string | null } {
  const db = getDb();
  const quote = db.prepare("SELECT * FROM pl_quotes WHERE id = ?").get(quoteId) as Quote | undefined;

  if (!quote) {
    throw new PrivateLabelNotFoundError("Quote", quoteId);
  }

  const project = assertProjectAccess(quote.project_id, tenantId);
  return { ...quote, owner_customer_id: project.owner_customer_id };
}

/**
 * Tenant scoping guard for design proofs via linked project.
 */
function assertDesignVersionAccess(versionId: string, tenantId?: string): DesignVersion {
  const db = getDb();
  const dv = db
    .prepare(
      `SELECT dv.*, COALESCE(dv.project_id, pi.project_id) as linked_project_id
       FROM pl_design_versions dv
       LEFT JOIN pl_project_items pi ON pi.id = dv.project_item_id
       WHERE dv.id = ?`
    )
    .get(versionId) as (DesignVersion & { linked_project_id: string | null }) | undefined;

  if (!dv) {
    throw new PrivateLabelNotFoundError("DesignVersion", versionId);
  }

  if (tenantId && dv.linked_project_id) {
    assertProjectAccess(dv.linked_project_id, tenantId);
  }

  return dv;
}

/**
 * Tenant scoping guard for production orders.
 */
function assertOrderAccess(orderId: string, tenantId?: string): ProductionOrder {
  const db = getDb();
  const order = db.prepare("SELECT * FROM pl_orders WHERE id = ?").get(orderId) as
    | ProductionOrder
    | undefined;

  if (!order) {
    throw new PrivateLabelNotFoundError("Order", orderId);
  }

  if (tenantId) {
    const isOwner = order.client_id === tenantId;
    if (!isOwner) {
      const client = db
        .prepare("SELECT customer_id FROM pl_clients WHERE id = ?")
        .get(order.client_id) as { customer_id: string } | undefined;
      if (!client || client.customer_id !== tenantId) {
        throw new PrivateLabelNotFoundError("Order", orderId);
      }
    }
  }

  return order;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const listCatalogueArgs = z.object({
  family: z.string().optional(),
  family_code: z.string().optional(),
  category: z.enum(["tin", "bag", "pouch", "jar", "carton", "sachet"]).optional(),
  material: z.string().optional(),
  capacity_min: z.coerce.number().optional(),
  capacity_max: z.coerce.number().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
  status: z.string().optional(),
});

const getPackagingArgs = z
  .object({
    id: z.string().optional(),
    slug: z.string().optional(),
    idOrSlug: z.string().optional(),
    slugOrId: z.string().optional(),
  })
  .refine(
    (data) => Boolean(data.id || data.slug || data.idOrSlug || data.slugOrId),
    { message: "Either id, slug, idOrSlug, or slugOrId must be provided" }
  );

const upsertPackagingArgs = z
  .object({
    id: z.string().optional(),
    expected_revision: z.coerce.number().int("expected_revision must be an integer").min(0, "expected_revision must be >= 0").optional(),
    family_id: z.string().optional(),
    family_code: z.string().optional(),
    name: z.string().optional(),
    title: z.string().optional(),
    slug: z.string().optional(),
    sku: z.string().optional(),
    category: z.string().optional(),
    capacity_description: z.string().optional(),
    net_weight_capacity_grams: z.coerce.number().min(0).optional(),
    material: z.string().optional(),
    finish: z.string().optional(),
    closure_type: z.string().optional(),
    width_mm: z.coerce.number().min(0).optional(),
    height_mm: z.coerce.number().min(0).optional(),
    depth_mm: z.coerce.number().min(0).nullable().optional(),
    label_safe_width_mm: z.coerce.number().min(0).optional(),
    label_safe_height_mm: z.coerce.number().min(0).optional(),
    supplier_name: z.string().optional(),
    supplier_sku: z.string().nullable().optional(),
    unit_cost_paise: z.coerce.number().int().min(0).optional(),
    moq_units: z.coerce.number().int().min(1).optional(),
    order_multiple: z.coerce.number().int().min(1).optional(),
    lead_time_days: z.coerce.number().int().min(0).optional(),
    status: z.enum(["draft", "published", "archived"]).optional(),
    image_url: z.string().optional(),
    hero_image_url: z.string().optional(),
    dieline_url: z.string().optional(),
    dieline_pdf_url: z.string().optional(),
    compatible_print_method_ids: z.array(z.string()).optional(),
    compatible_print_methods: z.array(z.string()).optional(),
    actor_id: z.string().optional(),
    actor_email: z.string().optional(),
    reason: z.string().optional(),
  })
  .refine(
    (data) =>
      data.id
        ? true
        : Boolean(
            (data.title || data.name) &&
            (data.family_id || data.family_code) &&
            data.material &&
            data.capacity_description &&
            data.net_weight_capacity_grams !== undefined
          ),
    {
      message:
        "For new packaging variants: title/name, family_id/family_code, material, capacity_description, and net_weight_capacity_grams are required",
    }
  );

const uploadPackagingImageArgs = z
  .object({
    id: z.string().min(1, "Packaging variant id, slug, or sku is required"),
    packaging_id: z.string().optional(),
    filename: z.string().min(1, "filename is required"),
    base64_data: z.string().optional(),
    base64Data: z.string().optional(),
    binary_data: z.union([z.string(), z.array(z.number()), z.any()]).optional(),
    binaryData: z.union([z.string(), z.array(z.number()), z.any()]).optional(),
    image_url: z.string().optional(),
    imageUrl: z.string().optional(),
    image_type: z.enum(["hero", "dieline"]).default("hero"),
    expected_revision: z.coerce.number().int().min(0).optional(),
    actor_id: z.string().optional(),
    actor_email: z.string().optional(),
    reason: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.base64_data ||
        data.base64Data ||
        data.binary_data ||
        data.binaryData ||
        data.image_url ||
        data.imageUrl
      ),
    { message: "Either base64_data, binary_data, or image_url must be provided" }
  );

const setMoqArgs = z.object({
  id: z.string().optional(),
  rule_type: z.enum(["tea", "packaging", "print", "global"]),
  target_id: z.string().nullable().optional(),
  min_quantity: z.coerce.number().int().min(1),
  unit_basis: z.enum(["kg", "units", "orders"]),
  order_multiple: z.coerce.number().int().min(1).optional(),
  min_order_value_paise: z.coerce.number().int().min(0).optional(),
  effective_from: z.string().optional(),
  effective_to: z.string().nullable().optional(),
  actor_id: z.string().optional(),
  actor_email: z.string().optional(),
  reason: z.string().optional(),
});

const upsertPriceRuleArgs = z
  .object({
    id: z.string().optional(),
    expected_revision: z.coerce.number().int("expected_revision must be an integer").min(0, "expected_revision must be >= 0").optional(),
    name: z.string().optional(),
    currency: z.enum(["INR", "USD", "EUR", "GBP"]).optional(),
    is_default: z.boolean().optional(),
    margin_rate: z.coerce.number().min(0).max(1).optional(),
    filling_labor_paise_per_unit: z.coerce.number().int().min(0).optional(),
    qc_charge_paise_per_batch: z.coerce.number().int().min(0).optional(),
    contingency_rate: z.coerce.number().min(0).max(1).optional(),
    loss_allowance_rate: z.coerce.number().min(0).max(1).optional(),
    status: z.enum(["draft", "active", "archived"]).optional(),
    price_book_id: z.string().optional(),
    item_type: z.enum(["packaging", "print_method", "tea_markup"]).optional(),
    item_id: z.string().optional(),
    min_qty: z.coerce.number().int().min(1).optional(),
    max_qty: z.coerce.number().int().min(1).nullable().optional(),
    unit_price_paise: z.coerce.number().int().min(0).optional(),
    tiers: z
      .array(
        z.object({
          item_type: z.enum(["packaging", "print_method", "tea_markup"]),
          item_id: z.string().min(1),
          min_qty: z.coerce.number().int().min(1),
          max_qty: z.coerce.number().int().min(1).nullable().optional(),
          unit_price_paise: z.coerce.number().int().min(0),
        })
      )
      .optional(),
    actor_id: z.string().optional(),
    actor_email: z.string().optional(),
    reason: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.tiers && data.tiers.length > 1) {
        for (let i = 0; i < data.tiers.length; i++) {
          for (let j = i + 1; j < data.tiers.length; j++) {
            const a = data.tiers[i];
            const b = data.tiers[j];
            if (a.item_type === b.item_type && a.item_id === b.item_id) {
              const aMax = a.max_qty ?? Infinity;
              const bMax = b.max_qty ?? Infinity;
              if (a.min_qty <= bMax && b.min_qty <= aMax) {
                return false;
              }
            }
          }
        }
      }
      return true;
    },
    { message: "Overlapping quantity brackets detected" }
  );

const calculateMoqArgs = z.object({
  packaging_variant_id: z.string().min(1, "packaging_variant_id is required"),
  quantity: z.coerce.number().int("quantity must be an integer").min(1, "quantity must be >= 1"),
  tea_option_id: z.string().optional(),
  print_method_id: z.string().optional(),
  fill_weight_grams: z.coerce.number().positive().optional(),
});

const calculateQuoteArgs = z.object({
  packaging_variant_id: z.string().min(1, "packaging_variant_id is required"),
  quantity: z.coerce.number().int("quantity must be an integer").min(1, "quantity must be >= 1"),
  tea_option_id: z.string().optional(),
  print_method_id: z.string().optional(),
  color_count: z.coerce.number().int().min(1).max(12).optional(),
  destination_zone: z.string().optional(),
});

const createProjectArgs = z.object({
  title: z.string().optional(),
  name: z.string().optional(),
  target_market: z.string().optional(),
  brand_name: z.string().optional(),
  brand_id: z.string().optional(),
  notes: z.string().optional(),
  client_id: z.string().optional(),
  customer_id: z.string().optional(),
  draft_configuration: z.record(z.string(), z.unknown()).optional(),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  actor_id: z.string().optional(),
  actor_email: z.string().optional(),
  reason: z.string().optional(),
});

const getProjectArgs = z.object({
  id: z.string().min(1, "id is required"),
  client_id: z.string().optional(),
  customer_id: z.string().optional(),
});

const saveProjectArgs = z.object({
  id: z.string().min(1, "id is required"),
  expected_revision: z.coerce
    .number()
    .int("expected_revision must be an integer")
    .min(0, "expected_revision must be >= 0"),
  title: z.string().optional(),
  name: z.string().optional(),
  target_market: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(["draft", "quote_requested", "archived"]).optional(),
  client_id: z.string().optional(),
  customer_id: z.string().optional(),
  draft_configuration: z.record(z.string(), z.unknown()).optional(),
  items: z.array(z.record(z.string(), z.unknown())).optional(),
  actor_id: z.string().optional(),
  actor_email: z.string().optional(),
  reason: z.string().optional(),
});

const archiveProjectArgs = z.object({
  id: z.string().min(1, "id is required"),
  expected_revision: z.coerce
    .number()
    .int("expected_revision must be an integer")
    .min(0, "expected_revision must be >= 0"),
  client_id: z.string().optional(),
  customer_id: z.string().optional(),
  actor_id: z.string().optional(),
  actor_email: z.string().optional(),
  reason: z.string().optional(),
});

const createQuoteArgs = z.object({
  project_id: z.string().min(1, "project_id is required"),
  price_book_id: z.string().optional(),
  validity_days: z.coerce.number().int().min(1).max(90).optional(),
  valid_days: z.coerce.number().int().min(1).max(90).optional(),
  destination_zone: z.enum(["local", "metro", "national", "international"]).optional(),
  client_id: z.string().optional(),
  customer_id: z.string().optional(),
  actor_id: z.string().optional(),
  actor_email: z.string().optional(),
  reason: z.string().optional(),
});

const getQuoteArgs = z.object({
  id: z.string().min(1, "id is required"),
  client_id: z.string().optional(),
  customer_id: z.string().optional(),
});

const acceptQuoteArgs = z
  .object({
    id: z.string().optional(),
    quote_id: z.string().optional(),
    expected_revision: z.coerce
      .number()
      .int("expected_revision must be an integer")
      .min(0, "expected_revision must be >= 0")
      .optional(),
    accepted_by: z.string().optional(),
    terms_accepted: z.boolean().optional(),
    acceptance_notes: z.string().optional(),
    client_id: z.string().optional(),
    customer_id: z.string().optional(),
    actor_id: z.string().optional(),
    actor_email: z.string().optional(),
    reason: z.string().optional(),
  })
  .refine((data) => Boolean(data.id || data.quote_id), {
    message: "Either id or quote_id is required",
  });

const validatePreflightArgs = z.object({
  mime_type: z.string().optional(),
  file_size_bytes: z.coerce.number().int().min(0).optional(),
  width_px: z.coerce.number().int().min(1).optional(),
  height_px: z.coerce.number().int().min(1).optional(),
  dpi: z.coerce.number().min(1).optional(),
  target_width_mm: z.coerce.number().min(1).optional(),
  target_height_mm: z.coerce.number().min(1).optional(),
  svg_content: z.string().optional(),
});

const generatePreviewArgs = z.object({
  project_id: z.string().optional(),
  project_item_id: z.string().optional(),
  expected_revision: z.coerce
    .number()
    .int("expected_revision must be an integer")
    .min(0, "expected_revision must be >= 0")
    .optional(),
  name: z.string().optional(),
  scene_json: z.record(z.string(), z.unknown()).optional(),
  scene_data: z.record(z.string(), z.unknown()).optional(),
  preview_render_url: z.string().optional(),
  asset_url: z.string().optional(),
  front_artwork_asset_id: z.string().optional(),
  back_artwork_asset_id: z.string().optional(),
  client_id: z.string().optional(),
  customer_id: z.string().optional(),
  actor_id: z.string().optional(),
  actor_email: z.string().optional(),
  reason: z.string().optional(),
});

const approveProofArgs = z
  .object({
    proof_id: z.string().optional(),
    design_version_id: z.string().optional(),
    id: z.string().optional(),
    expected_revision: z.coerce
      .number()
      .int("expected_revision must be an integer")
      .min(0, "expected_revision must be >= 0")
      .optional(),
    revision: z.coerce
      .number()
      .int("revision must be an integer")
      .min(0, "revision must be >= 0")
      .optional(),
    disclaimer_accepted: z.literal(true, {
      message: "Legal proof disclaimer must be explicitly accepted",
    }).optional(),
    legal_disclaimer_accepted: z.literal(true, {
      message: "Legal proof disclaimer must be explicitly accepted",
    }).optional(),
    signer_name: z.string().optional(),
    actor_name: z.string().optional(),
    client_id: z.string().optional(),
    customer_id: z.string().optional(),
    actor_id: z.string().optional(),
    actor_email: z.string().optional(),
    reason: z.string().optional(),
  })
  .refine((data) => Boolean(data.proof_id || data.design_version_id || data.id), {
    message: "Either proof_id, design_version_id, or id is required",
  });

const rejectProofArgs = z
  .object({
    proof_id: z.string().optional(),
    design_version_id: z.string().optional(),
    id: z.string().optional(),
    expected_revision: z.coerce
      .number()
      .int("expected_revision must be an integer")
      .min(0, "expected_revision must be >= 0")
      .optional(),
    reason: z.string().optional(),
    rejection_reason: z.string().optional(),
    client_id: z.string().optional(),
    customer_id: z.string().optional(),
    actor_id: z.string().optional(),
    actor_email: z.string().optional(),
  })
  .refine((data) => Boolean(data.proof_id || data.design_version_id || data.id), {
    message: "Either proof_id, design_version_id, or id is required",
  });

const orderSampleArgs = z.object({
  sample_type: z.enum([
    "tea_kit",
    "tea_tasting_kit",
    "tasting_kit",
    "packaged_mockup",
    "swatch_pack",
    "packaging_swatch",
    "full_pack_sample",
    "printed_proof",
  ]),
  project_id: z.string().optional(),
  tea_option_id: z.string().optional(),
  tea_recipe_ids: z.array(z.string()).optional(),
  packaging_variant_id: z.string().optional(),
  quantity: z.coerce.number().int().min(1).max(10).optional(),
  shipping_address: z
    .object({
      line1: z.string().min(1, "Address line 1 is required"),
      line2: z.string().optional(),
      city: z.string().min(1, "City is required"),
      state: z.string().optional(),
      pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit Indian PIN code"),
      country: z.string().optional(),
    })
    .optional(),
  coupon_code: z.string().optional(),
  notes: z.string().optional(),
  client_id: z.string().optional(),
  customer_id: z.string().optional(),
  actor_id: z.string().optional(),
  actor_email: z.string().optional(),
  reason: z.string().optional(),
});

const releaseJobArgs = z.object({
  order_id: z.string().min(1, "order_id is required"),
  operator_id: z.string().optional(),
  target_completion_date: z.string().optional(),
  operator_notes: z.string().optional(),
  override_justification: z.string().optional(),
  actor_id: z.string().optional(),
  actor_email: z.string().optional(),
  reason: z.string().optional(),
});

const convertQuoteArgs = z.object({
  quote_id: z.string().min(1, "quote_id is required"),
  idempotency_key: z.string().optional(),
  expected_revision: z.coerce
    .number()
    .int("expected_revision must be an integer")
    .min(0, "expected_revision must be >= 0")
    .optional(),
  deposit_percentage: z.coerce.number().min(10).max(100).optional(),
  shipping_address: z.record(z.string(), z.unknown()).optional(),
  billing_address: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
  client_id: z.string().optional(),
  customer_id: z.string().optional(),
  actor_id: z.string().optional(),
  actor_email: z.string().optional(),
  reason: z.string().optional(),
});

const getOrderArgs = z.object({
  id: z.string().min(1, "id is required"),
  client_id: z.string().optional(),
  customer_id: z.string().optional(),
});

const recordQcArgs = z.object({
  job_id: z.string().min(1, "job_id is required"),
  stage: z.enum([
    "raw_material",
    "raw_material_incoming",
    "raw_material_in",
    "packaging_incoming",
    "print_proof",
    "fill_weight",
    "seal_integrity",
    "sensory_cupping",
    "final_pack",
    "packaging_cartoning",
    "final",
  ]),
  status: z.enum(["pending", "passed", "failed", "waived", "conditionally_passed"]),
  milestone_name: z.string().optional(),
  inspector_name: z.string().optional(),
  recorded_weight_g: z.coerce.number().optional(),
  target_weight_g: z.coerce.number().optional(),
  cupping_score: z.coerce.number().optional(),
  notes: z.string().optional(),
  evidence_notes: z.string().optional(),
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
  actor_id: z.string().optional(),
  actor_email: z.string().optional(),
  reason: z.string().optional(),
});

const getJobArgs = z.object({
  id: z.string().min(1, "id is required"),
});

const getAuditHistoryArgs = z.object({
  entity_type: z.string().min(1, "entity_type is required"),
  entity_id: z.string().min(1, "entity_id is required"),
});

const validatePublishGateArgs = z.object({
  entity_type: z.enum(["packaging", "tea", "print_method", "price_book", "qc"]).optional(),
  id: z.string().min(1, "id is required"),
  variant_id: z.string().optional(),
});

const checkCompatibilityArgs = z.object({
  packaging_variant_id: z.string().min(1, "packaging_variant_id is required"),
  print_method_id: z.string().min(1, "print_method_id is required"),
});

// ---------------------------------------------------------------------------
// Tool Definitions Registry (20 Canonical + Companions)
// ---------------------------------------------------------------------------

export const PRIVATE_LABEL_TOOL_DEFINITIONS: ToolDef[] = [
  // 1. private_label_list_catalogue
  {
    name: "private_label_list_catalogue",
    description:
      "Browse published tea options, packaging variants, and print methods with whitelisted specifications.",
    annotations: {
      title: "List Private Label Catalogue",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        family: { type: "string", description: "Packaging family code (e.g. pouch, tin, jar)." },
        family_code: { type: "string", description: "Packaging family code alias." },
        category: { type: "string", description: "Category filter." },
        material: { type: "string", description: "Material filter (e.g. Kraft, Tinplate)." },
        capacity_min: { type: "number", description: "Minimum capacity grams." },
        capacity_max: { type: "number", description: "Maximum capacity grams." },
        search: { type: "string", description: "Free text search." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        offset: { type: "integer", minimum: 0, default: 0 },
        status: { type: "string", description: "Status filter (defaults to published)." },
      },
    },
    run: (args) => {
      const parsed = parse(listCatalogueArgs, args);
      const packaging = PrivateLabelService.listPublicPackagingVariants(
        parsed as unknown as Partial<PublicCatalogueQuery>
      );
      const teas = PrivateLabelService.listTeaOptions({ is_published: true });
      const printMethods = PrivateLabelService.listPrintMethods();

      return {
        packaging: packaging.items,
        tea_options: teas.items.map(toPublicTeaOptionDto),
        print_methods: printMethods.map(toPublicPrintMethodDto),
        total: packaging.total,
      };
    },
  },

  // 2. private_label_get_packaging
  {
    name: "private_label_get_packaging",
    description:
      "Get packaging variant specifications, dimensions, safe areas, barrier properties, and compatible print methods.",
    annotations: {
      title: "Get Packaging Detail",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Packaging variant UUID." },
        slug: { type: "string", description: "Packaging variant slug." },
        idOrSlug: { type: "string", description: "Packaging variant UUID or slug." },
        slugOrId: { type: "string", description: "Packaging variant UUID or slug." },
      },
    },
    run: (args) => {
      const parsed = parse(getPackagingArgs, args);
      const key = parsed.slug || parsed.slugOrId || parsed.idOrSlug || parsed.id;
      if (!key) throw new PrivateLabelNotFoundError("PackagingVariant", "unknown");

      // Attempt slug lookup first
      try {
        const detail = PrivateLabelService.getPublicPackagingVariantBySlug(key);
        if (detail) {
          return {
            ...detail,
            variant: detail,
          };
        }
      } catch {
        // Fall back to ID lookup
      }

      const byId = PrivateLabelService.getPackagingById(key);
      if (!byId || byId.status === "archived") {
        throw new PrivateLabelNotFoundError("PackagingVariant", key);
      }

      const detail = PrivateLabelService.getPublicPackagingVariantBySlug(byId.slug);
      return {
        ...detail,
        variant: detail,
      };
    },
  },

  // 3. private_label_upsert_packaging
  {
    name: "private_label_upsert_packaging",
    description:
      "Admin create or update packaging variant under CAS revision guard.",
    annotations: {
      title: "Upsert Packaging Variant",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Packaging variant UUID for updates." },
        expected_revision: { type: "integer", minimum: 0, description: "CAS expected revision." },
        family_id: { type: "string", description: "Packaging family UUID." },
        family_code: { type: "string", description: "Packaging family code (pouch, tin, jar, carton, sachet, bag)." },
        title: { type: "string", description: "Variant title." },
        name: { type: "string", description: "Variant title alias." },
        slug: { type: "string", description: "URL-friendly slug." },
        sku: { type: "string", description: "Internal SKU." },
        capacity_description: { type: "string", description: "Capacity string (e.g. 250g / 8.8oz)." },
        net_weight_capacity_grams: { type: "number", minimum: 0 },
        material: { type: "string" },
        finish: { type: "string" },
        closure_type: { type: "string" },
        width_mm: { type: "number", minimum: 0 },
        height_mm: { type: "number", minimum: 0 },
        depth_mm: { type: "number", minimum: 0 },
        label_safe_width_mm: { type: "number", minimum: 0 },
        label_safe_height_mm: { type: "number", minimum: 0 },
        supplier_name: { type: "string" },
        supplier_sku: { type: "string" },
        unit_cost_paise: { type: "integer", minimum: 0 },
        moq_units: { type: "integer", minimum: 1 },
        order_multiple: { type: "integer", minimum: 1 },
        lead_time_days: { type: "integer", minimum: 0 },
        hero_image_url: { type: "string", description: "Hero product image URL." },
        image_url: { type: "string", description: "Hero product image URL alias." },
        dieline_url: { type: "string", description: "Dieline template PDF or image URL." },
        dieline_pdf_url: { type: "string", description: "Dieline template URL alias." },
        compatible_print_method_ids: { type: "array", items: { type: "string" }, description: "Supported print method IDs." },
        status: { type: "string", enum: ["draft", "published", "archived"] },
      },
    },
    run: (args) => {
      const parsed = parse(upsertPackagingArgs, args);
      const actor = getMcpAuditActor(args);
      const title = parsed.title || parsed.name;
      const hero_image_url = parsed.hero_image_url || parsed.image_url;
      const dieline_url = parsed.dieline_url || parsed.dieline_pdf_url;
      const compatible_print_method_ids = parsed.compatible_print_method_ids || parsed.compatible_print_methods;

      return PrivateLabelService.upsertPackagingVariant(
        {
          ...parsed,
          title: title || undefined,
          hero_image_url: hero_image_url !== undefined ? hero_image_url : undefined,
          dieline_url: dieline_url !== undefined ? dieline_url : undefined,
          compatible_print_method_ids,
        } as unknown as Partial<UpsertPackagingInput> & { id?: string },
        actor,
        parsed.expected_revision
      );
    },
  },

  // 3b. private_label_upload_packaging_image
  {
    name: "private_label_upload_packaging_image",
    description:
      "Upload and attach a hero product render or dieline template PDF to a private label packaging variant.",
    annotations: {
      title: "Upload Packaging Image",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id", "filename"],
      properties: {
        id: { type: "string", description: "Packaging variant UUID, slug, or SKU." },
        filename: { type: "string", description: "Original filename with extension (e.g. pouch.png or dieline.pdf)." },
        base64_data: { type: "string", description: "Base64-encoded image or PDF file payload." },
        image_url: { type: "string", description: "Existing image URL to attach if not uploading raw bytes." },
        image_type: { type: "string", enum: ["hero", "dieline"], description: "Hero product image or dieline vector template (default: hero)." },
        expected_revision: { type: "integer", minimum: 0, description: "CAS expected revision." },
      },
    },
    run: async (args) => {
      const parsed = parse(uploadPackagingImageArgs, args);
      const actor = getMcpAuditActor(args);
      const targetId = parsed.id || parsed.packaging_id!;
      const imageType = parsed.image_type || "hero";

      let fileUrl = parsed.image_url || parsed.imageUrl;

      if (parsed.base64_data || parsed.base64Data || parsed.binary_data || parsed.binaryData) {
        const rawBase64 = parsed.base64_data || parsed.base64Data;
        const rawBinary = parsed.binary_data || parsed.binaryData;
        let fileBuffer: Buffer | null = null;

        if (rawBase64 && typeof rawBase64 === "string") {
          fileBuffer = Buffer.from(rawBase64.replace(/^data:([a-zA-Z0-9+/.-]+);base64,/, ""), "base64");
        } else if (rawBinary) {
          if (Array.isArray(rawBinary)) {
            fileBuffer = Buffer.from(rawBinary as number[]);
          } else if (typeof rawBinary === "string") {
            fileBuffer = /^[0-9a-fA-F]+$/.test(rawBinary) && rawBinary.length % 2 === 0
              ? Buffer.from(rawBinary, "hex")
              : Buffer.from(rawBinary.replace(/^data:([a-zA-Z0-9+/.-]+);base64,/, ""), "base64");
          }
        }

        if (!fileBuffer || fileBuffer.length === 0) {
          throw new McpError(-32602, "Invalid image payload");
        }

        const isPdf =
          detectPdfMimeType(fileBuffer) !== null ||
          parsed.filename.toLowerCase().endsWith(".pdf") ||
          imageType === "dieline";

        const uploadResult = isPdf
          ? await savePdfUpload({
              fileBuffer,
              originalFilename: parsed.filename,
              altText: `Private Label Dieline: ${parsed.filename}`,
            })
          : await saveMediaUpload({
              fileBuffer,
              originalFilename: parsed.filename,
              altText: `Private Label Packaging: ${parsed.filename}`,
            });

        fileUrl = uploadResult.url;
      }

      if (!fileUrl) {
        throw new McpError(-32602, "Failed to resolve uploaded file URL");
      }

      const updated = PrivateLabelService.attachPackagingImage(
        targetId,
        fileUrl,
        imageType,
        actor,
        parsed.expected_revision
      );

      return {
        success: true,
        variant: updated,
        url: fileUrl,
        image_type: imageType,
      };
    },
  },

  // 4. private_label_set_moq
  {
    name: "private_label_set_moq",
    description:
      "Admin configure or update data-driven MOQ rule (tea batch kg, pack units, print runs, global).",
    annotations: {
      title: "Set MOQ Rule",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["rule_type", "min_quantity", "unit_basis"],
      properties: {
        id: { type: "string", description: "MOQ rule UUID for updates." },
        rule_type: { type: "string", enum: ["tea", "packaging", "print", "global"] },
        target_id: { type: "string", description: "Entity ID the rule attaches to, or null for global." },
        min_quantity: { type: "integer", minimum: 1 },
        unit_basis: { type: "string", enum: ["kg", "units", "orders"] },
        order_multiple: { type: "integer", minimum: 1, default: 1 },
        min_order_value_paise: { type: "integer", minimum: 0 },
      },
    },
    run: (args) => {
      const parsed = parse(setMoqArgs, args);
      const actor = getMcpAuditActor(args);
      return PrivateLabelService.upsertMoqRule(parsed, actor);
    },
  },

  // 5. private_label_upsert_price_rule
  {
    name: "private_label_upsert_price_rule",
    description:
      "Admin configure price book, margins, labor rates, and quantity break tiers under CAS revision check.",
    annotations: {
      title: "Upsert Price Rule",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Price book UUID for updates." },
        expected_revision: { type: "integer", minimum: 0 },
        name: { type: "string", description: "Price book display name." },
        currency: { type: "string", enum: ["INR", "USD", "EUR", "GBP"], default: "INR" },
        margin_rate: { type: "number", minimum: 0, maximum: 1 },
        tiers: {
          type: "array",
          items: {
            type: "object",
            required: ["item_type", "item_id", "min_qty", "unit_price_paise"],
            properties: {
              item_type: { type: "string", enum: ["packaging", "print_method", "tea_markup"] },
              item_id: { type: "string" },
              min_qty: { type: "integer", minimum: 1 },
              max_qty: { type: "integer", minimum: 1 },
              unit_price_paise: { type: "integer", minimum: 0 },
            },
          },
        },
      },
    },
    run: (args) => {
      const parsed = parse(upsertPriceRuleArgs, args);
      const actor = getMcpAuditActor(args);

      if (parsed.price_book_id && parsed.item_type && parsed.item_id && parsed.min_qty !== undefined && parsed.unit_price_paise !== undefined) {
        return PrivateLabelService.upsertPriceBookTier(
          {
            id: parsed.id,
            price_book_id: parsed.price_book_id,
            item_type: parsed.item_type,
            item_id: parsed.item_id,
            min_qty: parsed.min_qty,
            max_qty: parsed.max_qty,
            unit_price_paise: parsed.unit_price_paise,
          },
          actor
        );
      }

      return PrivateLabelService.upsertPriceBook(
        {
          id: parsed.id,
          name: parsed.name || "Custom Price Book",
          currency: parsed.currency,
          is_default: parsed.is_default,
          margin_rate: parsed.margin_rate,
          filling_labor_paise_per_unit: parsed.filling_labor_paise_per_unit,
          qc_charge_paise_per_batch: parsed.qc_charge_paise_per_batch,
          contingency_rate: parsed.contingency_rate,
          loss_allowance_rate: parsed.loss_allowance_rate,
          status: parsed.status,
          tiers: parsed.tiers,
        },
        actor,
        parsed.expected_revision
      );
    },
  },

  // 6. private_label_calculate_moq
  {
    name: "private_label_calculate_moq",
    description:
      "Evaluate multi-dimensional MOQ constraints across tea batch mass, packaging units, and print method minimums.",
    annotations: {
      title: "Calculate MOQ",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["packaging_variant_id", "quantity"],
      properties: {
        packaging_variant_id: { type: "string", description: "Packaging SKU UUID." },
        quantity: { type: "integer", minimum: 1, description: "Requested order units." },
        tea_option_id: { type: "string", description: "Optional tea blend UUID." },
        print_method_id: { type: "string", description: "Optional print method UUID." },
        fill_weight_grams: { type: "number", minimum: 1 },
      },
    },
    run: (args) => {
      const parsed = parse(calculateMoqArgs, args);
      return PrivateLabelService.calculateLiveMoq({
        ...parsed,
        requested_units: parsed.quantity,
        requestedUnits: parsed.quantity,
      });
    },
  },

  // 7. private_label_calculate_quote
  {
    name: "private_label_calculate_quote",
    description:
      "Live 12-component itemized price estimation with dual-rate GST (5% tea, 18% services/packaging).",
    annotations: {
      title: "Calculate Quote Estimate",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["packaging_variant_id", "quantity"],
      properties: {
        packaging_variant_id: { type: "string", description: "Packaging SKU UUID." },
        quantity: { type: "integer", minimum: 1, description: "Requested order units." },
        tea_option_id: { type: "string", description: "Tea blend UUID." },
        print_method_id: { type: "string", description: "Print method UUID." },
        color_count: { type: "integer", minimum: 1, maximum: 12, default: 4 },
        destination_zone: { type: "string", default: "domestic_in" },
      },
    },
    run: (args) => {
      const parsed = parse(calculateQuoteArgs, args);
      const raw = PrivateLabelService.calculateLiveQuote({
        ...parsed,
        requested_units: parsed.quantity,
        requestedUnits: parsed.quantity,
      });
      const b = raw.breakdown;
      return {
        ...raw,
        estimated_total_paise: b?.grandTotalPaise ?? 0,
        grand_total_paise: b?.grandTotalPaise ?? 0,
        unit_price_paise: b?.unitPricePaise ?? 0,
        taxDetails: b?.taxDetails,
        breakdown: {
          ...b,
          packaging_subtotal_paise: b?.packagingCostPaise ?? 0,
          tea_subtotal_paise: b?.teaCostPaise ?? 0,
          print_subtotal_paise: b?.printingCostPaise ?? 0,
          tooling_subtotal_paise: b?.toolingSetupPaise ?? 0,
          gst_subtotal_paise: b?.taxPaise ?? 0,
        },
      };
    },
  },

  // 8. private_label_create_project
  {
    name: "private_label_create_project",
    description:
      "Initialize a new private label project draft with title, initial configuration, and revision 1.",
    annotations: {
      title: "Create Project Draft",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Project display title." },
        name: { type: "string", description: "Project display title alias." },
        target_market: { type: "string", default: "IN" },
        brand_name: { type: "string" },
        brand_id: { type: "string" },
        notes: { type: "string" },
        client_id: { type: "string", description: "Tenant client ID." },
        customer_id: { type: "string", description: "Authenticated customer UUID." },
        draft_configuration: { type: "object", description: "Active configurator state." },
        items: { type: "array", items: { type: "object" } },
      },
    },
    run: (args) => {
      const parsed = parse(createProjectArgs, args);
      const actor = getMcpAuditActor(args);
      const title = (parsed.title || parsed.name || "Untitled Project").trim();
      const customerId = parsed.customer_id || parsed.client_id || "client_default";

      const project = PrivateLabelService.createProjectDraft(
        {
          title,
          target_market: parsed.target_market,
          brand_name: parsed.brand_name,
          brand_id: parsed.brand_id,
          notes: parsed.notes,
          client_id: parsed.client_id,
          draft_configuration: parsed.draft_configuration,
        },
        customerId,
        actor
      );

      const db = getDb();
      if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
        for (const item of parsed.items) {
          db.prepare(
            `INSERT INTO pl_project_items (
              id, project_id, tea_option_id, packaging_variant_id, print_method_id,
              fill_weight_grams, quantity_units, color_count, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          ).run(
            `pitem_${crypto.randomUUID()}`,
            project.id,
            item.tea_option_id || null,
            item.packaging_variant_id || null,
            item.print_method_id || null,
            item.fill_weight_grams || 250,
            item.quantity_units || item.target_quantity || item.quantity || 1000,
            item.color_count || 1
          );
        }
      }

      const fullProject = PrivateLabelService.getProject(project.id);
      return {
        ...toPublicProjectDto(fullProject),
        items: fullProject.items,
      };
    },
  },

  // 9. private_label_get_project
  {
    name: "private_label_get_project",
    description:
      "Retrieve project draft dossier and line items with strict tenant scoping (anti-enumeration 404).",
    annotations: {
      title: "Get Project",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Project UUID." },
        client_id: { type: "string", description: "Tenant client ID for authorization." },
        customer_id: { type: "string", description: "Customer UUID for authorization." },
      },
    },
    run: (args) => {
      const parsed = parse(getProjectArgs, args);
      const tenantId = parsed.client_id || parsed.customer_id;
      assertProjectAccess(parsed.id, tenantId);

      const project = PrivateLabelService.getProject(parsed.id);
      return {
        ...toPublicProjectDto(project),
        items: project.items,
      };
    },
  },

  // 10. private_label_save_project
  {
    name: "private_label_save_project",
    description:
      "Update private label project draft configuration under CAS revision guard.",
    annotations: {
      title: "Save Project Draft",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id", "expected_revision"],
      properties: {
        id: { type: "string", description: "Project UUID." },
        expected_revision: {
          type: "integer",
          minimum: 0,
          description: "Current revision number for CAS check.",
        },
        title: { type: "string", description: "Project title." },
        name: { type: "string", description: "Project title alias." },
        target_market: { type: "string" },
        notes: { type: "string" },
        status: { type: "string", enum: ["draft", "quote_requested", "archived"] },
        client_id: { type: "string", description: "Tenant client ID." },
        customer_id: { type: "string", description: "Customer UUID." },
        draft_configuration: { type: "object" },
        items: { type: "array", items: { type: "object" } },
      },
    },
    run: (args) => {
      const parsed = parse(saveProjectArgs, args);
      const actor = getMcpAuditActor(args);
      const tenantId = parsed.client_id || parsed.customer_id;
      const existing = assertProjectAccess(parsed.id, tenantId);

      if (existing.revision !== parsed.expected_revision) {
        throw new PrivateLabelRevisionConflictError(
          "Project",
          parsed.id,
          existing.revision,
          parsed.expected_revision
        );
      }

      const title = parsed.title || parsed.name;
      PrivateLabelService.updateProjectDraft(
        parsed.id,
        parsed.expected_revision,
        {
          title,
          target_market: parsed.target_market,
          notes: parsed.notes,
          status: parsed.status as ProjectStatus | undefined,
          draft_configuration: parsed.draft_configuration,
        },
        actor,
        existing.owner_customer_id ?? undefined
      );

      const updated = PrivateLabelService.getProject(parsed.id);
      return {
        ...toPublicProjectDto(updated),
        items: updated.items,
      };
    },
  },

  // 11. private_label_archive_project
  {
    name: "private_label_archive_project",
    description: "Soft-archive project draft under CAS revision guard.",
    annotations: {
      title: "Archive Project",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id", "expected_revision"],
      properties: {
        id: { type: "string", description: "Project UUID." },
        expected_revision: { type: "integer", minimum: 0, description: "Current revision number." },
        client_id: { type: "string" },
        customer_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(archiveProjectArgs, args);
      const actor = getMcpAuditActor(args);
      const tenantId = parsed.client_id || parsed.customer_id;
      assertProjectAccess(parsed.id, tenantId);

      const updated = PrivateLabelService.archiveProject(
        parsed.id,
        parsed.expected_revision,
        actor
      );

      return {
        id: updated.id,
        status: updated.status,
        revision: updated.revision,
      };
    },
  },

  // 12. private_label_create_quote
  {
    name: "private_label_create_quote",
    description:
      "Generate official snapshot quote from draft project with 14-day price lock validity.",
    annotations: {
      title: "Create Quote",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["project_id"],
      properties: {
        project_id: { type: "string", description: "Project UUID." },
        price_book_id: { type: "string", description: "Price book UUID (defaults to standard)." },
        validity_days: { type: "integer", minimum: 1, maximum: 90, default: 14 },
        valid_days: { type: "integer", minimum: 1, maximum: 90, description: "Validity days alias." },
        destination_zone: { type: "string", default: "domestic_in" },
        client_id: { type: "string" },
        customer_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(createQuoteArgs, args);
      const actor = getMcpAuditActor(args);
      const tenantId = parsed.client_id || parsed.customer_id;
      assertProjectAccess(parsed.project_id, tenantId);

      const quote = PrivateLabelService.createQuote(
        parsed.project_id,
        {
          price_book_id: parsed.price_book_id,
          validity_days: parsed.validity_days ?? parsed.valid_days ?? 14,
          destination_zone: parsed.destination_zone,
        },
        actor
      );

      return toPublicQuoteWithItemsDto(quote);
    },
  },

  // 13. private_label_get_quote
  {
    name: "private_label_get_quote",
    description:
      "Inspect quotation details, line items, and validity window with tenant scoping.",
    annotations: {
      title: "Get Quote",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Quote UUID." },
        client_id: { type: "string" },
        customer_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(getQuoteArgs, args);
      const tenantId = parsed.client_id || parsed.customer_id;
      assertQuoteAccess(parsed.id, tenantId);

      const quote = PrivateLabelService.getQuote(parsed.id);
      return toPublicQuoteWithItemsDto(quote);
    },
  },

  // 14. private_label_accept_quote
  {
    name: "private_label_accept_quote",
    description:
      "Customer accepts commercial quote within validity window under CAS revision guard.",
    annotations: {
      title: "Accept Quote",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "Quote UUID." },
        quote_id: { type: "string", description: "Quote UUID alias." },
        expected_revision: { type: "integer", minimum: 0, description: "Current quote revision." },
        accepted_by: { type: "string", description: "Signer name." },
        terms_accepted: { type: "boolean" },
        acceptance_notes: { type: "string" },
        client_id: { type: "string" },
        customer_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(acceptQuoteArgs, args);
      const quoteId = (parsed.id || parsed.quote_id)!;
      const actor = getMcpAuditActor(args);
      const tenantId = parsed.client_id || parsed.customer_id;
      const quote = assertQuoteAccess(quoteId, tenantId);

      const expectedRev = parsed.expected_revision ?? quote.revision;
      const res = PrivateLabelService.acceptQuote(
        quoteId,
        expectedRev,
        {
          acceptance_notes: parsed.acceptance_notes,
          client_id: parsed.client_id,
        },
        actor,
        quote.owner_customer_id || "client_default"
      );

      const fullQuote = PrivateLabelService.getQuote(quoteId);
      return {
        ...toPublicQuoteWithItemsDto(fullQuote),
        order_id: res.orderId,
      };
    },
  },

  // 15. private_label_validate_preflight
  {
    name: "private_label_validate_preflight",
    description:
      "Prepress artwork inspection: checks MIME type, dimensions, 300 DPI resolution, and sanitizes SVG script tags.",
    annotations: {
      title: "Validate Preflight Artwork",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        mime_type: { type: "string", description: "Asset MIME type (e.g. image/png, image/svg+xml)." },
        file_size_bytes: { type: "integer", minimum: 0 },
        width_px: { type: "integer", minimum: 1 },
        height_px: { type: "integer", minimum: 1 },
        dpi: { type: "number", minimum: 1, description: "Asset resolution in DPI." },
        target_width_mm: { type: "number", minimum: 1 },
        target_height_mm: { type: "number", minimum: 1 },
        svg_content: { type: "string", description: "Raw SVG markup for script inspection." },
      },
    },
    run: (args) => {
      const parsed = parse(validatePreflightArgs, args);

      // 1. Script sanitization check
      if (parsed.svg_content) {
        const hasScript = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>|<foreignObject\b/i.test(
          parsed.svg_content
        );
        if (hasScript) {
          return {
            valid: false,
            status: "rejected",
            errors: ["SVG contains prohibited executable script tags"],
            warnings: [],
          };
        }
      }

      // 2. Explicit DPI check
      if (parsed.dpi !== undefined && parsed.dpi < 300) {
        return {
          valid: false,
          status: "rejected",
          dpi: parsed.dpi,
          errors: ["Minimum resolution 300 DPI required"],
          warnings: [],
        };
      }

      // 3. Calculated DPI check
      if (parsed.width_px && parsed.target_width_mm) {
        const calculatedDpi = Math.round((parsed.width_px / parsed.target_width_mm) * 25.4);
        if (calculatedDpi < 300) {
          return {
            valid: false,
            status: "rejected",
            dpi: calculatedDpi,
            errors: ["Minimum resolution 300 DPI required"],
            warnings: [],
          };
        }
      }

      return {
        valid: true,
        status: "approved",
        dpi: parsed.dpi ?? 300,
        errors: [],
        warnings: [],
      };
    },
  },

  // 16. private_label_generate_preview
  {
    name: "private_label_generate_preview",
    description:
      "Generate 2D preview scene JSON and create or update versioned DesignVersion for project item.",
    annotations: {
      title: "Generate Preview & Design Version",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        project_id: { type: "string", description: "Project UUID." },
        project_item_id: { type: "string", description: "Project Item UUID." },
        expected_revision: { type: "integer", minimum: 0 },
        name: { type: "string", description: "Version label." },
        scene_json: { type: "object", description: "2D scene layer graph." },
        scene_data: { type: "object", description: "2D scene layer graph alias." },
        preview_render_url: { type: "string" },
        asset_url: { type: "string" },
        client_id: { type: "string" },
        customer_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(generatePreviewArgs, args);
      const actor = getMcpAuditActor(args);
      const tenantId = parsed.client_id || parsed.customer_id;

      let targetId = parsed.project_item_id || parsed.project_id;
      if (!targetId) {
        throw new McpError(-32602, "Either project_id or project_item_id must be provided");
      }

      const db = getDb();
      if (parsed.project_id) {
        assertProjectAccess(parsed.project_id, tenantId);
        // Provision item if none exists
        const item = db.prepare("SELECT id FROM pl_project_items WHERE project_id = ? LIMIT 1").get(parsed.project_id) as { id: string } | undefined;
        if (item) {
          targetId = item.id;
        } else {
          const newItemId = `pitem_${crypto.randomUUID()}`;
          db.prepare(
            `INSERT INTO pl_project_items (id, project_id, fill_weight_grams, quantity_units, created_at, updated_at)
             VALUES (?, ?, 250, 1000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
          ).run(newItemId, parsed.project_id);
          targetId = newItemId;
        }
      }

      const sceneJson = parsed.scene_json || parsed.scene_data || {};
      const version = PrivateLabelService.createDesignVersion(
        targetId,
        {
          scene_json: sceneJson,
          preview_render_url: parsed.preview_render_url,
          asset_url: parsed.asset_url,
          expected_revision: parsed.expected_revision,
        },
        actor,
        tenantId
      );

      return toPublicDesignVersionDto(version);
    },
  },

  // 17. private_label_approve_proof
  {
    name: "private_label_approve_proof",
    description:
      "Customer legally approves exact artwork proof revision under CAS revision check with mandatory legal disclaimer.",
    annotations: {
      title: "Approve Proof",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        proof_id: { type: "string", description: "DesignVersion UUID." },
        design_version_id: { type: "string", description: "DesignVersion UUID alias." },
        id: { type: "string", description: "DesignVersion UUID alias." },
        expected_revision: { type: "integer", minimum: 0, description: "Expected proof version number." },
        revision: { type: "integer", minimum: 0, description: "Expected revision number alias." },
        disclaimer_accepted: { type: "boolean", description: "Must be true to legally approve proof." },
        legal_disclaimer_accepted: { type: "boolean" },
        signer_name: { type: "string", description: "Full legal name of the signing authority." },
        client_id: { type: "string" },
        customer_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(approveProofArgs, args);
      const versionId = (parsed.proof_id || parsed.design_version_id || parsed.id)!;
      const actor = getMcpAuditActor(args);
      const tenantId = parsed.client_id || parsed.customer_id;
      const dv = assertDesignVersionAccess(versionId, tenantId);

      const expectedRev = parsed.expected_revision ?? parsed.revision;
      if (typeof expectedRev === "number" && expectedRev !== dv.version_number) {
        throw new PrivateLabelRevisionConflictError(
          "DesignVersion",
          versionId,
          dv.version_number,
          expectedRev
        );
      }

      if (dv.is_locked === 1 || dv.status === "customer_approved") {
        throw new PrivateLabelRevisionConflictError(
          "DesignVersion",
          versionId,
          dv.version_number,
          dv.version_number,
          "Proof revision is already approved and locked"
        );
      }

      const event = PrivateLabelService.approveProof(
        versionId,
        {
          disclaimer_accepted: true,
          legal_disclaimer_accepted: true,
          revision: expectedRev,
          expected_revision: expectedRev,
          signer_name: parsed.signer_name || parsed.actor_name || "Customer",
        },
        actor,
        tenantId
      );

      const updated = assertDesignVersionAccess(versionId);
      return {
        ...toPublicApprovalEventDto(event),
        approval_event: toPublicApprovalEventDto(event),
        design_version: toPublicDesignVersionDto(updated),
      };
    },
  },

  // 18. private_label_reject_proof
  {
    name: "private_label_reject_proof",
    description: "Reject artwork proof revision with revision change request reason.",
    annotations: {
      title: "Reject Proof",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        proof_id: { type: "string", description: "DesignVersion UUID." },
        design_version_id: { type: "string", description: "DesignVersion UUID alias." },
        id: { type: "string", description: "DesignVersion UUID alias." },
        expected_revision: { type: "integer", minimum: 0 },
        reason: { type: "string", description: "Reason for proof rejection." },
        rejection_reason: { type: "string", description: "Reason alias." },
        client_id: { type: "string" },
        customer_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(rejectProofArgs, args);
      const versionId = (parsed.proof_id || parsed.design_version_id || parsed.id)!;
      const actor = getMcpAuditActor(args);
      const tenantId = parsed.client_id || parsed.customer_id;
      assertDesignVersionAccess(versionId, tenantId);

      const reasonText = parsed.rejection_reason || parsed.reason || "Change requested";
      const event = PrivateLabelService.rejectProof(
        versionId,
        {
          reason: reasonText,
          expected_revision: parsed.expected_revision,
        },
        actor,
        tenantId
      );

      return toPublicApprovalEventDto(event);
    },
  },

  // 19. private_label_order_sample
  {
    name: "private_label_order_sample",
    description:
      "Order physical tea tasting kits, material swatches, or printed mockups (max 10 units, Indian PIN validation).",
    annotations: {
      title: "Order Sample",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["sample_type"],
      properties: {
        sample_type: {
          type: "string",
          enum: [
            "tea_kit",
            "tea_tasting_kit",
            "tasting_kit",
            "packaged_mockup",
            "swatch_pack",
            "packaging_swatch",
            "full_pack_sample",
            "printed_proof",
          ],
        },
        project_id: { type: "string" },
        tea_option_id: { type: "string" },
        packaging_variant_id: { type: "string" },
        quantity: { type: "integer", minimum: 1, maximum: 10, default: 1 },
        shipping_address: {
          type: "object",
          required: ["line1", "city", "pincode"],
          properties: {
            line1: { type: "string" },
            city: { type: "string" },
            pincode: { type: "string", description: "6-digit Indian PIN code." },
            state: { type: "string" },
            country: { type: "string", default: "India" },
          },
        },
        coupon_code: { type: "string" },
        client_id: { type: "string" },
        customer_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(orderSampleArgs, args);
      const actor = getMcpAuditActor(args);
      const customerId = parsed.customer_id || parsed.client_id || "client_default";

      const sample = PrivateLabelService.createSampleOrder(
        parsed as unknown as CreateSampleOrderInput,
        customerId,
        actor
      );
      return toPublicSampleOrderDto(sample);
    },
  },

  // 20. private_label_release_job
  {
    name: "private_label_release_job",
    description:
      "Release production order to manufacturing after validating hard gates (proof approved + deposit paid).",
    annotations: {
      title: "Release Production Job",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["order_id"],
      properties: {
        order_id: { type: "string", description: "Production Order UUID." },
        operator_id: { type: "string", description: "Operator or supervisor releasing the job." },
        target_completion_date: { type: "string" },
        operator_notes: { type: "string" },
        override_justification: { type: "string", description: "Required if bypassing unapproved proof or unpaid deposit." },
      },
    },
    run: (args) => {
      const parsed = parse(releaseJobArgs, args);
      const actor = getMcpAuditActor(args);
      assertOrderAccess(parsed.order_id);

      const job = PrivateLabelService.releaseProductionJob(parsed.order_id, parsed, actor);
      return toPublicProductionJobDto(job);
    },
  },

  // 21. private_label_convert_quote_to_order (Companion Tool)
  {
    name: "private_label_convert_quote_to_order",
    description:
      "Convert accepted quote to production order with 50% deposit schedule and idempotency key.",
    annotations: {
      title: "Convert Quote to Order",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["quote_id"],
      properties: {
        quote_id: { type: "string", description: "Quote UUID." },
        idempotency_key: { type: "string" },
        expected_revision: { type: "integer", minimum: 0 },
        deposit_percentage: { type: "number", minimum: 10, maximum: 100, default: 50 },
        shipping_address: { type: "object" },
        billing_address: { type: "object" },
        notes: { type: "string" },
        client_id: { type: "string" },
        customer_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(convertQuoteArgs, args);
      const actor = getMcpAuditActor(args);
      const tenantId = parsed.client_id || parsed.customer_id;
      const quote = assertQuoteAccess(parsed.quote_id, tenantId);

      const result = PrivateLabelService.convertQuoteToOrder(
        parsed.quote_id,
        parsed,
        quote.owner_customer_id || "client_default",
        actor
      );

      return toPublicProductionOrderDto(result.order);
    },
  },

  // 22. private_label_get_order (Companion Tool)
  {
    name: "private_label_get_order",
    description:
      "Inspect production order lifecycle, items, deposit status, and job status with tenant scoping.",
    annotations: {
      title: "Get Order",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Order UUID." },
        client_id: { type: "string" },
        customer_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(getOrderArgs, args);
      const tenantId = parsed.client_id || parsed.customer_id;
      assertOrderAccess(parsed.id, tenantId);

      const orderData = PrivateLabelService.getOrder(parsed.id, parsed.customer_id);
      return {
        ...toPublicProductionOrderDto(orderData.order),
        items: orderData.items,
        job: orderData.job ? toPublicProductionJobDto(orderData.job) : null,
      };
    },
  },

  // 23. private_label_record_qc (Companion Tool)
  {
    name: "private_label_record_qc",
    description:
      "Record 7-stage QC milestone with FSSAI +/-1.5% fill weight tolerance check and automatic halt on critical failure.",
    annotations: {
      title: "Record QC Milestone",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["job_id", "stage", "status"],
      properties: {
        job_id: { type: "string", description: "Production Job UUID." },
        stage: {
          type: "string",
          enum: [
            "raw_material",
            "raw_material_incoming",
            "raw_material_in",
            "packaging_incoming",
            "print_proof",
            "fill_weight",
            "seal_integrity",
            "sensory_cupping",
            "final_pack",
            "packaging_cartoning",
            "final",
          ],
        },
        status: { type: "string", enum: ["pending", "passed", "failed", "waived", "conditionally_passed"] },
        inspector_name: { type: "string" },
        recorded_weight_g: { type: "number" },
        target_weight_g: { type: "number" },
        cupping_score: { type: "number" },
        notes: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(recordQcArgs, args);
      const actor = getMcpAuditActor(args);
      const milestone = PrivateLabelService.recordQCMilestone(
        parsed.job_id,
        parsed as unknown as RecordQCMilestoneInput,
        actor
      );
      return toPublicQCMilestoneDto(milestone);
    },
  },

  // 24. private_label_get_job (Companion Tool)
  {
    name: "private_label_get_job",
    description:
      "Get manufacturing job status, target completion date, and 7 QC milestone register.",
    annotations: {
      title: "Get Production Job",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Production Job UUID." },
      },
    },
    run: (args) => {
      const parsed = parse(getJobArgs, args);
      const job = PrivateLabelService.getProductionJob(parsed.id);
      return {
        ...toPublicProductionJobDto(job),
        milestones: job.milestones.map(toPublicQCMilestoneDto),
      };
    },
  },

  // 25. private_label_get_audit_history (Companion Tool)
  {
    name: "private_label_get_audit_history",
    description:
      "Fetch append-only audit trail records from pl_audit for any private label entity.",
    annotations: {
      title: "Get Audit History",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["entity_type", "entity_id"],
      properties: {
        entity_type: { type: "string", description: "Entity table or domain type (e.g. project, quote, proof)." },
        entity_id: { type: "string", description: "Record UUID." },
      },
    },
    run: (args) => {
      const parsed = parse(getAuditHistoryArgs, args);
      const history = PrivateLabelService.getAuditHistory(parsed.entity_type, parsed.entity_id);
      return {
        history,
        total: history.length,
      };
    },
  },

  // 26. private_label_report_dashboard (Companion Tool)
  {
    name: "private_label_report_dashboard",
    description:
      "Overview dashboard metrics: active projects, quotes pipeline, and manufacturing queue stats.",
    annotations: {
      title: "Report Private Label Dashboard",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {},
    },
    run: () => {
      const stats = PrivateLabelService.getAdminOverviewStats();
      return {
        ...stats,
        active_projects: stats.quoteQueueCount.total + stats.jobQueueCount.active,
        open_quotes:
          stats.quoteQueueCount.pricingPending +
          stats.quoteQueueCount.estimated +
          stats.quoteQueueCount.firmIssued,
        pending_proofs: stats.jobQueueCount.qcPending,
        in_production_jobs: stats.jobQueueCount.active,
      };
    },
  },

  // 27. private_label_validate_publish_gate (Companion Tool)
  {
    name: "private_label_validate_publish_gate",
    description:
      "Check publishing readiness and gate blockers for a packaging variant or tea option.",
    annotations: {
      title: "Validate Publish Gate",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "Entity UUID." },
        variant_id: { type: "string", description: "Entity UUID alias." },
        entity_type: { type: "string", enum: ["packaging", "tea", "print_method", "price_book", "qc"] },
      },
    },
    run: (args) => {
      const parsed = parse(validatePublishGateArgs, args);
      const entityId = parsed.id || parsed.variant_id!;
      const result =
        parsed.entity_type === "tea"
          ? PrivateLabelService.validateTeaPublishGate(entityId)
          : PrivateLabelService.validatePackagingPublishGate(entityId);
      return {
        canPublish: result.canPublish,
        blockers: result.blockers,
      };
    },
  },

  // 28. private_label_check_compatibility (Companion Tool)
  {
    name: "private_label_check_compatibility",
    description: "Validate compatibility between packaging variant and print method.",
    annotations: {
      title: "Check Packaging and Print Compatibility",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["packaging_variant_id", "print_method_id"],
      properties: {
        packaging_variant_id: { type: "string" },
        print_method_id: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(checkCompatibilityArgs, args);
      return PrivateLabelService.checkCompatibility(
        parsed.packaging_variant_id,
        parsed.print_method_id
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Tool Aliases Registry
// ---------------------------------------------------------------------------

export const PRIVATE_LABEL_TOOL_ALIASES: Record<string, string> = {
  // Dot notation aliases
  "private_label.list_catalogue": "private_label_list_catalogue",
  "private_label.list_catalog": "private_label_list_catalogue",
  "private_label.get_packaging": "private_label_get_packaging",
  "private_label.upsert_packaging": "private_label_upsert_packaging",
  "private_label.upload_packaging_image": "private_label_upload_packaging_image",
  "private_label.upload_image": "private_label_upload_packaging_image",
  "admin.private_label_upload_packaging_image": "private_label_upload_packaging_image",
  "private_label.set_moq": "private_label_set_moq",
  "private_label.upsert_price_rule": "private_label_upsert_price_rule",
  "private_label.calculate_moq": "private_label_calculate_moq",
  "private_label.calculate_quote": "private_label_calculate_quote",
  "private_label.create_project": "private_label_create_project",
  "private_label.get_project": "private_label_get_project",
  "private_label.save_project": "private_label_save_project",
  "private_label.update_project": "private_label_save_project",
  "private_label.archive_project": "private_label_archive_project",
  "private_label.create_quote": "private_label_create_quote",
  "private_label.get_quote": "private_label_get_quote",
  "private_label.accept_quote": "private_label_accept_quote",
  "private_label.validate_preflight": "private_label_validate_preflight",
  "private_label.generate_preview": "private_label_generate_preview",
  "private_label.approve_proof": "private_label_approve_proof",
  "private_label.reject_proof": "private_label_reject_proof",
  "private_label.order_sample": "private_label_order_sample",
  "private_label.release_job": "private_label_release_job",
  "private_label.convert_quote_to_order": "private_label_convert_quote_to_order",
  "private_label.get_order": "private_label_get_order",
  "private_label.record_qc": "private_label_record_qc",
  "private_label.get_job": "private_label_get_job",
  "private_label.get_audit_history": "private_label_get_audit_history",
  "private_label.report_dashboard": "private_label_report_dashboard",
  "private_label.validate_publish_gate": "private_label_validate_publish_gate",
  "private_label.check_compatibility": "private_label_check_compatibility",

  // pl_* ergonomic prefixes
  pl_list_packaging_catalog: "private_label_list_catalogue",
  pl_list_tea_catalog: "private_label_list_catalogue",
  pl_get_packaging_detail: "private_label_get_packaging",
  pl_admin_upsert_packaging: "private_label_upsert_packaging",
  pl_upload_packaging_image: "private_label_upload_packaging_image",
  pl_upload_image: "private_label_upload_packaging_image",
  upload_packaging_image: "private_label_upload_packaging_image",
  pl_set_moq: "private_label_set_moq",
  pl_admin_upsert_price_book: "private_label_upsert_price_rule",
  pl_calculate_moq: "private_label_calculate_moq",
  pl_calculate_quote_estimate: "private_label_calculate_quote",
  pl_create_project_draft: "private_label_create_project",
  pl_get_project: "private_label_get_project",
  pl_update_project_draft: "private_label_save_project",
  pl_archive_project: "private_label_archive_project",
  pl_create_quote: "private_label_create_quote",
  pl_get_quote: "private_label_get_quote",
  pl_accept_quote: "private_label_accept_quote",
  pl_validate_preflight: "private_label_validate_preflight",
  pl_update_design_layer: "private_label_generate_preview",
  pl_approve_proof: "private_label_approve_proof",
  pl_reject_proof: "private_label_reject_proof",
  pl_create_sample_order: "private_label_order_sample",
  pl_admin_release_job: "private_label_release_job",
  pl_create_order: "private_label_convert_quote_to_order",
  pl_get_order: "private_label_get_order",
  pl_admin_inspect_qc: "private_label_record_qc",
  pl_get_job: "private_label_get_job",
  pl_get_audit_history: "private_label_get_audit_history",
  pl_report_dashboard: "private_label_report_dashboard",
  pl_validate_publish_gate: "private_label_validate_publish_gate",
  pl_check_compatibility: "private_label_check_compatibility",

  // Alternate names referenced in tests and specs
  private_label_list_catalog: "private_label_list_catalogue",
  private_label_list_tea_catalog: "private_label_list_catalogue",
  private_label_get_packaging_detail: "private_label_get_packaging",
  private_label_validate: "private_label_calculate_moq",
  private_label_get_estimate: "private_label_calculate_quote",
  private_label_calculate_estimate: "private_label_calculate_quote",
  private_label_update_project: "private_label_save_project",
  private_label_create_design_version: "private_label_generate_preview",
  private_label_save_design: "private_label_generate_preview",
  private_label_create_sample_order: "private_label_order_sample",
  private_label_create_order: "private_label_convert_quote_to_order",
  private_label_record_qc_milestone: "private_label_record_qc",
  private_label_update_qc_milestone: "private_label_record_qc",
  private_label_upsert_price_book: "private_label_upsert_price_rule",
};
