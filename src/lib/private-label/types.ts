/**
 * TeaFloww Private Label Studio — Domain Models, Error Classes & Types
 * Milestone M1: Shared Architecture and Data Models
 */

// ============================================================================
// Domain Errors & Exception Hierarchy
// ============================================================================

/**
 * Thrown on revision mismatch in atomic Compare-and-Swap (CAS) mutations.
 * HTTP Status: 409 Conflict | MCP JSON-RPC Code: -32009
 */
export class PrivateLabelRevisionConflictError extends Error {
  readonly code = "REVISION_CONFLICT" as const;
  readonly status = 409 as const;
  readonly mcpCode = -32009 as const;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly current_revision: number;
  readonly expected_revision: number;

  constructor(
    entity_type: string,
    entity_id: string,
    current_revision: number,
    expected_revision: number,
    message?: string
  ) {
    super(
      message ||
        `Revision conflict on ${entity_type} '${entity_id}': record was modified concurrently (current revision: ${current_revision}, expected: ${expected_revision})`
    );
    this.name = "PrivateLabelRevisionConflictError";
    this.entity_type = entity_type;
    this.entity_id = entity_id;
    this.current_revision = current_revision;
    this.expected_revision = expected_revision;
    Object.setPrototypeOf(this, PrivateLabelRevisionConflictError.prototype);
  }
}

/**
 * Thrown when an entity is not found by ID or slug, or when tenant isolation hides an unowned record.
 * HTTP Status: 404 Not Found | MCP JSON-RPC Code: -32004
 */
export class PrivateLabelNotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  readonly status = 404 as const;
  readonly mcpCode = -32004 as const;
  readonly entity_type: string;
  readonly identifier: string;

  constructor(entity_type: string, identifier: string, message?: string) {
    super(message || `${entity_type} not found: ${identifier}`);
    this.name = "PrivateLabelNotFoundError";
    this.entity_type = entity_type;
    this.identifier = identifier;
    Object.setPrototypeOf(this, PrivateLabelNotFoundError.prototype);
  }
}

/**
 * Thrown when a business gate (publishing gate, proof approval gate, production release gate) fails.
 * HTTP Status: 422 Unprocessable Content | MCP JSON-RPC Code: -32009
 */
export class PrivateLabelGateError extends Error {
  readonly code = "GATE_FAILED" as const;
  readonly status = 422 as const;
  readonly mcpCode = -32009 as const;
  readonly gate_name: string;
  readonly blockers: string[];

  constructor(gate_name: string, blockers: string[], message?: string) {
    super(
      message ||
        `Gate '${gate_name}' failed with ${blockers.length} blocker(s): ${blockers.join("; ")}`
    );
    this.name = "PrivateLabelGateError";
    this.gate_name = gate_name;
    this.blockers = blockers;
    Object.setPrototypeOf(this, PrivateLabelGateError.prototype);
  }
}

/**
 * Thrown when an invalid lifecycle state transition is attempted.
 * HTTP Status: 409 Conflict | MCP JSON-RPC Code: -32009
 */
export class PrivateLabelStateTransitionError extends Error {
  readonly code = "INVALID_STATE_TRANSITION" as const;
  readonly status = 409 as const;
  readonly mcpCode = -32009 as const;
  readonly entity_type: string;
  readonly from_status: string;
  readonly to_status: string;

  constructor(entity_type: string, from_status: string, to_status: string, message?: string) {
    super(
      message ||
        `Invalid ${entity_type} lifecycle transition from '${from_status}' to '${to_status}'`
    );
    this.name = "PrivateLabelStateTransitionError";
    this.entity_type = entity_type;
    this.from_status = from_status;
    this.to_status = to_status;
    Object.setPrototypeOf(this, PrivateLabelStateTransitionError.prototype);
  }
}

// ============================================================================
// Audit Models & Actor Context
// ============================================================================

export type AuditActorType = "admin" | "mcp" | "system" | "customer";

export interface AuditActor {
  actor_type: AuditActorType;
  actor_id: string;
  actor_email?: string | null;
  reason?: string | null;
  ip_address?: string | null;
}

