/**
 * Migration 045: TeaFloww Private Label Core Catalog, Rules, and Audit Schema
 *
 * Implements Milestone M1 core entities:
 * 1. pl_clients - Organization identity, GSTIN, FSSAI, contacts
 * 2. pl_brands - Client brand identity, color palettes, trademark attestation
 * 3. pl_tea_options - Source teas, tasting notes, base costs, minimum batches
 * 4. pl_packaging_families - Structural families (pouch, tin, jar, carton, sachet, bag)
 * 5. pl_packaging_variants - Technical dimensions, safe zones, MOQs, supplier costs
 * 6. pl_print_methods - Print processes, color models, setup fees, cylinder fees
 * 7. pl_packaging_compatibility - Variant x Print method feasibility matrix (+ view)
 * 8. pl_moq_rules - Data-driven multi-dimensional minimum order constraints
 * 9. pl_price_books - Pricing strategies, default rates, labor, QC charges, margins
 * 10. pl_price_book_tiers - Quantity price breaks per component
 * 11. pl_audit - Immutable transactional audit trail for all PL mutations
 */

export function up(db) {
  db.exec(`
    -- 1. Clients Table (Organization identity & legal backing)
    CREATE TABLE IF NOT EXISTS pl_clients (
      id TEXT PRIMARY KEY,
      customer_id TEXT REFERENCES customers(id) ON DELETE SET NULL,
      company_name TEXT NOT NULL,
      gstin TEXT,
      fssai_license TEXT,
      billing_address TEXT,
      shipping_address TEXT,
      contact_name TEXT NOT NULL,
      contact_email TEXT NOT NULL,
      contact_phone TEXT,
      is_verified INTEGER NOT NULL DEFAULT 0 CHECK(is_verified IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_clients_customer ON pl_clients(customer_id);
    CREATE INDEX IF NOT EXISTS idx_pl_clients_email ON pl_clients(contact_email);

    -- 2. Brands Table (Brand assets & trademark attestation)
    CREATE TABLE IF NOT EXISTS pl_brands (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL REFERENCES pl_clients(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      tagline TEXT,
      brand_colors_json TEXT NOT NULL DEFAULT '[]',
      trademark_attestation INTEGER NOT NULL DEFAULT 0 CHECK(trademark_attestation IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(client_id, name)
    );
    CREATE INDEX IF NOT EXISTS idx_pl_brands_client ON pl_brands(client_id);

    -- 3. Tea Sourcing Options Table
    CREATE TABLE IF NOT EXISTS pl_tea_options (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      origin_estate TEXT NOT NULL,
      region TEXT NOT NULL,
      grade TEXT NOT NULL,
      flush TEXT NOT NULL,
      tea_category TEXT NOT NULL CHECK(tea_category IN ('black', 'green', 'white', 'oolong', 'chai_blend', 'herbal')),
      description TEXT NOT NULL,
      caffeine_level TEXT NOT NULL CHECK(caffeine_level IN ('none', 'low', 'medium', 'high')),
      base_cost_per_kg_paise INTEGER NOT NULL CHECK(base_cost_per_kg_paise >= 0),
      min_batch_kg REAL NOT NULL DEFAULT 5.0 CHECK(min_batch_kg > 0),
      tasting_notes_json TEXT NOT NULL DEFAULT '[]',
      regular_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      is_published INTEGER NOT NULL DEFAULT 1 CHECK(is_published IN (0, 1)),
      sample_available INTEGER NOT NULL DEFAULT 1 CHECK(sample_available IN (0, 1)),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_tea_options_slug ON pl_tea_options(slug);
    CREATE INDEX IF NOT EXISTS idx_pl_tea_options_published ON pl_tea_options(is_published);
    CREATE INDEX IF NOT EXISTS idx_pl_tea_options_category ON pl_tea_options(tea_category, is_published);

    -- 4. Packaging Families Table
    CREATE TABLE IF NOT EXISTS pl_packaging_families (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE CHECK(code IN ('pouch', 'tin', 'jar', 'carton', 'sachet', 'bag')),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- 5. Packaging Variants Table
    CREATE TABLE IF NOT EXISTS pl_packaging_variants (
      id TEXT PRIMARY KEY,
      family_id TEXT NOT NULL REFERENCES pl_packaging_families(id) ON DELETE RESTRICT,
      slug TEXT NOT NULL UNIQUE,
      sku TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      material TEXT NOT NULL,
      finish TEXT NOT NULL,
      closure_type TEXT NOT NULL,
      capacity_description TEXT NOT NULL,
      net_weight_capacity_grams REAL NOT NULL CHECK(net_weight_capacity_grams > 0),
      width_mm REAL NOT NULL CHECK(width_mm > 0),
      height_mm REAL NOT NULL CHECK(height_mm > 0),
      depth_mm REAL CHECK(depth_mm IS NULL OR depth_mm >= 0),
      label_safe_width_mm REAL NOT NULL CHECK(label_safe_width_mm > 0),
      label_safe_height_mm REAL NOT NULL CHECK(label_safe_height_mm > 0),
      supplier_name TEXT NOT NULL,
      supplier_sku TEXT,
      unit_cost_paise INTEGER NOT NULL CHECK(unit_cost_paise >= 0),
      lead_time_days INTEGER NOT NULL DEFAULT 14 CHECK(lead_time_days > 0),
      moq_units INTEGER NOT NULL DEFAULT 500 CHECK(moq_units > 0),
      order_multiple INTEGER NOT NULL DEFAULT 50 CHECK(order_multiple > 0),
      dieline_url TEXT,
      hero_image_url TEXT,
      image_illustrative INTEGER NOT NULL DEFAULT 1 CHECK(image_illustrative IN (0, 1)),
      status TEXT NOT NULL DEFAULT 'published' CHECK(status IN ('draft', 'published', 'archived')),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_pack_slug ON pl_packaging_variants(slug);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_pack_sku ON pl_packaging_variants(sku);
    CREATE INDEX IF NOT EXISTS idx_pl_pack_family ON pl_packaging_variants(family_id, status);
    CREATE INDEX IF NOT EXISTS idx_pl_pack_revision ON pl_packaging_variants(id, revision);

    -- 6. Print Methods Table
    CREATE TABLE IF NOT EXISTS pl_print_methods (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE CHECK(code IN ('paper_label', 'bopp_label', 'direct_digital', 'gravure', 'screen_print', 'sleeve')),
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      color_model TEXT NOT NULL CHECK(color_model IN ('cmyk', 'pantone', 'spot')),
      max_colors INTEGER NOT NULL DEFAULT 4 CHECK(max_colors > 0),
      setup_fee_paise INTEGER NOT NULL DEFAULT 0 CHECK(setup_fee_paise >= 0),
      cylinder_fee_per_color_paise INTEGER NOT NULL DEFAULT 0 CHECK(cylinder_fee_per_color_paise >= 0),
      min_order_units INTEGER NOT NULL DEFAULT 100 CHECK(min_order_units > 0),
      lead_time_days INTEGER NOT NULL DEFAULT 10 CHECK(lead_time_days > 0),
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_print_code ON pl_print_methods(code);

    -- 7. Packaging Compatibility Table & View
    CREATE TABLE IF NOT EXISTS pl_packaging_compatibility (
      id TEXT PRIMARY KEY,
      packaging_variant_id TEXT NOT NULL REFERENCES pl_packaging_variants(id) ON DELETE CASCADE,
      print_method_id TEXT NOT NULL REFERENCES pl_print_methods(id) ON DELETE CASCADE,
      is_supported INTEGER NOT NULL DEFAULT 1 CHECK(is_supported IN (0, 1)),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(packaging_variant_id, print_method_id)
    );
    CREATE INDEX IF NOT EXISTS idx_pl_compat_pack ON pl_packaging_compatibility(packaging_variant_id);
    CREATE INDEX IF NOT EXISTS idx_pl_compat_print ON pl_packaging_compatibility(print_method_id);
    CREATE VIEW IF NOT EXISTS pl_print_compatibility AS SELECT * FROM pl_packaging_compatibility;

    -- 8. MOQ Rules Table (Multi-dimensional data-driven order minima)
    CREATE TABLE IF NOT EXISTS pl_moq_rules (
      id TEXT PRIMARY KEY,
      rule_type TEXT NOT NULL CHECK(rule_type IN ('tea', 'packaging', 'print', 'global')),
      target_id TEXT,
      min_quantity REAL NOT NULL CHECK(min_quantity > 0),
      unit_basis TEXT NOT NULL CHECK(unit_basis IN ('kg', 'units', 'orders')),
      order_multiple INTEGER NOT NULL DEFAULT 1 CHECK(order_multiple > 0),
      min_order_value_paise INTEGER NOT NULL DEFAULT 0 CHECK(min_order_value_paise >= 0),
      effective_from TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      effective_to TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_moq_target ON pl_moq_rules(rule_type, target_id);

    -- 9. Price Books Table (Commercial strategy & cost defaults)
    CREATE TABLE IF NOT EXISTS pl_price_books (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      currency TEXT NOT NULL DEFAULT 'INR' CHECK(currency IN ('INR', 'USD', 'EUR', 'GBP')),
      is_default INTEGER NOT NULL DEFAULT 0 CHECK(is_default IN (0, 1)),
      effective_from TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      effective_to TEXT,
      margin_rate REAL NOT NULL DEFAULT 0.25 CHECK(margin_rate >= 0 AND margin_rate < 1.0),
      filling_labor_paise_per_unit INTEGER NOT NULL DEFAULT 300 CHECK(filling_labor_paise_per_unit >= 0),
      qc_charge_paise_per_batch INTEGER NOT NULL DEFAULT 250000 CHECK(qc_charge_paise_per_batch >= 0),
      contingency_rate REAL NOT NULL DEFAULT 0.05 CHECK(contingency_rate >= 0 AND contingency_rate < 0.5),
      loss_allowance_rate REAL NOT NULL DEFAULT 0.03 CHECK(loss_allowance_rate >= 0 AND loss_allowance_rate < 0.2),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('draft', 'active', 'archived')),
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_price_books_status ON pl_price_books(status, is_default);

    -- 10. Price Book Quantity Tiers Table
    CREATE TABLE IF NOT EXISTS pl_price_book_tiers (
      id TEXT PRIMARY KEY,
      price_book_id TEXT NOT NULL REFERENCES pl_price_books(id) ON DELETE CASCADE,
      item_type TEXT NOT NULL CHECK(item_type IN ('packaging', 'print_method', 'tea_markup')),
      item_id TEXT NOT NULL,
      min_qty INTEGER NOT NULL CHECK(min_qty >= 0),
      max_qty INTEGER CHECK(max_qty IS NULL OR max_qty >= min_qty),
      unit_price_paise INTEGER NOT NULL CHECK(unit_price_paise >= 0),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_tiers_lookup ON pl_price_book_tiers(price_book_id, item_type, item_id, min_qty);

    -- 11. Transactional Audit Trail Table
    CREATE TABLE IF NOT EXISTS pl_audit (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      revision INTEGER NOT NULL CHECK(revision >= 1),
      action TEXT NOT NULL,
      actor_type TEXT NOT NULL CHECK(actor_type IN ('admin', 'mcp', 'system', 'customer')),
      actor_id TEXT NOT NULL,
      actor_email TEXT,
      diff_json TEXT NOT NULL DEFAULT '{}',
      reason TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_pl_audit_entity ON pl_audit(entity_type, entity_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_pl_audit_actor ON pl_audit(actor_type, actor_id);
    CREATE INDEX IF NOT EXISTS idx_pl_audit_action ON pl_audit(action);
  `);
}

export function down(db) {
  if (!db) return;
  db.exec(`
    DROP VIEW IF EXISTS pl_print_compatibility;
    DROP TABLE IF EXISTS pl_audit;
    DROP TABLE IF EXISTS pl_price_book_tiers;
    DROP TABLE IF EXISTS pl_price_books;
    DROP TABLE IF EXISTS pl_moq_rules;
    DROP TABLE IF EXISTS pl_packaging_compatibility;
    DROP TABLE IF EXISTS pl_print_methods;
    DROP TABLE IF EXISTS pl_packaging_variants;
    DROP TABLE IF EXISTS pl_packaging_families;
    DROP TABLE IF EXISTS pl_tea_options;
    DROP TABLE IF EXISTS pl_brands;
    DROP TABLE IF EXISTS pl_clients;
  `);
}
