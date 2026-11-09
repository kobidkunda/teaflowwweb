/**
 * Migration 035: TeaFloww Trials v3 Normalized Data Architecture
 *
 * Implements Milestone 1 schema for TeaFloww Trials v3:
 * 1. trials - Main trial dossier, status lifecycle, revision CAS concurrency
 * 2. trial_components - 4x50g sachets, slot_index (0..3), provenance, brew parameters
 * 3. trial_assets - Optical Studio 5-stage media (packaging, dry_leaf, infused_leaf, liquor, milk_tea)
 * 4. trial_brew_guides - Kettle testing protocols and brewing parameters
 * 5. trial_sensory_tests - Sensory Bento with verified measurement provenance
 * 6. trial_claims - Regulatory & FSSAI evidence register to block unverified claims
 * 7. trial_bulk_links - Bulk conversion ladder linked to regular catalogue variants
 * 8. trial_publications - Point-in-time immutable JSON snapshots on publication
 * 9. trial_audit - Append-only transactional audit trail for Admin and MCP parity
 *
 * Compatible with `scripts/migrate.mjs` (better-sqlite3, WAL mode, foreign keys enabled).
 */

export function up(db) {
  db.exec(`
    -- 1. Trials Master Table
    CREATE TABLE IF NOT EXISTS trials (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      tagline TEXT,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'in_review', 'published', 'archived')),
      pack_format TEXT NOT NULL DEFAULT '4x50g_sachets' CHECK(pack_format = '4x50g_sachets'),
      net_weight_g INTEGER NOT NULL DEFAULT 200 CHECK(net_weight_g = 200),
      price_paise INTEGER NOT NULL DEFAULT 20000 CHECK(price_paise >= 0),
      compare_at_price_paise INTEGER CHECK(compare_at_price_paise IS NULL OR compare_at_price_paise >= 0),
      cost_paise INTEGER CHECK(cost_paise IS NULL OR cost_paise >= 0),
      sku TEXT NOT NULL UNIQUE,
      inventory_quantity INTEGER NOT NULL DEFAULT 0 CHECK(inventory_quantity >= 0),
      inventory_policy TEXT NOT NULL DEFAULT 'track' CHECK(inventory_policy IN ('track', 'continue')),
      hero_image_id INTEGER REFERENCES media_uploads(id) ON DELETE SET NULL,
      meta_title TEXT,
      meta_description TEXT,
      revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      published_at TEXT,
      archived_at TEXT
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_trials_slug ON trials(slug);
    CREATE INDEX IF NOT EXISTS idx_trials_status ON trials(status, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trials_public ON trials(status, published_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trials_revision ON trials(id, revision);
    CREATE INDEX IF NOT EXISTS idx_trials_created ON trials(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trials_hero_image ON trials(hero_image_id);

    -- 2. Trial Components Table (4x50g sachets)
    CREATE TABLE IF NOT EXISTS trial_components (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
      slot_index INTEGER NOT NULL CHECK(slot_index BETWEEN 0 AND 3),
      name TEXT NOT NULL,
      estate TEXT NOT NULL DEFAULT '',
      grade TEXT NOT NULL DEFAULT '',
      flush TEXT NOT NULL DEFAULT '',
      elevation TEXT,
      weight_g INTEGER NOT NULL DEFAULT 50 CHECK(weight_g = 50),
      quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity = 1),
      tasting_notes TEXT NOT NULL DEFAULT '[]',
      brew_temp_c INTEGER NOT NULL DEFAULT 95 CHECK(brew_temp_c > 0),
      brew_time_sec INTEGER NOT NULL DEFAULT 240 CHECK(brew_time_sec > 0),
      leaf_dose_g REAL NOT NULL DEFAULT 2.5 CHECK(leaf_dose_g > 0),
      regular_product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
      regular_variant_id INTEGER REFERENCES variants(id) ON DELETE SET NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(trial_id, slot_index)
    );

    CREATE INDEX IF NOT EXISTS idx_trial_components_trial_slot ON trial_components(trial_id, slot_index);
    CREATE INDEX IF NOT EXISTS idx_trial_components_regular_variant ON trial_components(regular_variant_id);
    CREATE INDEX IF NOT EXISTS idx_trial_components_regular_product ON trial_components(regular_product_id);

    -- 3. Trial Assets Table (Optical Studio 5-stage photography)
    CREATE TABLE IF NOT EXISTS trial_assets (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
      component_id TEXT REFERENCES trial_components(id) ON DELETE CASCADE,
      slot_index INTEGER CHECK(slot_index IS NULL OR (slot_index BETWEEN 0 AND 3)),
      media_id INTEGER REFERENCES media_uploads(id) ON DELETE SET NULL,
      asset_url TEXT NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('packaging', 'dry_leaf', 'infused_leaf', 'liquor', 'milk_tea', 'hero', 'gallery')),
      alt_text TEXT NOT NULL DEFAULT '',
      caption TEXT DEFAULT '',
      rights_status TEXT NOT NULL DEFAULT 'approved' CHECK(rights_status IN ('pending', 'approved', 'rejected')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_trial_assets_trial_stage ON trial_assets(trial_id, stage);
    CREATE INDEX IF NOT EXISTS idx_trial_assets_component_stage ON trial_assets(component_id, stage);
    CREATE INDEX IF NOT EXISTS idx_trial_assets_slot_stage ON trial_assets(trial_id, slot_index, stage);
    CREATE INDEX IF NOT EXISTS idx_trial_assets_media ON trial_assets(media_id);

    -- 4. Trial Brew Guides Table (Kettle Testing Protocol)
    CREATE TABLE IF NOT EXISTS trial_brew_guides (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
      component_id TEXT REFERENCES trial_components(id) ON DELETE CASCADE,
      protocol_name TEXT NOT NULL DEFAULT 'standard_kettle',
      tea_dose_g REAL NOT NULL DEFAULT 2.5 CHECK(tea_dose_g > 0),
      water_ml INTEGER NOT NULL DEFAULT 100 CHECK(water_ml > 0),
      milk_ml INTEGER NOT NULL DEFAULT 100 CHECK(milk_ml >= 0),
      sugar_g REAL NOT NULL DEFAULT 0 CHECK(sugar_g >= 0),
      temp_c INTEGER NOT NULL DEFAULT 95 CHECK(temp_c > 0),
      steep_time_sec INTEGER NOT NULL DEFAULT 240 CHECK(steep_time_sec > 0),
      steps_json TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_trial_brew_guides_trial ON trial_brew_guides(trial_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_trial_brew_guides_component ON trial_brew_guides(component_id);

    -- 5. Trial Sensory Tests Table (Sensory Bento & Lab Provenance)
    CREATE TABLE IF NOT EXISTS trial_sensory_tests (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
      component_id TEXT REFERENCES trial_components(id) ON DELETE CASCADE,
      sample_id TEXT,
      lot_id TEXT,
      tester_name TEXT NOT NULL DEFAULT 'Tea Master / Q-Grader',
      tested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      method TEXT NOT NULL DEFAULT 'ISO_3103_tasting' ,
      aroma_score REAL CHECK(aroma_score IS NULL OR (aroma_score >= 0 AND aroma_score <= 10)),
      body_score REAL CHECK(body_score IS NULL OR (body_score >= 0 AND body_score <= 10)),
      briskness_score REAL CHECK(briskness_score IS NULL OR (briskness_score >= 0 AND briskness_score <= 10)),
      astringency_score REAL CHECK(astringency_score IS NULL OR (astringency_score >= 0 AND astringency_score <= 10)),
      finish_score REAL CHECK(finish_score IS NULL OR (finish_score >= 0 AND finish_score <= 10)),
      milk_performance_score REAL CHECK(milk_performance_score IS NULL OR (milk_performance_score >= 0 AND milk_performance_score <= 10)),
      color_hex TEXT,
      metrics_json TEXT NOT NULL DEFAULT '{}',
      verified INTEGER NOT NULL DEFAULT 1 CHECK(verified IN (0, 1)),
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_trial_sensory_trial ON trial_sensory_tests(trial_id);
    CREATE INDEX IF NOT EXISTS idx_trial_sensory_component ON trial_sensory_tests(component_id);

    -- 6. Trial Claims Table (Evidence Register for Truthful Commerce)
    CREATE TABLE IF NOT EXISTS trial_claims (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
      claim_type TEXT NOT NULL CHECK(claim_type IN ('origin', 'fssai_licence', 'tea_board', 'ingredient', 'sensory', 'economic', 'operational', 'sourcing')),
      label TEXT NOT NULL,
      claim_text TEXT NOT NULL,
      basis TEXT NOT NULL DEFAULT '',
      evidence_ref TEXT,
      verified INTEGER NOT NULL DEFAULT 0 CHECK(verified IN (0, 1)),
      approved_by TEXT,
      approved_at TEXT,
      expires_at TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_trial_claims_trial ON trial_claims(trial_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_trial_claims_verified ON trial_claims(trial_id, verified);
    CREATE INDEX IF NOT EXISTS idx_trial_claims_type ON trial_claims(claim_type);

    -- 7. Trial Bulk Links Table (Conversion Ladder to Regular Variants)
    CREATE TABLE IF NOT EXISTS trial_bulk_links (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
      component_id TEXT REFERENCES trial_components(id) ON DELETE CASCADE,
      product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
      variant_id INTEGER REFERENCES variants(id) ON DELETE CASCADE,
      pack_size_grams INTEGER NOT NULL CHECK(pack_size_grams > 0),
      display_label TEXT NOT NULL DEFAULT '',
      discount_percent REAL NOT NULL DEFAULT 0 CHECK(discount_percent >= 0 AND discount_percent <= 100),
      subscriber_eligible INTEGER NOT NULL DEFAULT 0 CHECK(subscriber_eligible IN (0, 1)),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_trial_bulk_trial ON trial_bulk_links(trial_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_trial_bulk_component ON trial_bulk_links(component_id);
    CREATE INDEX IF NOT EXISTS idx_trial_bulk_variant ON trial_bulk_links(variant_id);

    -- 8. Trial Publications Table (Immutable Point-in-time Snapshots)
    CREATE TABLE IF NOT EXISTS trial_publications (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
      revision INTEGER NOT NULL CHECK(revision >= 1),
      snapshot_json TEXT NOT NULL,
      published_by TEXT NOT NULL,
      published_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
      unregistered_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_trial_pub_trial_rev ON trial_publications(trial_id, revision);
    CREATE INDEX IF NOT EXISTS idx_trial_pub_active ON trial_publications(trial_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_trial_pub_published_at ON trial_publications(published_at DESC);

    -- 9. Trial Audit Table (Admin & MCP Unified Audit History)
    CREATE TABLE IF NOT EXISTS trial_audit (
      id TEXT PRIMARY KEY,
      trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
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

    CREATE INDEX IF NOT EXISTS idx_trial_audit_trial_created ON trial_audit(trial_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trial_audit_revision ON trial_audit(trial_id, revision);
    CREATE INDEX IF NOT EXISTS idx_trial_audit_action ON trial_audit(action);
    CREATE INDEX IF NOT EXISTS idx_trial_audit_actor ON trial_audit(actor_type, actor_id);

    -- DB Trigger: Enforce 200g weight invariant on publication
    CREATE TRIGGER IF NOT EXISTS trg_trials_publish_weight_check
    BEFORE UPDATE OF status ON trials
    FOR EACH ROW
    WHEN NEW.status = 'published'
    BEGIN
      SELECT CASE
        WHEN (SELECT COALESCE(SUM(weight_g * quantity), 0) FROM trial_components WHERE trial_id = NEW.id) != 200
        THEN RAISE(ABORT, 'Cannot publish trial: component weights must sum to exactly 200g (4x50g)')
      END;
    END;

    -- DB Trigger: Guard against direct insertion with status = 'published'
    CREATE TRIGGER IF NOT EXISTS trg_trials_publish_insert_guard
    BEFORE INSERT ON trials
    FOR EACH ROW
    WHEN NEW.status = 'published'
    BEGIN
      SELECT RAISE(ABORT, 'Cannot insert trial directly as published: must start as draft');
    END;
  `);
}

export function down(db) {
  if (!db) return;
  db.exec(`
    DROP TRIGGER IF EXISTS trg_trials_publish_insert_guard;
    DROP TRIGGER IF EXISTS trg_trials_publish_weight_check;

    DROP TABLE IF EXISTS trial_audit;
    DROP TABLE IF EXISTS trial_publications;
    DROP TABLE IF EXISTS trial_bulk_links;
    DROP TABLE IF EXISTS trial_claims;
    DROP TABLE IF EXISTS trial_sensory_tests;
    DROP TABLE IF EXISTS trial_brew_guides;
    DROP TABLE IF EXISTS trial_assets;
    DROP TABLE IF EXISTS trial_components;
    DROP TABLE IF EXISTS trials;
  `);
}