export interface AuditRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  revision: number;
  action: string;
  actor_type: AuditActorType;
  actor_id: string;
  actor_email: string | null;
  diff_json: string;
  reason: string | null;
  ip_address: string | null;
  created_at: string;
}

// ============================================================================
// Core Catalog Domain Models
// ============================================================================

export interface Client {
  id: string;
  customer_id: string | null;
  company_name: string;
  gstin: string | null;
  fssai_license: string | null;
  billing_address: string | null;
  shipping_address: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string | null;
  is_verified: number;
  created_at: string;
  updated_at: string;
}

export interface Brand {
  id: string;
  client_id: string;
  name: string;
  tagline: string | null;
  brand_colors_json: string;
  trademark_attestation: number;
  created_at: string;
  updated_at: string;
}

export type TeaCategory = "black" | "green" | "white" | "oolong" | "chai_blend" | "herbal";
export type CaffeineLevel = "none" | "low" | "medium" | "high";

export interface TeaOption {
  id: string;
  slug: string;
  name: string;
  origin_estate: string;
  region: string;
  grade: string;
  flush: string;
  tea_category: TeaCategory;
  description: string;
  caffeine_level: CaffeineLevel;
  base_cost_per_kg_paise: number;
  min_batch_kg: number;
  tasting_notes_json: string;
  regular_product_id: number | null;
  is_published: number;
  sample_available: number;
  revision: number;
  created_at: string;
  updated_at: string;
}

export type PackagingFamilyCode = "pouch" | "tin" | "jar" | "carton" | "sachet" | "bag";

export interface PackagingFamily {
  id: string;
  code: PackagingFamilyCode;
  name: string;
  description: string;
  sort_order: number;
  is_active: number;
  created_at: string;
}

export type PackagingVariantStatus = "draft" | "published" | "archived";

export interface PackagingVariant {
  id: string;
  family_id: string;
  family_code?: PackagingFamilyCode;
  slug: string;
  sku: string;
  title: string;
  material: string;
  finish: string;
  closure_type: string;
  capacity_description: string;
  net_weight_capacity_grams: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number | null;
  label_safe_width_mm: number;
  label_safe_height_mm: number;
  supplier_name: string;
  supplier_sku: string | null;
  unit_cost_paise: number;
  lead_time_days: number;
  moq_units: number;
  order_multiple: number;
  dieline_url: string | null;
  hero_image_url: string | null;
  image_illustrative: number;
  packs_per_carton?: number;
  closure_rate_paise?: number;
  tare_weight_grams?: number;
  status: PackagingVariantStatus;
  revision: number;
  created_at: string;
  updated_at: string;
}

export type PrintMethodCode =
  | "paper_label"
  | "bopp_label"
  | "direct_digital"
  | "gravure"
  | "screen_print"
  | "sleeve";

export interface PrintMethod {
  id: string;
  code: PrintMethodCode;
  name: string;
  description: string;
  color_model: "cmyk" | "pantone" | "spot";
  max_colors: number;
  setup_fee_paise: number;
  cylinder_fee_per_color_paise: number;
  min_order_units: number;
  lead_time_days: number;
  unit_cost_paise?: number;
  is_active?: number;
  created_at: string;
  updated_at?: string;
}

export interface PackagingCompatibility {
  id: string;
  packaging_variant_id: string;
  print_method_id: string;
  is_supported: number;
  notes: string | null;
  created_at: string;
}

export interface PackagingVariantWithDetails extends PackagingVariant {
  family?: PackagingFamily;
  compatible_print_methods: PrintMethod[];
}

// ============================================================================
// Pricing & MOQ Domain Models
// ============================================================================

export interface MoqRule {
  id: string;
  rule_type: "tea" | "packaging" | "print" | "global";
  target_id: string | null;
  min_quantity: number;
  unit_basis: "kg" | "units" | "orders";
  order_multiple: number;
  min_order_value_paise: number;
  effective_from: string;
  effective_to: string | null;
  created_at: string;
}

