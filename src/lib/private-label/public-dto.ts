/**
 * TeaFloww Private Label Studio — Whitelisted Public DTO Projections
 * Milestone M1: Shared Architecture and Data Models
 *
 * Strips confidential supplier identities, COGS rates, margins, and private operator notes.
 */

import type {
  PackagingVariant,
  PackagingVariantWithDetails,
  TeaOption,
  PrintMethod,
  Quote,
  QuoteWithItems,
  QuoteItem,
  Project,
  PublicQuoteWithItemsDto,
  PublicQuoteItemDto,
  DesignVersion,
  ApprovalEvent,
  SampleOrder,
  SampleItem,
  ProductionOrder,
  OrderItem,
  ProductionJob,
  QCMilestone,
} from "./types";
import type { StartingPriceIndicator } from "./schemas";

export type { PublicQuoteWithItemsDto, PublicQuoteItemDto } from "./types";


export interface PublicPackagingVariantDto {
  id: string;
  family_id: string;
  name: string;
  slug: string;
  sku: string;
  title: string;
  category: string;
  family: string;
  capacity_description: string;
  net_capacity_grams: number;
  net_weight_capacity_grams: number;
  dimensions_mm: {
    width: number;
    height: number;
    depth: number | null;
  };
  label_safe_area_mm: {
    width: number;
    height: number;
  };
  material: string;
  finish: string;
  closure_type: string;
  barrier_properties: string[];
  moq_units: number;
  order_multiple: number;
  lead_time_days: number;
  image_url: string | null;
  hero_image_url: string | null;
  image_illustrative: boolean;
  dieline_url: string | null;
  dieline_available: boolean;
  supported_print_methods: string[];
  compatible_print_method_codes: string[];
  compatible_print_methods?: unknown[];
  status: "published";
  starting_price?: StartingPriceIndicator | null;
}

export interface PublicTeaOptionDto {
  id: string;
  slug: string;
  name: string;
  origin_estate: string;
  region: string;
  grade: string;
  flush: string;
  tea_category: string;
  description: string;
  caffeine_level: string;
  min_batch_kg: number;
  tasting_notes: string[];
  sample_available: boolean;
}

export interface PublicPrintMethodDto {
  id: string;
  code: string;
  name: string;
  description: string;
  color_model: string;
  max_colors: number;
  setup_fee_paise: number;
  cylinder_fee_per_color_paise: number;
  min_order_units: number;
  lead_time_days: number;
}

export interface PublicQuoteDto {
  id: string;
  quote_number: string;
  status: string;
  version: number;
  currency: string;
  tea_subtotal_paise: number;
  packaging_subtotal_paise: number;
  printing_subtotal_paise: number;
  tooling_setup_paise: number;
  labor_subtotal_paise: number;
  qc_subtotal_paise: number;
  freight_paise: number;
  tax_paise: number;
  grand_total_paise: number;
  issued_at: string | null;
  valid_until: string | null;
  accepted_at: string | null;
  pdf_summary_url: string | null;
}

export interface PublicProjectDto {
  id: string;
  title: string;
  status: string;
  target_market: string;
  draft_configuration: Record<string, unknown>;
  revision: number;
  created_at: string;
  updated_at: string;
}

// ----------------------------------------------------------------------------
// Whitelist Projection Functions
// ----------------------------------------------------------------------------

/**
 * Synthesizes truthful, technical moisture & aroma barrier specifications
 * based on structural packaging substrate and finish.
 */
export function deriveBarrierProperties(
  material: string,
  finish: string,
  familyCode?: string
): string[] {
  const normalized = `${material} ${finish}`.toLowerCase();
  const traits: string[] = [];

  if (normalized.includes("foil") || normalized.includes("aluminum") || normalized.includes("evoh")) {
    traits.push("High-barrier aluminum/EVOH moisture and oxygen seal");
    traits.push("100% UV/light degradation protection");
  } else if (normalized.includes("kraft")) {
    traits.push("Multi-layer aroma barrier lining");
    traits.push("Heat-sealable moisture barrier inner layer");
  } else if (familyCode === "tin") {
    traits.push("Food-grade airtight tinplate construction");
    traits.push("Total light block and volatile terpene retention");
  } else if (familyCode === "jar") {
    traits.push("Hermetic silicone gasket airtight seal");
    traits.push("Impermeable glass barrier");
  } else {
    traits.push("Food-grade protective contact barrier");
    traits.push("Moisture-resistant enclosure");
  }

  return traits;
}

