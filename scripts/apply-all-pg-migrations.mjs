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

    // Migration 044 (Product PDF Attachment)
    if (!applied.has("044_product_pdf_attachment")) {
      console.log("Applying 044_product_pdf_attachment...");
      await client.query("BEGIN");
      await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS pdf_url TEXT DEFAULT NULL;");
      await client.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS pdf_title TEXT DEFAULT NULL;");
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["044_product_pdf_attachment"]);
      await client.query("COMMIT");
      console.log("✓ Applied 044_product_pdf_attachment");
    }

    // Migration 045 (Private Label Core Catalog & Rules)
    if (!applied.has("045_private_label_core")) {
      console.log("Applying 045_private_label_core...");
      await client.query("BEGIN");
      await client.query(`
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

        CREATE TABLE IF NOT EXISTS pl_packaging_families (
          id TEXT PRIMARY KEY,
          code TEXT NOT NULL UNIQUE CHECK(code IN ('pouch', 'tin', 'jar', 'carton', 'sachet', 'bag')),
          name TEXT NOT NULL,
          description TEXT NOT NULL,
          sort_order INTEGER NOT NULL DEFAULT 0,
          is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

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
        CREATE OR REPLACE VIEW pl_print_compatibility AS SELECT * FROM pl_packaging_compatibility;

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

        -- Seed Packaging Families
        INSERT INTO pl_packaging_families (id, code, name, description, sort_order, is_active)
        VALUES
          ('fam_pouch', 'pouch', 'Stand-Up & Flat Pouches', 'Flexible high-barrier pouches with zip closures', 1, 1),
          ('fam_tin', 'tin', 'Artisanal Metal Tins', 'Food-grade tinplate containers with inner slip lids', 2, 1),
          ('fam_jar', 'jar', 'Apothecary Glass & PET Jars', 'Cylindrical clear and amber jars with airtight caps', 3, 1),
          ('fam_carton', 'carton', 'Luxury Rigid & Folding Cartons', 'Custom printed folding boxboard cartons', 4, 1),
          ('fam_sachet', 'sachet', 'Single-Serve Envelopes & Sachets', 'Individually sealed luxury pyramid sachets', 5, 1),
          ('fam_bag', 'bag', 'Bulk Kraft & Foil Liners', 'Master food-service bags for bulk leaves', 6, 1)
        ON CONFLICT (id) DO NOTHING;

        -- Seed Print Methods
        INSERT INTO pl_print_methods (id, code, name, description, color_model, max_colors, setup_fee_paise, cylinder_fee_per_color_paise, min_order_units, lead_time_days, is_active)
        VALUES
          ('pm_paper_label', 'paper_label', 'Premium Paper Label', 'Matte uncoated textured label', 'cmyk', 4, 50000, 0, 100, 14, 1),
          ('pm_bopp_label', 'bopp_label', 'Waterproof BOPP Label', 'Polypropylene high-tack moisture label', 'cmyk', 6, 100000, 0, 250, 14, 1),
          ('pm_direct_digital', 'direct_digital', 'Direct Digital Print', 'High-resolution digital roll-fed pouch print', 'cmyk', 8, 150000, 0, 500, 14, 1),
          ('pm_gravure', 'gravure', 'Rotogravure Cylinder Print', 'Industrial high-speed film gravure print', 'spot', 10, 500000, 800000, 5000, 14, 1),
          ('pm_screen_print', 'screen_print', 'Rotary Screen Print', 'Spot screen printing for metal and glass', 'spot', 3, 200000, 0, 1000, 14, 1),
          ('pm_sleeve', 'sleeve', 'Shrink Sleeve', 'Full-body contour shrink sleeve', 'cmyk', 8, 300000, 0, 1000, 14, 1)
        ON CONFLICT (id) DO NOTHING;

        -- Seed Default Price Book
        INSERT INTO pl_price_books (id, name, currency, is_default, margin_rate, filling_labor_paise_per_unit, qc_charge_paise_per_batch, contingency_rate, loss_allowance_rate, status, revision)
        VALUES
          ('pb_default_inr', 'Default INR Price Book 2026', 'INR', 1, 0.25, 300, 250000, 0.05, 0.03, 'active', 1)
        ON CONFLICT (id) DO NOTHING;

        -- Seed Standard Packaging Variants
        INSERT INTO pl_packaging_variants (
          id, family_id, slug, sku, title, material, finish, closure_type, capacity_description,
          net_weight_capacity_grams, width_mm, height_mm, depth_mm, label_safe_width_mm, label_safe_height_mm,
          supplier_name, supplier_sku, unit_cost_paise, lead_time_days, moq_units, order_multiple,
          dieline_url, hero_image_url, image_illustrative, status, revision
        ) VALUES
          ('pack_pouch_mbk_250g', 'fam_pouch', 'stand-up-pouch-matte-black-250g', 'PL-PC-250-MBK', 'Stand-Up Pouch Matte Black 250g', 'Kraft / Foil Barrier', 'Soft-Touch Matte', 'Resealable Grip Zipper', '250g Retail', 250, 160, 230, 90, 120, 150, 'EcoBarrier Pack India', 'EBP-MBK-250', 1850, 14, 500, 50, '/dielines/standup-pouch-250g.pdf', '/images/packaging/pouch-matte-black.png', 1, 'published', 1),
          ('pack_tin_caddy_100g', 'fam_tin', 'metal-tin-caddy-100g', 'PL-TN-100-SLV', 'Artisanal Metal Tin Caddy 100g', 'Food-Grade Tinplate', 'Brushed Metallic', 'Inner Slip Lid', '100g Standard', 100, 85, 120, 85, 260, 100, 'Siliguri Tin Crafts', 'STC-100-SLV', 3200, 18, 250, 25, '/dielines/tin-caddy-100g.pdf', '/images/packaging/tin-silver.png', 1, 'published', 1),
          ('pack_jar_amber_150g', 'fam_jar', 'amber-glass-jar-150g', 'PL-JR-150-AMB', 'Amber Glass Apothecary Jar 150g', 'USP Type III Amber Glass', 'UV Protective Amber', 'Airtight Bakelite Lid', '150g Apothecary', 150, 75, 110, 75, 220, 80, 'Bengal Glass Works', 'BGW-AMB-150', 4500, 14, 200, 20, '/dielines/amber-jar-150g.pdf', '/images/packaging/jar-amber.png', 1, 'published', 1),
          ('pack_carton_rigid_100g', 'fam_carton', 'luxury-rigid-carton-100g', 'PL-CT-100-RGD', 'Luxury Rigid Presentation Carton', '1200gsm Greyboard with FSC Artpaper Wrap', 'Soft-Touch Matte Laminate', 'Magnetic Snap Lid', '100g Gift Box', 100, 100, 140, 60, 90, 130, 'Premier Box Siliguri', 'PBS-RGD-100', 6500, 21, 300, 25, '/dielines/rigid-carton-100g.pdf', '/images/packaging/carton-luxury.png', 1, 'published', 1),
          ('pack_sachet_pyramid_20', 'fam_sachet', 'pyramid-sachet-envelope-20ct', 'PL-SC-020-ENV', 'Single-Serve Pyramid Envelopes (20ct)', 'Biodegradable Soilon Mesh in Foil Envelope', 'Matte Soft Foil', 'Heat Sealed Individual Envelope', '20 Sachets (50g)', 50, 120, 180, 40, 100, 150, 'Himalayan Packtech', 'HPT-SC-020', 2800, 14, 500, 50, '/dielines/sachet-envelope-20ct.pdf', '/images/packaging/sachet-envelopes.png', 1, 'published', 1)
        ON CONFLICT (id) DO NOTHING;

        -- Seed Packaging Compatibility
        INSERT INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported, notes)
        VALUES
          ('c_pouch_digital', 'pack_pouch_mbk_250g', 'pm_direct_digital', 1, 'Direct roll-fed printing'),
          ('c_pouch_paper', 'pack_pouch_mbk_250g', 'pm_paper_label', 1, 'Matte paper label appliqué'),
          ('c_pouch_bopp', 'pack_pouch_mbk_250g', 'pm_bopp_label', 1, 'Waterproof synthetic label'),
          ('c_tin_paper', 'pack_tin_caddy_100g', 'pm_paper_label', 1, 'Full-wrap body label'),
          ('c_tin_bopp', 'pack_tin_caddy_100g', 'pm_bopp_label', 1, 'Moisture-resistant label'),
          ('c_tin_screen', 'pack_tin_caddy_100g', 'pm_screen_print', 1, 'Direct metal screen print'),
          ('c_jar_paper', 'pack_jar_amber_150g', 'pm_paper_label', 1, 'Textured apothecary label'),
          ('c_jar_bopp', 'pack_jar_amber_150g', 'pm_bopp_label', 1, 'Moisture-resistant clear label'),
          ('c_jar_screen', 'pack_jar_amber_150g', 'pm_screen_print', 1, 'Ceramic screen bake'),
          ('c_carton_digital', 'pack_carton_rigid_100g', 'pm_direct_digital', 1, 'Sheet-fed digital litho'),
          ('c_carton_screen', 'pack_carton_rigid_100g', 'pm_screen_print', 1, 'Spot UV screen embellishment'),
          ('c_sachet_digital', 'pack_sachet_pyramid_20', 'pm_direct_digital', 1, 'Digital envelope print'),
          ('c_sachet_paper', 'pack_sachet_pyramid_20', 'pm_paper_label', 1, 'Label seal sticker'),
          ('c_sachet_bopp', 'pack_sachet_pyramid_20', 'pm_bopp_label', 1, 'Synthetic tamper seal')
        ON CONFLICT (id) DO NOTHING;

        -- Seed Standard Tea Sourcing Options
        INSERT INTO pl_tea_options (
          id, slug, name, origin_estate, region, grade, flush, tea_category,
          description, caffeine_level, base_cost_per_kg_paise, min_batch_kg,
          tasting_notes_json, is_published, sample_available, revision
        ) VALUES
          ('tea_dj_ff', 'darjeeling-first-flush', 'Darjeeling First Flush FTGFOP1', 'Risheehat / Arya', 'Darjeeling', 'FTGFOP1', 'First Flush', 'black', 'Unblended single-estate spring harvest orthodox black tea with vibrant floral aroma and muscatel grape notes.', 'medium', 350000, 5.0, '["Muscatel", "Wild Honey", "Spring Peach"]', 1, 1, 1),
          ('tea_assam_ctc', 'assam-ctc-gold', 'Assam CTC Premium Granules', 'Mokalbari / Doomni', 'Assam', 'BOP', 'Second Flush', 'chai_blend', 'Bold, malty second-flush Assam granular tea crafted for full-bodied milk chai applications.', 'high', 85000, 10.0, '["Malty", "Dark Cocoa", "Full-Bodied"]', 1, 1, 1),
          ('tea_him_green', 'himalayan-green-leaf', 'Himalayan High-Mountain Green', 'Kangra Valley', 'Himachal', 'Special Green', 'Spring', 'green', 'Gently pan-fired tender green leaf rich in catechins with sweet grassy sweetness and clean finish.', 'low', 220000, 5.0, '["Fresh Grass", "Sweet Corn", "Toasted Rice"]', 1, 1, 1),
          ('tea_silver_needle', 'silver-needle-white', 'Himalayan Silver Needle', 'Rohini', 'Darjeeling', 'Silver Needle', 'Spring', 'white', '100% downy unopened spring buds delicately air-dried with sublime honeysuckle sweetness.', 'low', 750000, 2.5, '["Honeysuckle", "Melon", "Silky"]', 1, 1, 1),
          ('tea_dj_sf', 'darjeeling-second-flush', 'Darjeeling Second Flush Muscatel', 'Castleton', 'Darjeeling', 'SFTGFOP1', 'Second Flush', 'black', 'Renowned summer flush orthodox black tea celebrated for ripe peach sweetness and cedarwood finish.', 'medium', 420000, 5.0, '["Ripe Muscatel", "Summer Raisin", "Cedar"]', 1, 1, 1)
        ON CONFLICT (id) DO NOTHING;

        -- Seed MOQ Rules
        INSERT INTO pl_moq_rules (id, rule_type, target_id, min_quantity, unit_basis, order_multiple, min_order_value_paise)
        VALUES
          ('moq_global', 'global', NULL, 250, 'units', 25, 2500000),
          ('moq_tea_batch', 'tea', NULL, 5.0, 'kg', 1, 0)
        ON CONFLICT (id) DO NOTHING;

        -- Seed Price Book Tiers
        INSERT INTO pl_price_book_tiers (id, price_book_id, item_type, item_id, min_qty, max_qty, unit_price_paise)
        VALUES
          ('pbt_pouch_500', 'pb_default_inr', 'packaging', 'pack_pouch_mbk_250g', 500, 999, 1850),
          ('pbt_pouch_1000', 'pb_default_inr', 'packaging', 'pack_pouch_mbk_250g', 1000, 2499, 1665),
          ('pbt_pouch_2500', 'pb_default_inr', 'packaging', 'pack_pouch_mbk_250g', 2500, 4999, 1480),
          ('pbt_pouch_5000', 'pb_default_inr', 'packaging', 'pack_pouch_mbk_250g', 5000, NULL, 1295),
          ('pbt_tin_250', 'pb_default_inr', 'packaging', 'pack_tin_caddy_100g', 250, 499, 3200),
          ('pbt_tin_500', 'pb_default_inr', 'packaging', 'pack_tin_caddy_100g', 500, 999, 2880),
          ('pbt_tin_1000', 'pb_default_inr', 'packaging', 'pack_tin_caddy_100g', 1000, NULL, 2560),
          ('pbt_jar_200', 'pb_default_inr', 'packaging', 'pack_jar_amber_150g', 200, 499, 4500),
          ('pbt_jar_500', 'pb_default_inr', 'packaging', 'pack_jar_amber_150g', 500, 999, 4050),
          ('pbt_jar_1000', 'pb_default_inr', 'packaging', 'pack_jar_amber_150g', 1000, NULL, 3600),
          ('pbt_carton_300', 'pb_default_inr', 'packaging', 'pack_carton_rigid_100g', 300, 499, 6500),
          ('pbt_carton_500', 'pb_default_inr', 'packaging', 'pack_carton_rigid_100g', 500, 999, 5850),
          ('pbt_carton_1000', 'pb_default_inr', 'packaging', 'pack_carton_rigid_100g', 1000, NULL, 5200),
          ('pbt_sachet_500', 'pb_default_inr', 'packaging', 'pack_sachet_pyramid_20', 500, 999, 2800),
          ('pbt_sachet_1000', 'pb_default_inr', 'packaging', 'pack_sachet_pyramid_20', 1000, 2499, 2520),
          ('pbt_sachet_2500', 'pb_default_inr', 'packaging', 'pack_sachet_pyramid_20', 2500, NULL, 2240)
        ON CONFLICT (id) DO NOTHING;
      `);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["045_private_label_core"]);
      await client.query("COMMIT");
      console.log("✓ Applied 045_private_label_core");
    }

    // Migration 046 (Private Label Projects, Quotes, Samples, Orders & Jobs)
    if (!applied.has("046_private_label_quotes")) {
      console.log("Applying 046_private_label_quotes...");
      await client.query("BEGIN");
      await client.query(`
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
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["046_private_label_quotes"]);
      await client.query("COMMIT");
      console.log("✓ Applied 046_private_label_quotes");
    }

    // Migration 047 (Artwork, Design Versions, Preflight & Approval Events)
    if (!applied.has("047_private_label_artwork")) {
      console.log("Applying 047_private_label_artwork...");
      await client.query("BEGIN");
      await client.query(`
        CREATE TABLE IF NOT EXISTS pl_artwork_assets (
          id TEXT PRIMARY KEY,
          client_id TEXT NOT NULL REFERENCES pl_clients(id) ON DELETE CASCADE,
          original_filename TEXT NOT NULL,
          file_size_bytes INTEGER NOT NULL CHECK(file_size_bytes > 0),
          mime_type TEXT NOT NULL CHECK(mime_type IN ('image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'application/pdf')),
          storage_key TEXT NOT NULL UNIQUE,
          file_sha256 TEXT NOT NULL,
          width_px INTEGER CHECK(width_px IS NULL OR width_px > 0),
          height_px INTEGER CHECK(height_px IS NULL OR height_px > 0),
          dpi REAL CHECK(dpi IS NULL OR dpi > 0),
          color_space TEXT CHECK(color_space IN ('RGB', 'CMYK', 'GRAYSCALE')),
          rights_attestation INTEGER NOT NULL DEFAULT 0 CHECK(rights_attestation IN (0, 1)),
          preflight_status TEXT NOT NULL DEFAULT 'pending' CHECK(preflight_status IN ('pending', 'passed', 'warning', 'rejected')),
          preflight_report_json TEXT NOT NULL DEFAULT '{}',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_art_storage ON pl_artwork_assets(storage_key);
        CREATE INDEX IF NOT EXISTS idx_pl_art_client ON pl_artwork_assets(client_id, preflight_status);
        CREATE INDEX IF NOT EXISTS idx_pl_art_hash ON pl_artwork_assets(file_sha256);

        CREATE TABLE IF NOT EXISTS pl_design_versions (
          id TEXT PRIMARY KEY,
          project_item_id TEXT NOT NULL REFERENCES pl_project_items(id) ON DELETE CASCADE,
          version_number INTEGER NOT NULL DEFAULT 1 CHECK(version_number >= 1),
          scene_json TEXT NOT NULL DEFAULT '{}',
          front_artwork_asset_id TEXT REFERENCES pl_artwork_assets(id) ON DELETE SET NULL,
          back_artwork_asset_id TEXT REFERENCES pl_artwork_assets(id) ON DELETE SET NULL,
          preview_render_url TEXT,
          print_ready_pdf_url TEXT,
          is_locked INTEGER NOT NULL DEFAULT 0 CHECK(is_locked IN (0, 1)),
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(project_item_id, version_number)
        );
        CREATE INDEX IF NOT EXISTS idx_pl_des_item ON pl_design_versions(project_item_id, version_number);
        CREATE INDEX IF NOT EXISTS idx_pl_des_front_art ON pl_design_versions(front_artwork_asset_id);
        CREATE INDEX IF NOT EXISTS idx_pl_des_back_art ON pl_design_versions(back_artwork_asset_id);

        CREATE TABLE IF NOT EXISTS pl_preflight_reports (
          id TEXT PRIMARY KEY,
          artwork_asset_id TEXT NOT NULL REFERENCES pl_artwork_assets(id) ON DELETE CASCADE,
          status TEXT NOT NULL CHECK(status IN ('passed', 'warning', 'rejected')),
          dpi REAL CHECK(dpi IS NULL OR dpi > 0),
          width_px INTEGER CHECK(width_px IS NULL OR width_px > 0),
          height_px INTEGER CHECK(height_px IS NULL OR height_px > 0),
          color_space TEXT CHECK(color_space IN ('RGB', 'CMYK', 'GRAYSCALE')),
          has_transparency INTEGER NOT NULL DEFAULT 0 CHECK(has_transparency IN (0, 1)),
          is_vector INTEGER NOT NULL DEFAULT 0 CHECK(is_vector IN (0, 1)),
          prohibited_scripts_detected INTEGER NOT NULL DEFAULT 0 CHECK(prohibited_scripts_detected IN (0, 1)),
          warnings_json TEXT NOT NULL DEFAULT '[]',
          errors_json TEXT NOT NULL DEFAULT '[]',
          report_summary TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_pl_preflight_art ON pl_preflight_reports(artwork_asset_id);
        CREATE INDEX IF NOT EXISTS idx_pl_preflight_status ON pl_preflight_reports(status);

        CREATE TABLE IF NOT EXISTS pl_approval_events (
          id TEXT PRIMARY KEY,
          design_version_id TEXT NOT NULL REFERENCES pl_design_versions(id) ON DELETE RESTRICT,
          client_id TEXT NOT NULL REFERENCES pl_clients(id) ON DELETE RESTRICT,
          actor_type TEXT NOT NULL CHECK(actor_type IN ('customer', 'admin', 'mcp')),
          actor_id TEXT NOT NULL,
          actor_name TEXT NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('submitted_for_review', 'customer_approved', 'customer_rejected', 'prepress_passed', 'prepress_rejected')),
          legal_disclaimer_accepted INTEGER NOT NULL DEFAULT 0 CHECK(legal_disclaimer_accepted IN (0, 1)),
          ip_address TEXT,
          user_agent TEXT,
          notes TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_pl_appr_version ON pl_approval_events(design_version_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_pl_appr_client ON pl_approval_events(client_id);
      `);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["047_private_label_artwork"]);
      await client.query("COMMIT");
      console.log("✓ Applied 047_private_label_artwork");
    }

    // Migration 048 (Proof Enhancements)
    if (!applied.has("048_private_label_proof_enhancements")) {
      console.log("Applying 048_private_label_proof_enhancements...");
      await client.query("BEGIN");
      await client.query(`
        ALTER TABLE pl_design_versions ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES pl_projects(id) ON DELETE CASCADE;
        CREATE INDEX IF NOT EXISTS idx_pl_des_project ON pl_design_versions(project_id);
        ALTER TABLE pl_design_versions ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'preflight_pending'
          CHECK(status IN ('preflight_pending', 'preflight_passed', 'preflight_failed', 'customer_approved', 'production_locked'));
        CREATE INDEX IF NOT EXISTS idx_pl_des_status ON pl_design_versions(status);
        ALTER TABLE pl_design_versions ADD COLUMN IF NOT EXISTS asset_url TEXT;
        ALTER TABLE pl_design_versions ADD COLUMN IF NOT EXISTS preflight_report_json TEXT NOT NULL DEFAULT '{}';
        ALTER TABLE pl_design_versions ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1 CHECK(revision >= 1);
        ALTER TABLE pl_approval_events ADD COLUMN IF NOT EXISTS signer_name TEXT;
        ALTER TABLE pl_approval_events ADD COLUMN IF NOT EXISTS disclaimer_text TEXT;
        CREATE INDEX IF NOT EXISTS idx_pl_appr_design_ver ON pl_approval_events(design_version_id);
      `);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["048_private_label_proof_enhancements"]);
      await client.query("COMMIT");
      console.log("✓ Applied 048_private_label_proof_enhancements");
    }

    // Migration 049 (Orders & Production Lifecycle)
    if (!applied.has("049_private_label_orders_production")) {
      console.log("Applying 049_private_label_orders_production...");
      await client.query("BEGIN");
      await client.query(`
        ALTER TABLE pl_orders ADD COLUMN IF NOT EXISTS project_id TEXT REFERENCES pl_projects(id) ON DELETE RESTRICT;
        CREATE INDEX IF NOT EXISTS idx_pl_orders_project ON pl_orders(project_id);
        ALTER TABLE pl_orders ADD COLUMN IF NOT EXISTS idempotency_key TEXT;
        ALTER TABLE pl_orders ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'INR';
        ALTER TABLE pl_orders ADD COLUMN IF NOT EXISTS total_paise INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE pl_orders ADD COLUMN IF NOT EXISTS shipping_address_json TEXT NOT NULL DEFAULT '{}';
        ALTER TABLE pl_orders ADD COLUMN IF NOT EXISTS notes TEXT;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_pl_orders_idempotency ON pl_orders(idempotency_key) WHERE idempotency_key IS NOT NULL;

        ALTER TABLE pl_samples ADD COLUMN IF NOT EXISTS quantity INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE pl_samples ADD COLUMN IF NOT EXISTS coupon_code TEXT;
        CREATE INDEX IF NOT EXISTS idx_pl_samples_coupon ON pl_samples(client_id, coupon_code);
        ALTER TABLE pl_samples ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE pl_samples ADD COLUMN IF NOT EXISTS tea_recipe_ids_json TEXT NOT NULL DEFAULT '[]';
        ALTER TABLE pl_samples ADD COLUMN IF NOT EXISTS notes TEXT;

        ALTER TABLE pl_jobs ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE pl_jobs ADD COLUMN IF NOT EXISTS override_justification TEXT;

        ALTER TABLE pl_qc_milestones ADD COLUMN IF NOT EXISTS cupping_score REAL;
        ALTER TABLE pl_qc_milestones ADD COLUMN IF NOT EXISTS recorded_weight_g REAL;
        ALTER TABLE pl_qc_milestones ADD COLUMN IF NOT EXISTS target_weight_g REAL;
        ALTER TABLE pl_qc_milestones ADD COLUMN IF NOT EXISTS notes TEXT;
        ALTER TABLE pl_qc_milestones ADD COLUMN IF NOT EXISTS updated_at TEXT;

        DROP VIEW IF EXISTS pl_sample_orders;
        CREATE OR REPLACE VIEW pl_sample_orders AS SELECT * FROM pl_samples;
      `);
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["049_private_label_orders_production"]);
      await client.query("COMMIT");
      console.log("✓ Applied 049_private_label_orders_production");
    }

    if (!applied.has("050_brochure_catalog")) {
      console.log("Applying 050_brochure_catalog...");
      await client.query("BEGIN");
      const brochureDefaults = [
        ["brochure_url", "/uploads/teafloww-tea-catalog-brochure-2026.pdf"],
        ["brochure_title", "TeaFloww Sourcing & Product Brochure Catalogue 2026"],
        ["brochure_description", "Direct-from-origin single-estate orthodox teas, harvest profiles, wholesale packaging specifications, and procurement guide."],
        ["brochure_button_label", "Download Brochure"],
        ["brochure_enabled", "1"],
        ["brochure_file_size", "3230"],
      ];
      for (const [k, v] of brochureDefaults) {
        await client.query(
          "INSERT INTO store_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO NOTHING",
          [k, v]
        );
      }
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["050_brochure_catalog"]);
      await client.query("COMMIT");
      console.log("✓ Applied 050_brochure_catalog");
    }

    if (!applied.has("051_online_payment_toggle")) {
      console.log("Applying 051_online_payment_toggle...");
      await client.query("BEGIN");
      await client.query(
        "INSERT INTO store_settings (key, value, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (key) DO NOTHING",
        ["online_payment_enabled", "1"]
      );
      await client.query("INSERT INTO schema_migrations (version) VALUES ($1)", ["051_online_payment_toggle"]);
      await client.query("COMMIT");
      console.log("✓ Applied 051_online_payment_toggle");
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