export interface PriceBook {
  id: string;
  name: string;
  currency: "INR" | "USD" | "EUR" | "GBP";
  is_default: number;
  effective_from: string;
  effective_to: string | null;
  margin_rate: number;
  filling_labor_paise_per_unit: number;
  qc_charge_paise_per_batch: number;
  contingency_rate: number;
  loss_allowance_rate: number;
  status: "draft" | "active" | "archived";
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface PriceBookTier {
  id: string;
  price_book_id: string;
  item_type: "packaging" | "print_method" | "tea_markup";
  item_id: string;
  min_qty: number;
  max_qty: number | null;
  unit_price_paise: number;
  created_at: string;
}

// ============================================================================
// Project & Quotation Models
// ============================================================================

export type ProjectStatus =
  | "draft"
  | "configured"
  | "in_review"
  | "quoted"
  | "accepted"
  | "archived"
  | "cancelled";

export interface Project {
  id: string;
  client_id: string | null;
  owner_customer_id: string | null;
  brand_id: string | null;
  title: string;
  status: ProjectStatus;
  target_market: string;
  notes: string | null;
  draft_configuration_json: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface ProjectItem {
  id: string;
  project_id: string;
  tea_option_id: string | null;
  packaging_variant_id: string | null;
  print_method_id: string | null;
  fill_weight_grams: number;
  quantity_units: number;
  color_count: number;
  design_version_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectWithItems extends Project {
  items: ProjectItem[];
}

export type QuoteStatus =
  | "draft"
  | "pricing_pending"
  | "estimated"
  | "firm_issued"
  | "customer_accepted"
  | "expired"
  | "superseded"
  | "converted";

export interface Quote {
  id: string;
  quote_number: string;
  project_id: string;
  price_book_id: string;
  status: QuoteStatus;
  version: number;
  currency: string;
  tea_subtotal_paise: number;
  packaging_subtotal_paise: number;
  printing_subtotal_paise: number;
  tooling_setup_paise: number;
  labor_subtotal_paise: number;
  qc_subtotal_paise: number;
  freight_paise: number;
  margin_paise: number;
  tax_paise: number;
  grand_total_paise: number;
  price_breakdown_json: string;
  issued_at: string | null;
  valid_until: string | null;
  accepted_at: string | null;
  pdf_summary_url: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  project_item_id: string;
  description: string;
  quantity: number;
  unit_price_paise: number;
  line_total_paise: number;
  cost_breakdown_json: string;
  created_at: string;
}

export interface QuoteWithItems extends Quote {
  items: QuoteItem[];
}

// ============================================================================
// Artwork & Approval Models
// ============================================================================

export type PreflightStatus = "pending" | "passed" | "warning" | "rejected";

export interface ArtworkAsset {
  id: string;
  client_id: string;
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  storage_key: string;
  file_sha256: string;
  width_px: number | null;
  height_px: number | null;
  dpi: number | null;
  color_space: string | null;
  rights_attestation: number;
  preflight_status: PreflightStatus;
  preflight_report_json: string;
  created_at: string;
}

export type DesignVersionStatus =
  | "preflight_pending"
  | "preflight_passed"
  | "preflight_failed"
  | "customer_approved"
  | "production_locked";

export interface DesignVersion {
  id: string;
  project_id?: string;
  project_item_id: string;
  version_number: number;
  status?: DesignVersionStatus;
  scene_json: string;
  front_artwork_asset_id: string | null;
  back_artwork_asset_id: string | null;
  asset_url?: string | null;
  preview_render_url: string | null;
  print_ready_pdf_url: string | null;
  preflight_report_json?: string;
  is_locked: number;
  revision?: number;
  created_at: string;
}

export interface PreflightReport {
  id: string;
  artwork_asset_id: string;
  status: PreflightStatus;
  dpi: number | null;
  width_px: number | null;
  height_px: number | null;
  color_space: string | null;
  has_transparency: number;
  is_vector: number;
  prohibited_scripts_detected: number;
  warnings_json: string;
  errors_json: string;
  report_summary: string;
  created_at: string;
}

export interface ApprovalEvent {
  id: string;
  design_version_id: string;
  client_id: string;
  actor_type: "customer" | "admin" | "mcp";
  actor_id: string;
  actor_name: string;
  signer_name?: string | null;
  action: string;
  legal_disclaimer_accepted: number;
  disclaimer_text?: string | null;
  ip_address: string | null;
  user_agent: string | null;
  notes: string | null;
  created_at: string;
}

// ============================================================================
// Samples, Orders & Production Job Models
// ============================================================================

export type SampleStatus =
  | "requested"
  | "payment_pending"
  | "processing"
  | "dispatched"
  | "delivered"
  | "rejected"
  | "completed"
  | "cancelled";

export interface SampleOrder {
  id: string;
  sample_number: string;
  client_id: string;
  project_id: string | null;
  sample_type: "tea_kit" | "printed_proof" | "packaged_mockup" | "full_pack_sample";
  status: SampleStatus;
  tea_option_id: string | null;
  packaging_variant_id: string | null;
  shipping_address_json: string;
  tracking_number: string | null;
  carrier: string | null;
  feedback_notes: string | null;
  amount_paise: number;
  payment_reference: string | null;
  quantity: number;
  coupon_code: string | null;
  revision: number;
  tea_recipe_ids_json: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SampleItem {
  id: string;
  sample_id: string;
  item_type: "tea" | "packaging" | "printed_swatch" | "custom";
  tea_option_id: string | null;
  packaging_variant_id: string | null;
  description: string;
  quantity: number;
  notes: string | null;
  created_at: string;
}

export type OrderStatus =
  | "pending_deposit"
  | "deposit_paid"
  | "production_released"
  | "in_production"
  | "qc_passed"
  | "packed"
  | "dispatched"
  | "delivered"
  | "cancelled";

export interface ProductionOrder {
  id: string;
  order_number: string;
  client_id: string;
  quote_id: string;
  project_id: string | null;
  status: OrderStatus;
  deposit_paise: number;
  balance_paise: number;
  currency: string;
  total_paise: number;
  idempotency_key: string | null;
  shipping_address_json: string;
  notes: string | null;
  deposit_paid_at: string | null;
  full_paid_at: string | null;
  deposit_payment_id: string | null;
  final_payment_id: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  quote_item_id: string | null;
  description: string;
  quantity: number;
  unit_price_paise: number;
  line_total_paise: number;
  created_at: string;
}

export type JobStatus =
  | "scheduled"
  | "procurement"
  | "printing"
  | "blending"
  | "filling_packing"
  | "qc"
  | "ready_to_ship"
  | "completed"
  | "halted";

export interface ProductionJob {
  id: string;
  job_number: string;
  order_id: string;
  status: JobStatus;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  operator_notes: string | null;
  override_justification: string | null;
  released_by: string;
  released_at: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface QCMilestone {
  id: string;
  job_id: string;
  milestone_name: string;
  stage:
    | "raw_material"
    | "packaging_incoming"
    | "print_proof"
    | "fill_weight"
    | "seal_integrity"
    | "sensory_cupping"
    | "final_pack";
  status: "pending" | "passed" | "failed" | "waived";
  inspector_name: string | null;
  inspection_date: string | null;
  evidence_notes: string | null;
  evidence_photo_url: string | null;
  cupping_score: number | null;
  recorded_weight_g: number | null;
  target_weight_g: number | null;
  notes: string | null;
  updated_at: string | null;
  created_at: string;
}

export interface ProductionJobWithMilestones extends ProductionJob {
  milestones: QCMilestone[];
}

// ============================================================================
// Service Inputs, Filters & Results
// ============================================================================

export interface PackagingFilter {
  familyCode?: string;
  status?: PackagingVariantStatus;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UpsertPackagingInput {
  id?: string;
  family_id: string;
  slug: string;
  sku: string;
  title: string;
  material: string;
  finish: string;
  closure_type: string;
  capacity_description: string;
  net_weight_capacity_grams: number;
  width_mm: number;
  height_mm: number;
  depth_mm?: number | null;
  label_safe_width_mm: number;
  label_safe_height_mm: number;
  supplier_name: string;
  supplier_sku?: string | null;
  unit_cost_paise: number;
  lead_time_days?: number;
  moq_units?: number;
  order_multiple?: number;
  dieline_url?: string | null;
  hero_image_url?: string | null;
  image_illustrative?: boolean;
  status?: PackagingVariantStatus;
  compatible_print_method_ids?: string[];
  family_code?: string;
}

export interface TeaOptionFilter {
  category?: TeaCategory;
  is_published?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface UpsertTeaOptionInput {
  id?: string;
  slug: string;
  name: string;
  origin_estate: string;
  region: string;
  grade: string;
  flush: string;
  tea_category: TeaCategory;
  description: string;
  caffeine_level: CaffeineLevel;
  base_cost_per_kg_paise: number;
  min_batch_kg?: number;
  tasting_notes?: string[];
  regular_product_id?: number | null;
  is_published?: boolean;
  sample_available?: boolean;
}

export interface CreateProjectInput {
  title: string;
  client_id?: string;
  clientId?: string;
  brand_id?: string;
  brand_name?: string;
  target_market?: string;
  notes?: string;
  draft_configuration?: Record<string, unknown>;
  initialConfig?: Record<string, unknown>;
  items?: ProjectItemInput[];
}

export interface UpdateProjectInput {
  title?: string;
  target_market?: string;
  notes?: string;
  draft_configuration?: Record<string, unknown>;
  status?: ProjectStatus;
  items?: ProjectItemInput[];
}

export interface ProjectFilter {
  status?: ProjectStatus;
  limit?: number;
  offset?: number;
}

export interface CreateQuoteInput {
  project_id?: string;
  projectId?: string;
  price_book_id?: string;
  validity_days?: number;
  destination_zone?: "local" | "metro" | "national" | "international";
  destinationZone?: "local" | "metro" | "national" | "international";
}

export interface AcceptQuoteInput {
  client_id?: string;
  clientId?: string;
  acceptance_notes?: string;
}

export interface CreateArtworkInput {
  original_filename: string;
  file_size_bytes: number;
  mime_type: string;
  storage_key: string;
  file_sha256: string;
  width_px?: number | null;
  height_px?: number | null;
  dpi?: number | null;
  color_space?: string | null;
  rights_attestation: boolean;
}

export interface CreateDesignVersionInput {
  project_id?: string;
  project_item_id?: string;
  expected_revision?: number;
  scene_json: Record<string, unknown>;
  asset_url?: string | null;
  front_artwork_asset_id?: string | null;
  back_artwork_asset_id?: string | null;
  preview_render_url?: string | null;
  print_ready_pdf_url?: string | null;
  preflight_report?: Record<string, unknown> | null;
}

export interface ApproveProofInput {
  actor_name?: string;
  signer_name?: string;
  legal_disclaimer_accepted?: boolean;
  disclaimer_accepted?: boolean;
  revision?: number;
  expected_revision?: number;
  ip_address?: string | null;
  user_agent?: string | null;
  notes?: string | null;
}

export interface RejectProofInput {
  reason: string;
  revision?: number;
  expected_revision?: number;
  actor_name?: string;
  ip_address?: string | null;
  user_agent?: string | null;
}

export type SampleType =
  | "tea_kit"
  | "printed_proof"
  | "packaged_mockup"
  | "full_pack_sample";

export type SampleTypeInput =
  | SampleType
  | "tea_tasting_kit"
  | "tasting_kit"
  | "swatch_pack"
  | "packaging_swatch";

export interface CreateSampleOrderInput {
  sample_type: SampleTypeInput;
  project_id?: string;
  tea_option_id?: string;
  tea_recipe_ids?: string[];
  packaging_variant_id?: string;
  quantity?: number;
  coupon_code?: string | null;
  shipping_address?: Record<string, unknown>;
  amount_paise?: number;
  notes?: string | null;
}

export interface ConvertQuoteToOrderInput {
  quote_id?: string;
  expected_revision?: number;
  idempotency_key?: string;
  gateway_currency?: string;
  notes?: string;
  acceptance_notes?: string;
  shipping_address?: Record<string, unknown>;
}

export interface PaymentIntentResult {
  available?: boolean;
  message?: string;
  client_secret?: string;
  payment_intent_id?: string;
  amount_paise: number;
  currency: string;
  status: string;
  quote_id?: string;
  order_id?: string;
  deposit_percentage: number;
}

export interface ValidateReleaseResult {
  eligible: boolean;
  blockers: string[];
  order_id: string;
  order_number?: string;
  deposit_status?: string;
  proof_status?: string;
  tea_available?: boolean;
  packaging_available?: boolean;
}

export interface ReleaseJobInput {
  order_id?: string;
  operator_id?: string;
  target_completion_date?: string;
  operator_notes?: string;
  override_justification?: string;
}

export type QCStage =
  | "raw_material"
  | "packaging_incoming"
  | "print_proof"
  | "fill_weight"
  | "seal_integrity"
  | "sensory_cupping"
  | "final_pack";

export type QCStageInput =
  | QCStage
  | "raw_material_in"
  | "packaging_cartoning"
  | "final";

export type QCStatus = "pending" | "passed" | "failed" | "waived" | "conditionally_passed";

export interface RecordQCMilestoneInput {
  milestone_name?: string;
  stage: QCStageInput;
  status: QCStatus;
  inspector_name?: string;
  evidence_notes?: string;
  evidence_photo_url?: string;
  evidence_url?: string;
  cupping_score?: number | null;
  recorded_weight_g?: number | null;
  target_weight_g?: number | null;
  notes?: string | null;
}

export interface ReorderInput {
  original_order_id: string;
  quantity: number;
  notes?: string;
}

export interface MoqEvaluationParams {
  requestedUnits: number;
  netWeightGrams: number;
  teaMinBatchKg: number;
  packagingMOQ: number;
  printMOQ: number;
  fillingMOQ?: number;
  orderMultiple?: number;
  minOrderValuePaise?: number;
  unitEstimatedPricePaise?: number;
}

export interface MoqEvaluationResult {
  eligible: boolean;
  minUnits: number;
  nextValidUnits: number;
  teaUnitsRequired: number;
  reasons: string[];
  constraints: {
    teaBatchUnits: number;
    packagingMOQ: number;
    printMOQ: number;
    fillingMOQ: number;
    orderMultiple: number;
    minOrderValuePaise?: number;
  };
}

export interface PricingCalculationParams {
  requestedUnits: number;
  netWeightGrams: number;
  teaOption: {
    id: string;
    baseCostPerKgPaise: number;
  };
  packagingVariant: {
    id: string;
    unitCostPaise: number;
    closureRatePaise?: number;
    tareWeightGrams?: number;
    packsPerCarton?: number;
  };
  printMethod: {
    id: string;
    code: PrintMethodCode;
    setupFeePaise: number;
    cylinderFeePerColorPaise: number;
  };
  colorCount?: number;
  priceBook?: {
    id: string;
    marginRate: number;
    fillingLaborPaisePerUnit: number;
    qcChargePaisePerBatch: number;
    lossAllowanceRate: number;
  };
  destinationZone?: "local" | "metro" | "national" | "international";
}

export interface PriceBreakdown {
  teaCostPaise: number;
  packagingCostPaise: number;
  printingCostPaise: number;
  closureCostPaise: number;
  labelCostPaise: number;
  setupFeePaise: number;
  gravureCylinderFeePaise: number;
  laborCostPaise: number;
  qcCostPaise: number;
  cartonCostPaise: number;
  freightPaise: number;
  subtotalPaise: number;
  marginPaise: number;
  taxPaise: number;
  taxDetails: {
    teaGstPaise: number;
    nonTeaGstPaise: number;
  };
  grandTotalPaise: number;
  unitPricePaise: number;
}

export interface PriceEstimateResult {
  status: "firm_issued" | "manual_quote_required" | "estimated";
  requiresOperatorReview: boolean;
  missingRates: string[];
  breakdown?: PriceBreakdown;
}

export interface CompatibilityResult {
  compatible: boolean;
  reason?: string;
  maxColors?: number;
  notes?: string;
}

export interface GateVerificationResult {
  canPublish: boolean;
  blockers: string[];
}

// ============================================================================
// Milestone M4: Configurator, 12-Component Pricing & Public Quote DTO Types
// ============================================================================

export interface ProjectItemInput {
  teaOptionId?: string;
  tea_option_id?: string;
  packagingVariantId?: string;
  packaging_variant_id?: string;
  printMethodId?: string;
  print_method_id?: string;
  fillWeightGrams?: number;
  fill_weight_grams?: number;
  quantityUnits?: number;
  quantity_units?: number;
  colorCount?: number;
  color_count?: number;
  designVersionId?: string | null;
  design_version_id?: string | null;
}

export interface DetailedPricingParams {
  requestedUnits: number;
  netWeightGrams: number;
  teaOption: {
    id: string;
    baseCostPerKgPaise?: number;
    base_cost_per_kg_paise?: number;
    minBatchKg?: number;
    min_batch_kg?: number;
    teaCategory?: string;
  };
  packagingVariant: {
    id: string;
    unitCostPaise?: number;
    unit_cost_paise?: number;
    closureRatePaise?: number;
    closure_rate_paise?: number;
    tareWeightGrams?: number;
    tare_weight_grams?: number;
    packsPerCarton?: number;
    packs_per_carton?: number;
  };
  printMethod: {
    id: string;
    code: PrintMethodCode;
    setupFeePaise?: number;
    setup_fee_paise?: number;
    cylinderFeePerColorPaise?: number;
    cylinder_fee_per_color_paise?: number;
    unitCostPaise?: number;
    unit_cost_paise?: number;
  };
  colorCount?: number;
  isNitrogenFlushEnabled?: boolean;
  priceBook?: {
    id: string;
    marginRate?: number;
    margin_rate?: number;
    fillingLaborPaisePerUnit?: number;
    filling_labor_paise_per_unit?: number;
    qcChargePaisePerBatch?: number;
    qc_charge_paise_per_batch?: number;
    lossAllowanceRate?: number;
    loss_allowance_rate?: number;
  };
  destinationZone?: "local" | "metro" | "national" | "international";
  activeTiers?: Array<{
    item_type: "packaging" | "print_method" | "tea_markup";
    item_id: string;
    min_qty: number;
    max_qty: number | null;
    unit_price_paise: number;
  }>;
}

export interface ItemizedPriceBreakdown {
  teaCostPaise: number;
  packagingCostPaise: number;
  printingCostPaise: number;
  toolingSetupPaise: number;
  closureFinishingCostPaise: number;
  nitrogenFlushingCostPaise: number;
  laborCostPaise: number;
  qcCostPaise: number;
  cartonCostPaise: number;
  palletizingCostPaise: number;
  freightCostPaise: number;
  subtotalDirectPaise: number;
  marginPaise: number;
  taxPaise: number;
  grandTotalPaise: number;
  unitPricePaise: number;

  taxDetails: {
    teaTaxableBasePaise: number;
    teaGstPaise: number;
    nonTeaTaxableBasePaise: number;
    nonTeaGstPaise: number;
  };

  metrics: {
    netTeaKg: number;
    grossTeaKg: number;
    cartonCount: number;
    palletCount: number;
    totalWeightKg: number;
    batchCount: number;
  };

  appliedTiers?: {
    packagingTierPricePaise?: number;
    printMethodTierPricePaise?: number;
    teaMarkupTierPaise?: number;
  };
}

export interface ItemizedPriceEstimateResult {
  status: "firm_issued" | "manual_quote_required" | "estimated";
  requiresOperatorReview: boolean;
  missingRates: string[];
  breakdown?: ItemizedPriceBreakdown;
}

export interface PublicQuoteItemDto {
  id: string;
  project_item_id: string | null;
  description: string;
  quantity: number;
  unit_price_paise: number;
  line_total_paise: number;
}

export interface PublicQuoteWithItemsDto {
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
  revision: number;
  items: PublicQuoteItemDto[];
  price_breakdown?: {
    taxDetails?: {
      teaGstPaise: number;
      nonTeaGstPaise: number;
    };
    metrics?: {
      netTeaKg: number;
      grossTeaKg: number;
      cartonCount: number;
      palletCount: number;
      totalWeightKg: number;
      batchCount: number;
    };
  };
}

// Global augmentation for Next.js metadata types in tests
declare module "next/dist/lib/metadata/types/opengraph-types" {
  interface OpenGraphMetadata {
    type?: string;
  }
}

declare module "next/dist/lib/metadata/types/twitter-types" {
  interface TwitterMetadata {
    card?: string;
  }
}
