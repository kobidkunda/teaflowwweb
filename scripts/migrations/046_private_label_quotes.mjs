/**
 * Migration 046: TeaFloww Private Label Projects, Quotes, Samples, Orders, Jobs & QC Milestones
 *
 * Implements Milestone M1 project, quotation, and manufacturing lifecycle schema:
 * 1. pl_projects - Master project dossier, draft state, revision CAS concurrency
 * 2. pl_project_items - Configured items (tea option, variant, print method, weight, qty)
 * 3. pl_quotes - Immutable commercial snapshot, 12-component costs, grand total, validity window
 * 4. pl_quote_items - Itemized line items linked to project items
 * 5. pl_samples - Sample orders (tea kit, printed proof, mockup, full sample)
 * 6. pl_sample_items - Specific components included in sample kits
 * 7. pl_orders - Firm production orders, deposit tracking, revision CAS concurrency
 * 8. pl_order_items - Line items associated with production orders
 * 9. pl_jobs - Manufacturing runs released via hard production gate
 * 10. pl_qc_milestones - 7-stage quality control verification register
 */

export function up(db) {
  db.exec(`
    -- 1. Projects Master Table
    CREATE TABLE IF NOT EXISTS pl_projects (
      id TEXT PRIMARY KEY,
      client_id TEXT REFERENCES pl_clients(id) ON DELETE CASCADE,
      owner_customer_id TEXT,
      brand_id TEXT REFERENCES pl_brands(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'configured', 'in_review', 'quoted', 'accepted', 'archived', 'cancelled')),
      target_market TEXT NOT NULL DEFAULT 'IN',
      notes TEXT,
      draft_configuration_json TEXT NOT NULL DEFAULT '{}',
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_projects_client ON pl_projects(client_id, status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pl_projects_owner ON pl_projects(owner_customer_id, status);
    CREATE INDEX IF NOT EXISTS idx_pl_projects_revision ON pl_projects(id, revision);

    -- 2. Project Items Table
    CREATE TABLE IF NOT EXISTS pl_project_items (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES pl_projects(id) ON DELETE CASCADE,
      tea_option_id TEXT REFERENCES pl_tea_options(id) ON DELETE RESTRICT,
      packaging_variant_id TEXT REFERENCES pl_packaging_variants(id) ON DELETE RESTRICT,
      print_method_id TEXT REFERENCES pl_print_methods(id) ON DELETE RESTRICT,
      fill_weight_grams REAL NOT NULL CHECK(fill_weight_grams > 0),
      quantity_units INTEGER NOT NULL CHECK(quantity_units > 0),
      color_count INTEGER NOT NULL DEFAULT 1 CHECK(color_count > 0),
      design_version_id TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_proj_items_project ON pl_project_items(project_id);

    -- 3. Quotes Table (Immutable point-in-time commercial offers)
    CREATE TABLE IF NOT EXISTS pl_quotes (
      id TEXT PRIMARY KEY,
      quote_number TEXT NOT NULL UNIQUE,
      project_id TEXT NOT NULL REFERENCES pl_projects(id) ON DELETE RESTRICT,
      price_book_id TEXT NOT NULL REFERENCES pl_price_books(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'pricing_pending', 'estimated', 'firm_issued', 'customer_accepted', 'expired', 'superseded', 'converted')),
      version INTEGER NOT NULL DEFAULT 1 CHECK(version >= 1),
      currency TEXT NOT NULL DEFAULT 'INR' CHECK(currency IN ('INR', 'USD', 'EUR', 'GBP')),
      tea_subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(tea_subtotal_paise >= 0),
      packaging_subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(packaging_subtotal_paise >= 0),
      printing_subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(printing_subtotal_paise >= 0),
      tooling_setup_paise INTEGER NOT NULL DEFAULT 0 CHECK(tooling_setup_paise >= 0),
      labor_subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(labor_subtotal_paise >= 0),
      qc_subtotal_paise INTEGER NOT NULL DEFAULT 0 CHECK(qc_subtotal_paise >= 0),
      freight_paise INTEGER NOT NULL DEFAULT 0 CHECK(freight_paise >= 0),
      margin_paise INTEGER NOT NULL DEFAULT 0 CHECK(margin_paise >= 0),
      tax_paise INTEGER NOT NULL DEFAULT 0 CHECK(tax_paise >= 0),
      grand_total_paise INTEGER NOT NULL DEFAULT 0 CHECK(grand_total_paise >= 0),
      price_breakdown_json TEXT NOT NULL DEFAULT '{}',
      issued_at TEXT,
      valid_until TEXT,
      accepted_at TEXT,
      pdf_summary_url TEXT,
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_quotes_number ON pl_quotes(quote_number);
    CREATE INDEX IF NOT EXISTS idx_pl_quotes_project ON pl_quotes(project_id, status);
    CREATE INDEX IF NOT EXISTS idx_pl_quotes_validity ON pl_quotes(status, valid_until);

    -- 4. Quote Items Table
    CREATE TABLE IF NOT EXISTS pl_quote_items (
      id TEXT PRIMARY KEY,
      quote_id TEXT NOT NULL REFERENCES pl_quotes(id) ON DELETE CASCADE,
      project_item_id TEXT NOT NULL REFERENCES pl_project_items(id) ON DELETE RESTRICT,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price_paise INTEGER NOT NULL CHECK(unit_price_paise >= 0),
      line_total_paise INTEGER NOT NULL CHECK(line_total_paise >= 0),
      cost_breakdown_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_quote_items_quote ON pl_quote_items(quote_id);

    -- 5. Samples Table
    CREATE TABLE IF NOT EXISTS pl_samples (
      id TEXT PRIMARY KEY,
      sample_number TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL REFERENCES pl_clients(id) ON DELETE CASCADE,
      project_id TEXT REFERENCES pl_projects(id) ON DELETE SET NULL,
      sample_type TEXT NOT NULL CHECK(sample_type IN ('tea_kit', 'printed_proof', 'packaged_mockup', 'full_pack_sample')),
      status TEXT NOT NULL DEFAULT 'requested' CHECK(status IN ('requested', 'payment_pending', 'processing', 'dispatched', 'delivered', 'rejected', 'completed')),
      tea_option_id TEXT REFERENCES pl_tea_options(id) ON DELETE SET NULL,
      packaging_variant_id TEXT REFERENCES pl_packaging_variants(id) ON DELETE SET NULL,
      shipping_address_json TEXT NOT NULL DEFAULT '{}',
      tracking_number TEXT,
      carrier TEXT,
      feedback_notes TEXT,
      amount_paise INTEGER NOT NULL DEFAULT 0 CHECK(amount_paise >= 0),
      payment_reference TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_samples_number ON pl_samples(sample_number);
    CREATE INDEX IF NOT EXISTS idx_pl_samples_client ON pl_samples(client_id, status);

    -- 6. Sample Items Table
    CREATE TABLE IF NOT EXISTS pl_sample_items (
      id TEXT PRIMARY KEY,
      sample_id TEXT NOT NULL REFERENCES pl_samples(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK(item_type IN ('tea', 'packaging', 'printed_swatch', 'custom')),
      tea_option_id TEXT REFERENCES pl_tea_options(id) ON DELETE SET NULL,
      packaging_variant_id TEXT REFERENCES pl_packaging_variants(id) ON DELETE SET NULL,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_sample_items_sample ON pl_sample_items(sample_id);

    -- 7. Orders Table
    CREATE TABLE IF NOT EXISTS pl_orders (
      id TEXT PRIMARY KEY,
      order_number TEXT NOT NULL UNIQUE,
      client_id TEXT NOT NULL REFERENCES pl_clients(id) ON DELETE RESTRICT,
      quote_id TEXT NOT NULL REFERENCES pl_quotes(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'pending_deposit' CHECK(status IN ('pending_deposit', 'deposit_paid', 'production_released', 'in_production', 'qc_passed', 'packed', 'dispatched', 'delivered', 'cancelled')),
      deposit_paise INTEGER NOT NULL DEFAULT 0 CHECK(deposit_paise >= 0),
      balance_paise INTEGER NOT NULL DEFAULT 0 CHECK(balance_paise >= 0),
      deposit_paid_at TEXT,
      full_paid_at TEXT,
      deposit_payment_id TEXT,
      final_payment_id TEXT,
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_orders_num ON pl_orders(order_number);
    CREATE INDEX IF NOT EXISTS idx_pl_orders_client ON pl_orders(client_id, status);

    -- 8. Order Items Table
    CREATE TABLE IF NOT EXISTS pl_order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES pl_orders(id) ON DELETE CASCADE,
      quote_item_id TEXT REFERENCES pl_quote_items(id) ON DELETE RESTRICT,
      description TEXT NOT NULL,
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price_paise INTEGER NOT NULL CHECK(unit_price_paise >= 0),
      line_total_paise INTEGER NOT NULL CHECK(line_total_paise >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_order_items_order ON pl_order_items(order_id);

    -- 9. Jobs Table (Internal manufacturing run)
    CREATE TABLE IF NOT EXISTS pl_jobs (
      id TEXT PRIMARY KEY,
      job_number TEXT NOT NULL UNIQUE,
      order_id TEXT NOT NULL REFERENCES pl_orders(id) ON DELETE RESTRICT,
      status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled', 'procurement', 'printing', 'blending', 'filling_packing', 'qc', 'ready_to_ship', 'completed', 'halted')),
      target_completion_date TEXT,
      actual_completion_date TEXT,
      operator_notes TEXT,
      released_by TEXT NOT NULL,
      released_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_jobs_num ON pl_jobs(job_number);
    CREATE INDEX IF NOT EXISTS idx_pl_jobs_order ON pl_jobs(order_id);

    -- 10. QC Milestones Table (7 inspection stages)
    CREATE TABLE IF NOT EXISTS pl_qc_milestones (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES pl_jobs(id) ON DELETE CASCADE,
      milestone_name TEXT NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('raw_material', 'packaging_incoming', 'print_proof', 'fill_weight', 'seal_integrity', 'sensory_cupping', 'final_pack')),
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'passed', 'failed', 'waived')),
      inspector_name TEXT,
      inspection_date TEXT,
      evidence_notes TEXT,
      evidence_photo_url TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_qc_job_stage ON pl_qc_milestones(job_id, stage);
  `);
}

export function down(db) {
  if (!db) return;
  db.exec(`
    DROP TABLE IF EXISTS pl_qc_milestones;
    DROP TABLE IF EXISTS pl_jobs;
    DROP TABLE IF EXISTS pl_order_items;
    DROP TABLE IF EXISTS pl_orders;
    DROP TABLE IF EXISTS pl_sample_items;
    DROP TABLE IF EXISTS pl_samples;
    DROP TABLE IF EXISTS pl_quote_items;
    DROP TABLE IF EXISTS pl_quotes;
    DROP TABLE IF EXISTS pl_project_items;
    DROP TABLE IF EXISTS pl_projects;
  `);
}
