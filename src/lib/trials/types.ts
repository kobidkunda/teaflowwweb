/**
 * TeaFloww Trials v3 — Domain Types, Error Hierarchy & DTOs
 *
 * Core TypeScript definitions for the TeaFloww Trials v3 subsystem.
 * Shared across TrialService, Admin Studio REST APIs, and MCP programmatic tools.
 */

export type TrialStatus = "draft" | "in_review" | "published" | "archived";

export type PackFormat = "4x50g_sachets";

export type InventoryPolicy = "track" | "continue";

export type AssetStage =
  | "packaging"
  | "dry_leaf"
  | "infused_leaf"
  | "liquor"
  | "milk_tea"
  | "hero"
  | "gallery";

export type OpticalStage =
  | "packaging"
  | "dry_leaf"
  | "infused_leaf"
  | "liquor"
  | "milk_tea";

export type AuditActorType = "admin" | "mcp" | "system" | "customer";

export type ClaimType =
  | "origin"
  | "fssai_licence"
  | "tea_board"
  | "ingredient"
  | "sensory"
  | "economic"
  | "operational"
  | "sourcing";

// ============================================================================
// Error Hierarchy
// ============================================================================

/**
 * Thrown on revision mismatch in atomic Compare-and-Swap (CAS) mutations.
 * HTTP Status: 409 Conflict | MCP JSON-RPC Code: -32009
 */
export class TrialRevisionConflictError extends Error {
  readonly code = "REVISION_CONFLICT" as const;
  readonly status = 409 as const;
  readonly mcpCode = -32009 as const;
  readonly current_revision: number;
  readonly expected_revision: number;

  constructor(current_revision: number, expected_revision: number, message?: string) {
    super(
      message ||
        `Revision conflict: trial was modified concurrently (current revision: ${current_revision}, expected: ${expected_revision})`
    );
    this.name = "TrialRevisionConflictError";
    this.current_revision = current_revision;
    this.expected_revision = expected_revision;
    Object.setPrototypeOf(this, TrialRevisionConflictError.prototype);
  }
}

/**
 * Thrown when a trial is not found by ID or slug.
 * HTTP Status: 404 Not Found | MCP JSON-RPC Code: -32004
 */
export class TrialNotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  readonly status = 404 as const;
  readonly mcpCode = -32004 as const;

  constructor(identifier: string) {
    super(`Trial not found: ${identifier}`);
    this.name = "TrialNotFoundError";
    Object.setPrototypeOf(this, TrialNotFoundError.prototype);
  }
}

/**
 * Thrown when a trial fails publication gate verification.
 * HTTP Status: 422 Unprocessable Content | MCP JSON-RPC Code: -32009
 */
export class TrialPublishGateError extends Error {
  readonly code = "PUBLISH_GATE_FAILED" as const;
  readonly status = 422 as const;
  readonly mcpCode = -32009 as const;
  readonly blockers: string[];

  constructor(blockers: string[]) {
    super(`Cannot publish trial due to ${blockers.length} blocker(s): ${blockers.join("; ")}`);
    this.name = "TrialPublishGateError";
    this.blockers = blockers;
    Object.setPrototypeOf(this, TrialPublishGateError.prototype);
  }
}

/**
 * Thrown when sachet components violate the 4x50g = 200g invariant.
 * HTTP Status: 422 Unprocessable Content | MCP JSON-RPC Code: -32602
 */
export class TrialWeightInvariantError extends Error {
  readonly code = "WEIGHT_INVARIANT_FAILED" as const;
  readonly status = 422 as const;
  readonly mcpCode = -32602 as const;
  readonly totalWeight: number;
  readonly count: number;

  constructor(totalWeight: number, count: number, message?: string) {
    super(
      message ||
        `Weight invariant failed: kit must contain exactly 4 sachets of 50g each summing to 200g (found ${count} sachets summing to ${totalWeight}g)`
    );
    this.name = "TrialWeightInvariantError";
    this.totalWeight = totalWeight;
    this.count = count;
    Object.setPrototypeOf(this, TrialWeightInvariantError.prototype);
  }
}

/**
 * Thrown when an invalid lifecycle state transition is attempted.
 * HTTP Status: 409 Conflict | MCP JSON-RPC Code: -32009
 */
