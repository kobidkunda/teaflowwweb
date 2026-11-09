-- TeaFloww Blend Lab — illustrative PostgreSQL schema excerpt
-- NOT a production migration. Adapt naming, FKs, tenant policy, ORM and tax model
-- to the actual existing TeaFloww codebase. No claim of compatibility.
-- Use audited/DB-level ownership checks and server-side authentication in production.

CREATE TYPE bl_plan_code AS ENUM ('MATCH_QUOTE', 'QUALITY_AUDIT', 'SIGNATURE');
CREATE TYPE bl_payment_state AS ENUM ('draft', 'pending', 'paid', 'failed', 'refund_pending', 'refunded');
CREATE TYPE bl_report_state AS ENUM ('draft', 'review_required', 'approved', 'published', 'superseded');

CREATE TABLE bl_service_plans (
  code bl_plan_code PRIMARY KEY,
  public_name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  total_paise bigint NOT NULL CHECK (total_paise >= 0),
  currency char(3) NOT NULL DEFAULT 'INR',
  entitlements jsonb NOT NULL,
  tax_classification text NOT NULL DEFAULT 'PENDING_FINANCE_REVIEW',
  tax_rate_bps integer CHECK (tax_rate_bps BETWEEN 0 AND 10000),
  active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bl_projects (
  id uuid PRIMARY KEY,
  public_id text UNIQUE NOT NULL,
  -- Replace with FK to existing customer/account identity table
  owner_customer_id text NOT NULL,
  plan_code bl_plan_code NOT NULL REFERENCES bl_service_plans(code),
  plan_version integer NOT NULL,
  plan_entitlements_snapshot jsonb NOT NULL,
  total_paise bigint NOT NULL CHECK (total_paise >= 0),
  tax_snapshot jsonb NOT NULL,
  payment_state bl_payment_state NOT NULL DEFAULT 'draft',
  workflow_state text NOT NULL DEFAULT 'draft',
  business_name text,
  support_assignee_id text,
  terms_version text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  row_version integer NOT NULL DEFAULT 1
);
CREATE INDEX bl_projects_owner_idx ON bl_projects(owner_customer_id, created_at DESC);
CREATE INDEX bl_projects_state_idx ON bl_projects(workflow_state, updated_at DESC);

CREATE TABLE bl_project_briefs (
  project_id uuid PRIMARY KEY REFERENCES bl_projects(id) ON DELETE CASCADE,
  tea_category text,
  grade_label text,
  reference_source text,
  target_market text,
  monthly_kg numeric(12,3),
  current_price_paise_per_kg bigint,
  target_price_paise_per_kg bigint,
  goals text[] NOT NULL DEFAULT '{}',
  sensory_targets jsonb NOT NULL DEFAULT '{}',
  brewing_preferences jsonb NOT NULL DEFAULT '{}',
  requirements text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bl_payment_events (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES bl_projects(id),
  provider text NOT NULL,
  provider_order_id text,
  provider_event_id text NOT NULL,
  event_type text NOT NULL,
  verified boolean NOT NULL DEFAULT false,
  amount_paise bigint,
  currency char(3),
  occurred_at timestamptz NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_event_id)
);

CREATE TABLE bl_sample_receipts (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES bl_projects(id),
  sample_code text NOT NULL UNIQUE,
  courier_tracking text,
  inbound_shipment_id text,
  received_grams numeric(12,3),
  received_at timestamptz,
  condition_status text NOT NULL DEFAULT 'awaiting',
  condition_notes text,
  received_by text,
  evidence_object_keys jsonb NOT NULL DEFAULT '[]',
  external_teapilot_sample_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bl_tasting_sessions (
  id uuid PRIMARY KEY,
  sample_receipt_id uuid NOT NULL REFERENCES bl_sample_receipts(id),
  method_version text NOT NULL,
  tester_id text NOT NULL,
  performed_at timestamptz,
  preparation jsonb NOT NULL DEFAULT '{}',
  sensory_scores jsonb NOT NULL DEFAULT '{}',
  observations jsonb NOT NULL DEFAULT '{}',
  finalised_at timestamptz,
  reviewer_id text,
  external_teapilot_tasting_id text
);

CREATE TABLE bl_formulations (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES bl_projects(id),
  internal_label text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bl_formulation_versions (
  id uuid PRIMARY KEY,
  formulation_id uuid NOT NULL REFERENCES bl_formulations(id),
  version_no integer NOT NULL,
  -- CONFIDENTIAL: must NOT be serialized into customer-facing APIs
  recipe_private_json jsonb NOT NULL,
  component_lots_private_json jsonb NOT NULL,
  costing_private_json jsonb NOT NULL,
  tester_approved_by text,
  customer_approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(formulation_id, version_no)
);

CREATE TABLE bl_reports (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES bl_projects(id),
  current_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bl_report_versions (
  id uuid PRIMARY KEY,
  report_id uuid NOT NULL REFERENCES bl_reports(id),
  version_no integer NOT NULL,
  state bl_report_state NOT NULL DEFAULT 'draft',
  -- Object key never returned to browser; only authorized signed download URL
  private_object_key text,
  sha256 text,
  reviewer_id text,
  published_at timestamptz,
  source_manifest jsonb NOT NULL DEFAULT '{}',
  UNIQUE(report_id, version_no),
  CHECK (state <> 'published' OR
        (private_object_key IS NOT NULL AND sha256 IS NOT NULL AND reviewer_id IS NOT NULL AND published_at IS NOT NULL))
);

CREATE TABLE bl_shipments (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES bl_projects(id),
  direction text NOT NULL CHECK (direction IN ('inbound','outbound')),
  courier_provider text,
  tracking_number text,
  status text NOT NULL,
  carrier_request_key text NOT NULL UNIQUE,
  shipment_scope jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bl_customer_feedback (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES bl_projects(id),
  formulation_version_id uuid REFERENCES bl_formulation_versions(id),
  submitted_by_customer_id text NOT NULL,
  feedback jsonb NOT NULL,
  requested_revision boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bl_quotes (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES bl_projects(id),
  formulation_version_id uuid REFERENCES bl_formulation_versions(id),
  status text NOT NULL DEFAULT 'draft',
  quantity_kg numeric(12,3) NOT NULL CHECK(quantity_kg > 0),
  min_order_kg numeric(12,3),
  quoted_total_paise bigint,
  quoted_price_paise_per_kg bigint,
  tax_snapshot jsonb NOT NULL DEFAULT '{}',
  freight_terms text,
  valid_until timestamptz,
  approved_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE bl_events (
  id uuid PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES bl_projects(id),
  event_type text NOT NULL,
  actor_type text NOT NULL,
  actor_id text,
  from_state text,
  to_state text,
  -- Avoid PII and proprietary recipe details in audit payload
  safe_details jsonb NOT NULL DEFAULT '{}',
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX bl_events_project_time_idx ON bl_events(project_id, occurred_at DESC);

CREATE TABLE bl_outbox (
  id uuid PRIMARY KEY,
  project_id uuid REFERENCES bl_projects(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  attempts integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

-- Production hardening tasks:
-- [ ] add matching existing users FK, tenant IDs, and row-level security (if used)
-- [ ] constrain workflow_state using approved DB enum or lookup
-- [ ] implement database-transaction guards against invalid state transitions
-- [ ] ensure report snapshots cannot be UPDATEd after publication
-- [ ] add encrypted contact/address data model through existing store service
-- [ ] ensure only internal service role reads recipe_private_json/costing_private_json
-- [ ] configure retention/deletion and audit legal hold policies
-- [ ] perform migration rehearsal on staging database with backup/rollback