export function toPublicPackagingVariantDto(
  variant: PackagingVariant | PackagingVariantWithDetails
): PublicPackagingVariantDto {
  const family =
    variant.family_code ||
    (variant as unknown as { family?: { code?: string } }).family?.code ||
    variant.family_id;
  const barrierProps = deriveBarrierProperties(variant.material, variant.finish, family);
  const supportedMethods =
    (variant as PackagingVariantWithDetails).compatible_print_methods?.map((m) => m.code) ||
    [];
  const conceptFamily = ["pouch", "tin", "jar", "carton"].includes(family) ? family : null;
  const imageUrl = variant.hero_image_url || (conceptFamily ? `/images/private-label/${conceptFamily}-concept.webp` : "/images/private-label/atelier-concept.webp");

  return {
    id: variant.id,
    family_id: variant.family_id,
    name: variant.title,
    slug: variant.slug,
    sku: variant.sku,
    title: variant.title,
    category: family,
    family: family,
    capacity_description: variant.capacity_description,
    net_capacity_grams: variant.net_weight_capacity_grams,
    net_weight_capacity_grams: variant.net_weight_capacity_grams,
    dimensions_mm: {
      width: variant.width_mm,
      height: variant.height_mm,
      depth: variant.depth_mm,
    },
    label_safe_area_mm: {
      width: variant.label_safe_width_mm,
      height: variant.label_safe_height_mm,
    },
    material: variant.material,
    finish: variant.finish,
    closure_type: variant.closure_type,
    barrier_properties: barrierProps,
    moq_units: variant.moq_units,
    order_multiple: variant.order_multiple,
    lead_time_days: variant.lead_time_days,
    image_url: imageUrl,
    hero_image_url: imageUrl,
    image_illustrative: !variant.hero_image_url || Boolean(variant.image_illustrative),
    dieline_url: variant.dieline_url || null,
    dieline_available: Boolean(variant.dieline_url),
    supported_print_methods: supportedMethods,
    compatible_print_method_codes: supportedMethods,
    compatible_print_methods: (variant as PackagingVariantWithDetails).compatible_print_methods || [],
    status: "published",
  };
  // STRICTLY REDACTED:
  // supplier_name, supplier_sku, unit_cost_paise, supplier_cost_paise,
  // cogs_paise, margin_rate, margin_pct, internal_cogs, notes, revision, created_at, updated_at
}

export const toPublicPackagingDto = toPublicPackagingVariantDto;

export function toPublicTeaOptionDto(tea: TeaOption): PublicTeaOptionDto {
  let tastingNotes: string[] = [];
  try {
    tastingNotes =
      typeof tea.tasting_notes_json === "string"
        ? JSON.parse(tea.tasting_notes_json)
        : tea.tasting_notes_json;
  } catch {
    tastingNotes = [];
  }

  return {
    id: tea.id,
    slug: tea.slug,
    name: tea.name,
    origin_estate: tea.origin_estate,
    region: tea.region,
    grade: tea.grade,
    flush: tea.flush,
    tea_category: tea.tea_category,
    description: tea.description,
    caffeine_level: tea.caffeine_level,
    min_batch_kg: tea.min_batch_kg,
    tasting_notes: Array.isArray(tastingNotes) ? tastingNotes : [],
    sample_available: Boolean(tea.sample_available),
  };
  // REDACTED: base_cost_per_kg_paise, regular_product_id, revision, created_at, updated_at
}

export function toPublicPrintMethodDto(method: PrintMethod): PublicPrintMethodDto {
  return {
    id: method.id,
    code: method.code,
    name: method.name,
    description: method.description,
    color_model: method.color_model,
    max_colors: method.max_colors,
    setup_fee_paise: method.setup_fee_paise,
    cylinder_fee_per_color_paise: method.cylinder_fee_per_color_paise,
    min_order_units: method.min_order_units,
    lead_time_days: method.lead_time_days,
  };
  // REDACTED: internal cost calculations, supplier margins
}