export class TrialInvalidStateTransitionError extends Error {
  readonly code = "INVALID_STATE_TRANSITION" as const;
  readonly status = 409 as const;
  readonly mcpCode = -32009 as const;
  readonly fromStatus: string;
  readonly toStatus: string;

  constructor(fromStatus: string, toStatus: string, message?: string) {
    super(
      message ||
        `Invalid trial lifecycle state transition from '${fromStatus}' to '${toStatus}'`
    );
    this.name = "TrialInvalidStateTransitionError";
    this.fromStatus = fromStatus;
    this.toStatus = toStatus;
    Object.setPrototypeOf(this, TrialInvalidStateTransitionError.prototype);
  }
}

// ============================================================================
// Database Entities
// ============================================================================

export interface Trial {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  status: TrialStatus;
  pack_format: PackFormat;
  net_weight_g: number; // 200
  price_paise: number;
  compare_at_price_paise: number | null;
  cost_paise: number | null;
  sku: string;
  inventory_quantity: number;
  inventory_policy: InventoryPolicy;
  hero_image_id: number | null;
  meta_title: string | null;
  meta_description: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  archived_at: string | null;
}

export interface TrialComponent {
  id: string;
  trial_id: string;
  slot_index: number; // 0, 1, 2, 3
  name: string;
  estate: string;
  grade: string;
  flush: string;
  elevation: string | null;
  weight_g: number; // 50
  quantity: number; // 1
  tasting_notes: string; // JSON string array in DB
  brew_temp_c: number;
  brew_time_sec: number;
  leaf_dose_g: number;
  regular_product_id: number | null;
  regular_variant_id: number | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface TrialAsset {
  id: string;
  trial_id: string;
  component_id: string | null;
  slot_index: number | null;
  media_id: number | null;
  asset_url: string;
  stage: AssetStage;
  alt_text: string;
  caption?: string | null;
  rights_status: string;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface TrialBrewGuide {
  id: string;
  trial_id: string;
  component_id: string | null;
  protocol_name: string;
  tea_dose_g: number;
  water_ml: number;
  milk_ml: number;
  sugar_g: number;
  temp_c: number;
  steep_time_sec: number;
  steps_json: string;
  notes: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface TrialSensoryTest {
  id: string;
  trial_id: string;
  component_id: string | null;
  sample_id: string | null;
  lot_id: string | null;
  tester_name: string;
  tested_at: string;
  method: string;
  aroma_score: number | null;
  body_score: number | null;
  briskness_score: number | null;
  astringency_score: number | null;
  finish_score: number | null;
  milk_performance_score: number | null;
  color_hex: string | null;
  metrics_json: string;
  verified: number; // 0 | 1
  notes: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TrialClaim {
  id: string;
  trial_id: string;
  claim_type: ClaimType | string;
  label: string;
  claim_text: string;
  basis: string;
  evidence_ref: string | null;
  verified: number; // 0 | 1
  approved_by: string | null;
  approved_at: string | null;
  expires_at: string | null;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
}

export interface TrialBulkLink {
  id: string;
  trial_id: string;
  component_id: string | null;
  product_id: number | null;
  variant_id: number | null;
  pack_size_grams: number;
  display_label: string;
  discount_percent: number;
  subscriber_eligible: number; // 0 | 1
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  // Hydrated helper properties:
  product_slug?: string | null;
  variant_title?: string | null;
}

export interface TrialPublication {
  id: string;
  trial_id: string;
  revision: number;
  snapshot_json: string;
  published_by: string;
  published_at: string;
  is_active: number; // 0 | 1
  unregistered_at?: string | null;
}

export interface TrialAuditEntry {
  id: string;
  trial_id: string;
  revision: number;
  action: string;
  actor_type: AuditActorType;
  actor_id: string;
  actor_email?: string | null;
  diff_json: string;
  diff?: Record<string, unknown> | null;
  reason?: string | null;
  ip_address?: string | null;
  created_at: string;
}

// ============================================================================
// Composite & DTO Types
// ============================================================================

export interface TrialWithDetails extends Trial {
  hero_image?: { url: string; alt_text: string } | null;
  components: TrialComponent[];
  assets: TrialAsset[];
  brew_guides: TrialBrewGuide[];
  sensory_tests: TrialSensoryTest[];
  claims: TrialClaim[];
  bulk_links: TrialBulkLink[];
  latest_publication?: TrialPublication | null;
}

export interface TrialPublicDto {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  description: string | null;
  status: "published";
  pack_format: "4x50g_sachets";
  net_weight_g: 200;
  price_paise: number;
  compare_at_price_paise: number | null;
  sku: string;
  in_stock: boolean;
  hero_image: { url: string; alt_text: string } | null;
  gallery_images?: Array<{ url: string; alt_text: string }>;
  components: Array<{
    slot_index: number;
    name: string;
    estate: string;
    grade: string;
    flush: string;
    elevation: string | null;
    weight_g: number;
    tasting_notes: string[];
    brewing: {
      temp_c: number;
      time_sec: number;
      dose_g: number;
    };
    bulk_link: {
      product_slug: string | null;
      variant_title: string | null;
    } | null;
    assets: Array<{
      stage: string;
      url: string;
      alt_text: string;
    }>;
  }>;
  claims: Array<{
    claim_type: string;
    label: string;
    verified: boolean;
  }>;
  meta: {
    title: string | null;
    description: string | null;
  };
}

export interface AuditActor {
  actor_type: AuditActorType;
  actor_id: string;
  actor_email?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
  reason?: string | null;
}

// ============================================================================
// Service Inputs & Options
// ============================================================================

export interface CreateTrialInput {
  slug?: string;
  title: string;
  tagline?: string | null;
  description?: string | null;
  price_paise?: number;
  compare_at_price_paise?: number | null;
  cost_paise?: number | null;
  sku?: string;
  inventory_quantity?: number;
  inventory_policy?: InventoryPolicy;
  hero_image_id?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
  components?: ComponentInput[];
}

export interface UpdateTrialInput {
  title?: string;
  slug?: string;
  tagline?: string | null;
  description?: string | null;
  price_paise?: number;
  compare_at_price_paise?: number | null;
  cost_paise?: number | null;
  sku?: string;
  inventory_quantity?: number;
  inventory_policy?: InventoryPolicy;
  hero_image_id?: number | null;
  meta_title?: string | null;
  meta_description?: string | null;
}

export interface ComponentInput {
  id?: string;
  slot_index: number;
  name: string;
  estate?: string;
  grade?: string;
  flush?: string;
  elevation?: string | null;
  weight_g?: number; // Must be 50
  quantity?: number; // Must be 1
  tasting_notes?: string[] | string;
  brew_temp_c?: number;
  brew_time_sec?: number;
  leaf_dose_g?: number;
  regular_product_id?: string | number | null;
  regular_variant_id?: string | number | null;
  sort_order?: number;
}

export interface AssetInput {
  id?: string;
  component_id?: string | null;
  slot_index?: number | null;
  media_id?: number | null;
  asset_url: string;
  stage: AssetStage;
  alt_text: string;
  caption?: string | null;
  rights_status?: string;
  sort_order?: number;
}

export interface ClaimInput {
  id?: string;
  claim_type: ClaimType | string;
  label: string;
  claim_text: string;
  basis?: string;
  evidence_ref?: string | null;
  verified?: boolean | number;
  approved_by?: string | null;
  sort_order?: number;
}

export interface BulkLinkInput {
  id?: string;
  component_id?: string | null;
  product_id?: number | null;
  variant_id?: number | null;
  pack_size_grams: number;
  display_label?: string;
  discount_percent?: number;
  subscriber_eligible?: boolean | number;
  sort_order?: number;
}

export interface TrialQueryOptions {
  status?: TrialStatus | "all";
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: "created_at" | "updated_at" | "title" | "price_paise";
  sort_dir?: "asc" | "desc";
}

export interface TrialPublicQueryOptions {
  search?: string;
  limit?: number;
  offset?: number;
  sort_by?: "published_at" | "title" | "price_paise";
  sort_dir?: "asc" | "desc";
}

export interface PublicationValidationResult {
  can_publish: boolean;
  blockers: string[];
}
