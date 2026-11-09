import pg from "pg";
const { Client } = pg;

const pgConfig = {
  host: process.env.PGHOST || "localhost",
  port: parseInt(process.env.PGPORT || "5433", 10),
  user: process.env.PGUSER || "teafloww",
  password: process.env.PGPASSWORD || "teafloww",
  database: process.env.PGDATABASE || "teafloww",
};

export async function runAllPgMigrations() {
  const client = new Client(pgConfig);
  await client.connect();
  console.log("Connected to PostgreSQL on port", pgConfig.port);

  try {
    const { rows: appliedRows } = await client.query("SELECT version FROM schema_migrations");
    const applied = new Set(appliedRows.map((r) => r.version));

    // Migration 034
    if (!applied.has("034_shiprocket_and_shipping_settings")) {
      console.log("Applying 034_shiprocket_and_shipping_settings...");
      await client.query("BEGIN");
      const defaults = [
        ["free_shipping_threshold_paise", "59900"],
        ["shipping_flat_fee_paise", "9900"],
        ["shipping_calculation_mode", "flat"],
        ["shiprocket_enabled", "1"],
        ["shiprocket_pickup_location", "Primary"],
        ["shiprocket_pickup_postcode", "734015"],
        ["shiprocket_default_length", "10"],
        ["shiprocket_default_breadth", "10"],
        ["shiprocket_default_height", "10"],
        ["shiprocket_default_tare_grams", "100"],
        ["shiprocket_default_hsn", "090230"],
        ["razorpay_enabled", "1"],
        ["cod_enabled", "1"],
        ["cod_fee_paise", "5000"],
        ["cod_min_paise", "0"],
        ["cod_max_paise", "100000"],
        ["announcement_auto_sync", "1"],
      ];
      for (const [key, val] of defaults) {
        await client.query(
          "INSERT INTO store_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO NOTHING",
          [key, val]
        );
      }
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["034_shiprocket_and_shipping_settings"]);
      await client.query("COMMIT");
      console.log("✓ Applied 034_shiprocket_and_shipping_settings");
    }

    // Migration 035 (Settings)
    if (!applied.has("035_test_prod_modes_and_auto_dispatch")) {
      console.log("Applying 035_test_prod_modes_and_auto_dispatch...");
      await client.query("BEGIN");
      const defaults = [
        ["payment_mode", "test"],
        ["shiprocket_mode", "test"],
        ["shiprocket_order_creation_mode", "manual"],
      ];
      for (const [key, val] of defaults) {
        await client.query(
          "INSERT INTO store_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO NOTHING",
          [key, val]
        );
      }
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["035_test_prod_modes_and_auto_dispatch"]);
      await client.query("COMMIT");
      console.log("✓ Applied 035_test_prod_modes_and_auto_dispatch");
    }

    // Migration 035 (Trials Schema)
    if (!applied.has("035_trials_v3")) {
      console.log("Applying 035_trials_v3...");
      await client.query("BEGIN");
      await client.query(`
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

        CREATE TABLE IF NOT EXISTS trial_sensory_tests (
          id TEXT PRIMARY KEY,
          trial_id TEXT NOT NULL REFERENCES trials(id) ON DELETE CASCADE,
          component_id TEXT REFERENCES trial_components(id) ON DELETE CASCADE,
          sample_id TEXT,
          lot_id TEXT,
          tester_name TEXT NOT NULL DEFAULT 'Tea Master / Q-Grader',
          tested_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          method TEXT NOT NULL DEFAULT 'ISO_3103_tasting',
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
      `);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["035_trials_v3"]);
      await client.query("COMMIT");
      console.log("✓ Applied 035_trials_v3");
    }

    // Migration 036 (Customer accounts)
    if (!applied.has("036_customer_accounts_and_addresses")) {
      console.log("Applying 036_customer_accounts_and_addresses...");
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS customers (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          phone TEXT DEFAULT NULL,
          name TEXT DEFAULT NULL,
          password_hash TEXT DEFAULT NULL,
          is_active INTEGER NOT NULL DEFAULT 1,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
        CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);

        CREATE TABLE IF NOT EXISTS customer_sessions (
          token_hash TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id);
        CREATE INDEX IF NOT EXISTS idx_customer_sessions_expires ON customer_sessions(expires_at);

        CREATE TABLE IF NOT EXISTS customer_addresses (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          phone TEXT NOT NULL,
          address_line1 TEXT NOT NULL,
          address_line2 TEXT DEFAULT '',
          landmark TEXT DEFAULT '',
          city TEXT NOT NULL,
          state TEXT NOT NULL,
          postal_code TEXT NOT NULL,
          country TEXT NOT NULL DEFAULT 'IN',
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer ON customer_addresses(customer_id);

        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='orders' AND column_name='customer_id'
          ) THEN
            ALTER TABLE orders ADD COLUMN customer_id TEXT DEFAULT NULL;
            CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
          END IF;
        END $$;
      `);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["036_customer_accounts_and_addresses"]);
      await client.query("COMMIT");
      console.log("✓ Applied 036_customer_accounts_and_addresses");
    }

    // Migration 037 (Tea Moments)
    if (!applied.has("037_tea_moments")) {
      console.log("Applying 037_tea_moments...");
      await client.query("BEGIN");
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name='products' AND column_name='tea_moments'
          ) THEN
            ALTER TABLE products ADD COLUMN tea_moments TEXT DEFAULT NULL;
          END IF;
        END $$;
      `);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["037_tea_moments"]);
      await client.query("COMMIT");
      console.log("✓ Applied 037_tea_moments");
    }

    // Migration 038 (Subscriptions)
    if (!applied.has("038_product_subscriptions")) {
      console.log("Applying 038_product_subscriptions...");
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS tea_subscriptions (
          id TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL REFERENCES customers(id),
          enrollment_key TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'active',
          document TEXT NOT NULL,
          next_ms BIGINT NOT NULL,
          revision INTEGER NOT NULL DEFAULT 1,
          created_ms BIGINT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS tea_subscriptions_due ON tea_subscriptions(status, next_ms);
        CREATE INDEX IF NOT EXISTS tea_subscriptions_customer ON tea_subscriptions(customer_id);

        CREATE TABLE IF NOT EXISTS tea_subscription_cycles (
          id TEXT PRIMARY KEY,
          subscription_id TEXT NOT NULL REFERENCES tea_subscriptions(id),
          sequence INTEGER NOT NULL,
          due_ms BIGINT NOT NULL,
          status TEXT NOT NULL DEFAULT 'draft',
          method TEXT NOT NULL,
          order_id TEXT UNIQUE REFERENCES commerce_orders(id),
          quote_id TEXT REFERENCES commerce_quotes(id),
          generation INTEGER NOT NULL DEFAULT 0,
          revision INTEGER NOT NULL DEFAULT 1,
          lease_ms BIGINT NOT NULL DEFAULT 0,
          blocked_reason TEXT NOT NULL DEFAULT '',
          created_ms BIGINT NOT NULL,
          UNIQUE(subscription_id, sequence)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS tea_subscription_one_open ON tea_subscription_cycles(subscription_id)
          WHERE status IN ('draft','awaiting_payment','ready','dispatching','change_pending','exception');

        CREATE TABLE IF NOT EXISTS tea_trial_reservations (
          order_id TEXT NOT NULL REFERENCES commerce_orders(id),
          trial_id TEXT NOT NULL REFERENCES trials(id),
          quantity INTEGER NOT NULL,
          PRIMARY KEY(order_id, trial_id)
        );

        CREATE TABLE IF NOT EXISTS tea_subscription_events (
          id TEXT PRIMARY KEY,
          subscription_id TEXT NOT NULL REFERENCES tea_subscriptions(id),
          action TEXT NOT NULL,
          document TEXT NOT NULL,
          created_ms BIGINT NOT NULL
        );

        INSERT INTO commerce_config (key, document) VALUES ('subscriptions', '{"enabled":false,"renewalsEnabled":true,"baseBps":0,"prepaidBps":0,"version":1}') ON CONFLICT(key) DO NOTHING;
      `);
      const subTemplateText = 'Hello {{customer_name}},\n\nYour TeaFloww subscription renewal is scheduled for {{dispatch_date}}. Review the exact total, pay online, choose eligible COD, skip or manage your subscription here:\n{{renewal_url}}\n\nPrepaid renewals require payment each time; there is no automatic debit. Delivery fees apply under the current shipping policy.\n\nTeaFloww';
      await client.query(
        "INSERT INTO email_templates (key, label, description, subject, html_body, text_body, variables_json) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (key) DO NOTHING",
        ['subscription_renewal', 'Subscription renewal', 'Manual-pay renewal and subscription management', 'Your TeaFloww subscription renewal', '<p>Hello {{customer_name}},</p><p>Your renewal is scheduled for {{dispatch_date}}.</p><p><a href="{{renewal_url}}">Review, pay or manage your subscription</a></p><p>No automatic debit. Shipping fees apply.</p>', subTemplateText, JSON.stringify(['customer_name','dispatch_date','renewal_url'])]
      );
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["038_product_subscriptions"]);
      await client.query("COMMIT");
      console.log("✓ Applied 038_product_subscriptions");
    }

    // Migration 039 (India market activation & package config)
    if (!applied.has("039_activate_india_market_and_package_config")) {
      console.log("Applying 039_activate_india_market_and_package_config...");
      await client.query("BEGIN");
      const pkg = {
        pickupPostcode: "734015",
        pickupLocation: "Siliguri Main Hub",
        length: 12,
        breadth: 12,
        height: 12,
        tareGrams: 120,
        maxGrams: 50000,
        hsn: "090230",
        origin: "IN",
      };
      await client.query(
        "INSERT INTO commerce_config (key, document) VALUES ('package', $1) ON CONFLICT (key) DO UPDATE SET document = EXCLUDED.document",
        [JSON.stringify(pkg)]
      );

      const inRes = await client.query("SELECT document FROM commerce_markets WHERE code = 'IN'");
      if (inRes.rows.length > 0 && inRes.rows[0].document) {
        const doc = typeof inRes.rows[0].document === "string" ? JSON.parse(inRes.rows[0].document) : inRes.rows[0].document;
        doc.covered = true;
        doc.enabled = true;
        doc.taxApproved = true;
        doc.exportApproved = true;
        doc.taxPercent = doc.taxPercent || 5;
        doc.taxInclusive = true;
        doc.shipping = doc.shipping || "flat";
        doc.flatPaise = doc.flatPaise || 9900;
        doc.freeAbovePaise = doc.freeAbovePaise || 59900;
        if (!doc.cod) {
          doc.cod = { enabled: true, postcodes: [], minPaise: 0, maxPaise: 500000, feePaise: 5000, blockedSkus: [] };
        } else {
          doc.cod.enabled = true;
          doc.cod.feePaise = doc.cod.feePaise ?? 5000;
        }
        await client.query(
          "UPDATE commerce_markets SET document = $1, version = version + 1 WHERE code = 'IN'",
          [JSON.stringify(doc)]
        );
      }

      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["039_activate_india_market_and_package_config"]);
      await client.query("COMMIT");
      console.log("✓ Applied 039_activate_india_market_and_package_config");
    }

    // Migration 040 (Featured Harvest Card Content)
    if (!applied.has("040_slider_card_content")) {
      console.log("Applying 040_slider_card_content...");
      await client.query("BEGIN");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS card_tag TEXT NOT NULL DEFAULT '';");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS card_title TEXT NOT NULL DEFAULT '';");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS card_subtitle TEXT NOT NULL DEFAULT '';");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS card_tasting_notes TEXT NOT NULL DEFAULT '';");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS card_quote TEXT NOT NULL DEFAULT '';");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS card_badge TEXT NOT NULL DEFAULT '';");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS card_cta_label TEXT NOT NULL DEFAULT '';");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS card_cta_href TEXT NOT NULL DEFAULT '';");

      await client.query(`
        UPDATE sliders SET
          card_tag = '2026 First Flush · Margaret''s Hope',
          card_title = 'Darjeeling First Flush',
          card_subtitle = 'Single Estate · 6,800 ft',
          card_tasting_notes = 'Muscatel • Wild Orchid • Crisp Finish',
          card_quote = 'From Our Gardens to Your Cup',
          card_badge = 'ESTATE HARVEST',
          card_cta_label = 'View Harvest',
          card_cta_href = '/collections/darjeeling'
        WHERE id = 1 AND (card_title IS NULL OR card_title = '');
      `);

      await client.query(`
        UPDATE sliders SET
          card_tag = 'Reserve Lot 04 · Giddapahar Estate',
          card_title = 'High-Altitude Oolong',
          card_subtitle = '7,200 ft Elevation',
          card_tasting_notes = 'Roasted Walnut • Peach Blossom • Honeyed',
          card_quote = 'Origin Cupping & Ceremony',
          card_badge = 'HIGH TERROIR',
          card_cta_label = 'View Harvest',
          card_cta_href = '/shop?category=Black%20Tea'
        WHERE id = 2 AND (card_title IS NULL OR card_title = '');
      `);

      await client.query(`
        UPDATE sliders SET
          card_tag = 'Heritage Clonal · Upper Assam',
          card_title = 'Himalayan Gold Black',
          card_subtitle = 'Heritage Garden Orthodox',
          card_tasting_notes = 'Malt • Dark Cocoa • Wildflower Honey',
          card_quote = 'Crafted by Master Planters',
          card_badge = 'LIMITED FLUSH',
          card_cta_label = 'View Harvest',
          card_cta_href = '/shop?category=Green%20Tea'
        WHERE id = 3 AND (card_title IS NULL OR card_title = '');
      `);

      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["040_slider_card_content"]);
      await client.query("COMMIT");
      console.log("✓ Applied 040_slider_card_content");
    }

    // Migration 041 (Card Enabled Toggle)
    if (!applied.has("041_slider_card_enabled")) {
      console.log("Applying 041_slider_card_enabled...");
      await client.query("BEGIN");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS card_enabled INTEGER NOT NULL DEFAULT 1;");
      await client.query("UPDATE sliders SET card_enabled = 0 WHERE id = 2;");
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["041_slider_card_enabled"]);
      await client.query("COMMIT");
      console.log("✓ Applied 041_slider_card_enabled");
    }

    // Migration 042 (Chapter Label & Clean Button Text/Links)
    if (!applied.has("042_slider_chapter_label")) {
      console.log("Applying 042_slider_chapter_label...");
      await client.query("BEGIN");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS chapter_label TEXT NOT NULL DEFAULT '';");

      await client.query(`
        UPDATE sliders SET
          chapter_label = '01. Darjeeling First Flush',
          cta_label = CASE WHEN cta_label = 'From Our Gardens to Your Cup' THEN 'Shop Darjeeling First Flush' ELSE cta_label END,
          cta_href = CASE WHEN cta_href = '/shop' OR cta_href = '' THEN '/collections/darjeeling' ELSE cta_href END,
          card_cta_label = CASE WHEN card_cta_label = '' THEN 'View Harvest' ELSE card_cta_label END,
          card_cta_href = CASE WHEN card_cta_href = '/shop' OR card_cta_href = '' THEN '/collections/darjeeling' ELSE card_cta_href END
        WHERE id = 1;
      `);

      await client.query(`
        UPDATE sliders SET
          chapter_label = '02. High-Altitude Oolong',
          cta_label = CASE WHEN cta_label = 'Origin Cupping & Ceremony' THEN 'Explore High Terroirs' ELSE cta_label END
        WHERE id = 2;
      `);

      await client.query(`
        UPDATE sliders SET
          chapter_label = '03. Himalayan Gold Black',
          cta_label = CASE WHEN cta_label = 'Crafted by Master Planters' THEN 'Discover Clonal Teas' ELSE cta_label END
        WHERE id = 3;
      `);

      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["042_slider_chapter_label"]);
      await client.query("COMMIT");
      console.log("✓ Applied 042_slider_chapter_label");
    }

    // Migration 043 (Page Target & Category Scope for /shop dynamic sliders)
    if (!applied.has("043_slider_page_target")) {
      console.log("Applying 043_slider_page_target...");
      await client.query("BEGIN");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS page_target TEXT NOT NULL DEFAULT 'home';");
      await client.query("ALTER TABLE sliders ADD COLUMN IF NOT EXISTS category_slug TEXT NOT NULL DEFAULT '';");

      const checkShop = await client.query("SELECT id FROM sliders WHERE page_target = 'shop'");
      if (checkShop.rows.length === 0) {
        await client.query(`
          INSERT INTO sliders (
            title, subtitle, image_url, fg_image_url, cta_label, cta_href,
            sort_order, is_active, starts_at, ends_at,
            card_tag, card_title, card_subtitle, card_tasting_notes, card_quote, card_badge, card_cta_label, card_cta_href,
            card_enabled, chapter_label, page_target, category_slug
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18,
            $19, $20, $21, $22
          )
        `, [
          "Fine Tea Collection — Single-Estate Flushes",
          "Explore pure, single-estate flushes from Darjeeling, Assam, Kangra, and Nilgiri. Graded, cupped, and packaged at origin to preserve high-mountain aromatics.",
          "/uploads/hero-himalayan-tea.webp",
          "/uploads/darjeeling-spring-hero-v2.webp",
          "Explore Single Estates",
          "/shop",
          1,
          1,
          null,
          null,
          "2026 Fresh Origin Batches",
          "Single-Estate Harvests",
          "Himalayan High Terroirs",
          "Authentic Orthodoxy • High Mountain",
          "From Our Gardens to Your Cup",
          "CURATED COLLECTION",
          "Browse Collection",
          "/shop",
          1,
          "01. Fine Tea Collection",
          "shop",
          ""
        ]);
      }

      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["043_slider_page_target"]);
      await client.query("COMMIT");
      console.log("✓ Applied 043_slider_page_target");
    }

    console.log("All PostgreSQL migrations are completely up to date!");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith("apply-all-pg-migrations.mjs")) {
  runAllPgMigrations().catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  });
}