export function toPublicQuoteDto(quote: Quote): PublicQuoteDto {
  return {
    id: quote.id,
    quote_number: quote.quote_number,
    status: quote.status,
    version: quote.version,
    currency: quote.currency,
    tea_subtotal_paise: quote.tea_subtotal_paise,
    packaging_subtotal_paise: quote.packaging_subtotal_paise,
    printing_subtotal_paise: quote.printing_subtotal_paise,
    tooling_setup_paise: quote.tooling_setup_paise,
    labor_subtotal_paise: quote.labor_subtotal_paise,
    qc_subtotal_paise: quote.qc_subtotal_paise,
    freight_paise: quote.freight_paise,
    tax_paise: quote.tax_paise,
    grand_total_paise: quote.grand_total_paise,
    issued_at: quote.issued_at,
    valid_until: quote.valid_until,
    accepted_at: quote.accepted_at,
    pdf_summary_url: quote.pdf_summary_url,
  };
  // REDACTED: margin_paise, price_breakdown_json (internal COGS), price_book_id
}

export function toPublicProjectDto(project: Project): PublicProjectDto {
  let draftConfig: Record<string, unknown> = {};
  try {
    draftConfig =
      typeof project.draft_configuration_json === "string"
        ? JSON.parse(project.draft_configuration_json)
        : (project.draft_configuration_json as unknown as Record<string, unknown>);
  } catch {
    draftConfig = {};
  }

  return {
    id: project.id,
    title: project.title,
    status: project.status,
    target_market: project.target_market,
    draft_configuration: draftConfig,
    revision: project.revision,
    created_at: project.created_at,
    updated_at: project.updated_at,
  };
  // REDACTED: client_id, owner_customer_id, internal notes
}

export function toPublicQuoteItemDto(item: QuoteItem): PublicQuoteItemDto {
  return {
    id: item.id,
    project_item_id: item.project_item_id,
    description: item.description,
    quantity: item.quantity,
    unit_price_paise: item.unit_price_paise,
    line_total_paise: item.line_total_paise,
  };
  // REDACTED: cost_breakdown_json (confidential COGS, supplier piece-rates)
}

export function toPublicQuoteWithItemsDto(
  quote: QuoteWithItems
): PublicQuoteWithItemsDto {
  const baseDto = toPublicQuoteDto(quote);
  const items = Array.isArray(quote.items) ? quote.items.map(toPublicQuoteItemDto) : [];

  let sanitizedPriceBreakdown: PublicQuoteWithItemsDto["price_breakdown"] = undefined;
  if (quote.price_breakdown_json) {
    try {
      const raw =
        typeof quote.price_breakdown_json === "string"
          ? JSON.parse(quote.price_breakdown_json)
          : quote.price_breakdown_json;

      if (raw && typeof raw === "object") {
        sanitizedPriceBreakdown = {
          taxDetails: raw.taxDetails
            ? {
                teaGstPaise: Number(raw.taxDetails.teaGstPaise ?? 0),
                nonTeaGstPaise: Number(raw.taxDetails.nonTeaGstPaise ?? 0),
              }
            : undefined,
          metrics: raw.metrics
            ? {
                netTeaKg: Number(raw.metrics.netTeaKg ?? 0),
                grossTeaKg: Number(raw.metrics.grossTeaKg ?? 0),
                cartonCount: Number(raw.metrics.cartonCount ?? 0),
                palletCount: Number(raw.metrics.palletCount ?? 0),
                totalWeightKg: Number(raw.metrics.totalWeightKg ?? 0),
                batchCount: Number(raw.metrics.batchCount ?? 0),
              }
            : undefined,
        };
      }
    } catch {
      sanitizedPriceBreakdown = undefined;
    }
  }

  return {
    ...baseDto,
    revision: quote.revision ?? 1,
    items,
    price_breakdown: sanitizedPriceBreakdown,
  };
  // STRICTLY REDACTED:
  // margin_paise, supplier piece-rates, price_book_id, raw cost_breakdown_json
}

export interface PublicDesignVersionDto {
  id: string;
  project_id?: string;
  project_item_id: string;
  version_number: number;
  status: string;
  scene_json: Record<string, unknown>;
  asset_url: string | null;
  preview_render_url: string | null;
  print_ready_pdf_url: string | null;
  is_locked: boolean;
  preflight_report?: Record<string, unknown>;
  revision: number;
  created_at: string;
}

export interface PublicApprovalEventDto {
  id: string;
  design_version_id: string;
  action: string;
  signer_name: string | null;
  legal_disclaimer_accepted: boolean;
  disclaimer_text: string | null;
  notes: string | null;
  created_at: string;
}

export function toPublicDesignVersionDto(dv: DesignVersion): PublicDesignVersionDto {
  let parsedScene: Record<string, unknown> = {};
  try {
    parsedScene =
      typeof dv.scene_json === "string" ? JSON.parse(dv.scene_json) : (dv.scene_json || {});
  } catch {
    parsedScene = {};
  }

  let parsedPreflight: Record<string, unknown> | undefined = undefined;
  if (dv.preflight_report_json) {
    try {
      parsedPreflight =
        typeof dv.preflight_report_json === "string"
          ? JSON.parse(dv.preflight_report_json)
          : dv.preflight_report_json;
    } catch {
      parsedPreflight = undefined;
    }
  }

  return {
    id: dv.id,
    project_id: dv.project_id,
    project_item_id: dv.project_item_id,
    version_number: dv.version_number,
    status: dv.status || (dv.is_locked ? "customer_approved" : "preflight_pending"),
    scene_json: parsedScene,
    asset_url: dv.asset_url || dv.preview_render_url || null,
    preview_render_url: dv.preview_render_url || null,
    print_ready_pdf_url: dv.print_ready_pdf_url || null,
    is_locked: dv.is_locked === 1,
    preflight_report: parsedPreflight,
    revision: dv.revision ?? dv.version_number,
    created_at: dv.created_at,
  };
}

export function toPublicApprovalEventDto(appr: ApprovalEvent): PublicApprovalEventDto {
  return {
    id: appr.id,
    design_version_id: appr.design_version_id,
    action: appr.action,
    signer_name: appr.signer_name || appr.actor_name || null,
    legal_disclaimer_accepted: appr.legal_disclaimer_accepted === 1,
    disclaimer_text: appr.disclaimer_text || null,
    notes: appr.notes || null,
    created_at: appr.created_at,
  };
  // REDACTED: ip_address, user_agent, client_id, actor_id
}

// ============================================================================
// Milestone M6: Samples, Orders & Production Lifecycle Projections
// ============================================================================

export interface PublicSampleItemDto {
  id: string;
  item_type: string;
  tea_option_id: string | null;
  packaging_variant_id: string | null;
  description: string;
  quantity: number;
  notes: string | null;
}

export interface PublicSampleOrderDto {
  id: string;
  sample_number: string;
  project_id: string | null;
  sample_type: string;
  status: string;
  tea_option_id: string | null;
  packaging_variant_id: string | null;
  shipping_address: Record<string, unknown>;
  tracking_number: string | null;
  carrier: string | null;
  feedback_notes: string | null;
  amount_paise: number;
  quantity: number;
  coupon_code: string | null;
  items: PublicSampleItemDto[];
  created_at: string;
  updated_at: string;
}

export function toPublicSampleOrderDto(
  sample: SampleOrder,
  items: SampleItem[] = []
): PublicSampleOrderDto {
  let parsedAddress: Record<string, unknown> = {};
  try {
    parsedAddress =
      typeof sample.shipping_address_json === "string"
        ? JSON.parse(sample.shipping_address_json)
        : ((sample.shipping_address_json as unknown as Record<string, unknown>) || {});
  } catch {
    parsedAddress = {};
  }

  return {
    id: sample.id,
    sample_number: sample.sample_number,
    project_id: sample.project_id,
    sample_type: sample.sample_type,
    status: sample.status,
    tea_option_id: sample.tea_option_id,
    packaging_variant_id: sample.packaging_variant_id,
    shipping_address: parsedAddress,
    tracking_number: sample.tracking_number ?? null,
    carrier: sample.carrier ?? null,
    feedback_notes: sample.feedback_notes,
    amount_paise: sample.amount_paise,
    quantity: sample.quantity ?? 1,
    coupon_code: sample.coupon_code,
    items: items.map((i) => ({
      id: i.id,
      item_type: i.item_type,
      tea_option_id: i.tea_option_id,
      packaging_variant_id: i.packaging_variant_id,
      description: i.description,
      quantity: i.quantity,
      notes: i.notes,
    })),
    created_at: sample.created_at,
    updated_at: sample.updated_at,
  };
  // REDACTED: client_id, payment_reference, internal tea/pack supplier IDs
}

export interface PublicOrderItemDto {
  id: string;
  quote_item_id: string | null;
  description: string;
  quantity: number;
  unit_price_paise: number;
  line_total_paise: number;
}

export interface PublicQCMilestoneDto {
  id: string;
  job_id: string;
  milestone_name: string;
  stage: string;
  status: string;
  inspector_name: string | null;
  inspection_date: string | null;
  evidence_notes: string | null;
  evidence_photo_url: string | null;
  cupping_score: number | null;
  recorded_weight_g: number | null;
  target_weight_g: number | null;
  notes: string | null;
  created_at: string;
}

export function toPublicQCMilestoneDto(qc: QCMilestone): PublicQCMilestoneDto {
  return {
    id: qc.id,
    job_id: qc.job_id,
    milestone_name: qc.milestone_name,
    stage: qc.stage,
    status: qc.status,
    inspector_name: qc.inspector_name,
    inspection_date: qc.inspection_date,
    evidence_notes: qc.evidence_notes,
    evidence_photo_url: qc.evidence_photo_url,
    cupping_score: qc.cupping_score,
    recorded_weight_g: qc.recorded_weight_g,
    target_weight_g: qc.target_weight_g,
    notes: qc.notes,
    created_at: qc.created_at,
  };
}

export interface PublicProductionJobDto {
  id: string;
  job_number: string;
  order_id: string;
  status: string;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  operator_notes: string | null;
  milestones: PublicQCMilestoneDto[];
  created_at: string;
  updated_at: string;
}

export function toPublicProductionJobDto(
  job: ProductionJob,
  milestones: QCMilestone[] = []
): PublicProductionJobDto {
  return {
    id: job.id,
    job_number: job.job_number,
    order_id: job.order_id,
    status: job.status,
    target_completion_date: job.target_completion_date,
    actual_completion_date: job.actual_completion_date,
    operator_notes: job.operator_notes,
    milestones: milestones.map(toPublicQCMilestoneDto),
    created_at: job.created_at,
    updated_at: job.updated_at,
  };
  // REDACTED: released_by (internal user ID), override_justification, internal factory routings
}

export interface PublicProductionOrderDto {
  id: string;
  order_number: string;
  quote_id: string;
  project_id: string | null;
  status: string;
  currency: string;
  total_paise: number;
  deposit_paise: number;
  balance_paise: number;
  deposit_paid_at: string | null;
  full_paid_at: string | null;
  shipping_address: Record<string, unknown>;
  items: PublicOrderItemDto[];
  job: PublicProductionJobDto | null;
  approved_proof?: Record<string, unknown> | null;
  tracking_number: string | null;
  carrier: string | null;
  notes: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export function toPublicProductionOrderDto(
  order: ProductionOrder,
  items: OrderItem[] = [],
  job: ProductionJob | null = null,
  milestones: QCMilestone[] = [],
  approvedProof: Record<string, unknown> | null = null,
  tracking?: { carrier?: string | null; tracking_number?: string | null }
): PublicProductionOrderDto {
  let parsedAddress: Record<string, unknown> = {};
  try {
    parsedAddress =
      typeof order.shipping_address_json === "string"
        ? JSON.parse(order.shipping_address_json)
        : ((order.shipping_address_json as unknown as Record<string, unknown>) || {});
  } catch {
    parsedAddress = {};
  }

  const publicItems: PublicOrderItemDto[] = items.map((i) => ({
    id: i.id,
    quote_item_id: i.quote_item_id,
    description: i.description,
    quantity: i.quantity,
    unit_price_paise: i.unit_price_paise,
    line_total_paise: i.line_total_paise,
  }));

  return {
    id: order.id,
    order_number: order.order_number,
    quote_id: order.quote_id,
    project_id: order.project_id,
    status: order.status,
    currency: order.currency || "INR",
    total_paise: order.total_paise || (order.deposit_paise + order.balance_paise),
    deposit_paise: order.deposit_paise,
    balance_paise: order.balance_paise,
    deposit_paid_at: order.deposit_paid_at,
    full_paid_at: order.full_paid_at,
    shipping_address: parsedAddress,
    items: publicItems,
    job: job ? toPublicProductionJobDto(job, milestones) : null,
    approved_proof: approvedProof,
    tracking_number: tracking?.tracking_number || null,
    carrier: tracking?.carrier || null,
    notes: order.notes,
    revision: order.revision,
    created_at: order.created_at,
    updated_at: order.updated_at,
  };
  // REDACTED: client_id, supplier_vendor_id, cogs_breakdown, cost_breakdown_json, margin_paise, deposit_payment_id, final_payment_id
}


