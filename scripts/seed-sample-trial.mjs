import Database from "better-sqlite3";
import path from "node:path";
import { randomUUID } from "node:crypto";

const dbPath = path.resolve(process.env.DATABASE_PATH || "./data/store.sqlite");
const db = new Database(dbPath);
db.pragma("foreign_keys = ON");

export function seedSampleTrial(database = db) {
  const trialId = "trial-discovery-200g-001";
  const slug = "tea-stall-discovery-kit";

  database.transaction(() => {
    // Delete existing sample trial if present to re-seed cleanly
    database.prepare("DELETE FROM trials WHERE id = ? OR slug = ?").run(trialId, slug);

    // Step 1: Insert trial initially in 'draft' status (per trg_trials_publish_insert_guard)
    database.prepare(`
      INSERT INTO trials (
        id, slug, title, tagline, description, status,
        pack_format, net_weight_g, price_paise, compare_at_price_paise,
        cost_paise, sku, inventory_quantity, inventory_policy,
        meta_title, meta_description, revision,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, 'draft',
        '4x50g_sachets', 200, ?, ?,
        ?, ?, ?, 'track',
        ?, ?, 1,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(
      trialId,
      slug,
      "TeaFloww Four-Tea Discovery Kit",
      "Four distinct craft milk teas formulated from Siliguri CTC and fresh whole spices.",
      "The definitive sample kit for discerning tea stalls and milk chai enthusiasts. Contains four 50g sachets covering Strong CTC, Green Cardamom, Fresh Ginger, and Signature Masala. Every pouch is nitrogen-flushed and batch-coded with estate traceability.",
      20000,
      28000,
      11200,
      "TRIAL-DISCOVERY-200G",
      150,
      "TeaFloww 4-Tea Discovery Kit | 4x50g Authentic Milk Chai Sampler",
      "Sample Strong, Elaichi, Ginger, and Masala milk teas in 50g pouches. Real Siliguri tea garden provenance, zero artificial aromas."
    );

    // Step 2: Insert 4 components (each 50g = 200g net)
    const components = [
      {
        slot_index: 0,
        name: "Strong Milk Chai",
        estate: "Moran Estate",
        grade: "Assam CTC BP",
        flush: "Second Flush 2026",
        elevation: "180m AMSL",
        weight_g: 50,
        quantity: 1,
        tasting_notes: JSON.stringify(["Malty", "Deep Amber", "High Pungency", "Thick Cream Lacing"]),
        brew_temp_c: 95,
        brew_time_sec: 180,
        leaf_dose_g: 2.5,
      },
      {
        slot_index: 1,
        name: "Elaichi Milk Chai",
        estate: "Batabari Estate",
        grade: "Dooars CTC Blend",
        flush: "Autumn Flush",
        elevation: "220m AMSL",
        weight_g: 50,
        quantity: 1,
        tasting_notes: JSON.stringify(["Sweet Cardamom", "Warm Spice", "Full Body", "Balanced Milkiness"]),
        brew_temp_c: 95,
        brew_time_sec: 180,
        leaf_dose_g: 2.5,
      },
      {
        slot_index: 2,
        name: "Ginger Milk Chai",
        estate: "Sonitpur Estate",
        grade: "Assam-Dooars CTC Blend",
        flush: "Rain Flush",
        elevation: "160m AMSL",
        weight_g: 50,
        quantity: 1,
        tasting_notes: JSON.stringify(["Fiery Zing", "Throat Warmth", "Brisk", "Zesty"]),
        brew_temp_c: 95,
        brew_time_sec: 210,
        leaf_dose_g: 2.5,
      },
      {
        slot_index: 3,
        name: "Masala Milk Chai",
        estate: "Cinnamara Estate",
        grade: "Assam CTC BP Whole Spice Blend",
        flush: "Second Flush",
        elevation: "200m AMSL",
        weight_g: 50,
        quantity: 1,
        tasting_notes: JSON.stringify(["Aromatic Pungency", "Cinnamon Sweetness", "Complex Spice", "Robust"]),
        brew_temp_c: 95,
        brew_time_sec: 210,
        leaf_dose_g: 2.5,
      },
    ];

    const compIds = [];
    for (const comp of components) {
      const compId = `comp-discovery-001-${comp.slot_index}`;
      compIds.push(compId);
      database.prepare(`
        INSERT INTO trial_components (
          id, trial_id, slot_index, name, estate, grade, flush, elevation,
          weight_g, quantity, tasting_notes, brew_temp_c, brew_time_sec,
          leaf_dose_g, regular_product_id, regular_variant_id, sort_order,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 50, 1, ?, ?, ?, ?, NULL, NULL, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(
        compId,
        trialId,
        comp.slot_index,
        comp.name,
        comp.estate,
        comp.grade,
        comp.flush,
        comp.elevation,
        comp.tasting_notes,
        comp.brew_temp_c,
        comp.brew_time_sec,
        comp.leaf_dose_g,
        comp.slot_index
      );
    }

    const stageTemplates = [
      { stage: "packaging", url: "/images/trials/discovery-packaging.jpg", alt: "Four nitrogen-flushed 50g pouches inside gold-embossed matte kraft discovery box" },
      { stage: "dry_leaf", url: "/images/trials/discovery-dry-leaf.jpg", alt: "Uniform granular CTC BP leaf granules showing deep reddish-black sheen" },
      { stage: "infused_leaf", url: "/images/trials/discovery-infused-leaf.jpg", alt: "Coppery infused CTC tea grains post 3-minute boil" },
      { stage: "liquor", url: "/images/trials/discovery-liquor.jpg", alt: "Deep crimson liquor in professional white cupping cup" },
      { stage: "milk_tea", url: "/images/trials/discovery-milk-tea.jpg", alt: "Frothy karak chai poured into traditional glass tea cup with rich tan froth" },
    ];

    // Kit level assets
    for (let i = 0; i < stageTemplates.length; i++) {
      const st = stageTemplates[i];
      database.prepare(`
        INSERT INTO trial_assets (
          id, trial_id, component_id, slot_index, media_id, asset_url,
          stage, alt_text, caption, rights_status, sort_order, created_at, updated_at
        ) VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?, NULL, 'approved', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(randomUUID(), trialId, st.url, st.stage, st.alt, i);
    }

    // Pouch level assets for slots 0..3
    for (let slot = 0; slot < 4; slot++) {
      for (let i = 0; i < stageTemplates.length; i++) {
        const st = stageTemplates[i];
        database.prepare(`
          INSERT INTO trial_assets (
            id, trial_id, component_id, slot_index, media_id, asset_url,
            stage, alt_text, caption, rights_status, sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, NULL, 'approved', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(randomUUID(), trialId, compIds[slot], slot, st.url, st.stage, `${components[slot].name} ${st.alt}`, i);
      }
    }

    // Brew guides
    database.prepare(`
      INSERT INTO trial_brew_guides (
        id, trial_id, component_id, protocol_name, tea_dose_g, water_ml,
        milk_ml, sugar_g, temp_c, steep_time_sec, steps_json, notes, sort_order,
        created_at, updated_at
      ) VALUES (?, ?, NULL, 'Siliguri Double Boil', 2.5, 100, 100, 4.0, 95, 180, ?, 'Yields 150ml of full-bodied roadside stall cutting chai.', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      randomUUID(),
      trialId,
      JSON.stringify([
        "Bring 100ml filtered water to a rolling boil in kettle or saucepan.",
        "Add 2.5g (1 heaping tsp) of tea grains and boil briskly for 90 seconds.",
        "Pour 100ml fresh whole buffalo/cow milk and simmer until foam rises twice.",
        "Strain through fine mesh into warmed glass tumbler and serve hot.",
      ])
    );

    // Sensory tests
    database.prepare(`
      INSERT INTO trial_sensory_tests (
        id, trial_id, component_id, sample_id, lot_id, tester_name,
        tested_at, method, aroma_score, body_score, briskness_score,
        astringency_score, finish_score, milk_performance_score,
        color_hex, metrics_json, verified, notes, created_at, updated_at
      ) VALUES (?, ?, NULL, 'SAMPLE-001', 'LOT-SILIGURI-2026', 'Master Taster Rajesh Sharma',
                CURRENT_TIMESTAMP, 'ISO_3103_tasting', 8.5, 9.0, 8.8, 7.5, 8.9, 9.4,
                '#7A3E1D', ?, 1, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      randomUUID(),
      trialId,
      JSON.stringify({ cupping_notes: "Deep malty backbone with excellent dairy suspension and clean sweet finish." })
    );

    // Claims
    database.prepare(`
      INSERT INTO trial_claims (
        id, trial_id, claim_type, label, claim_text, basis,
        evidence_ref, verified, approved_by, approved_at, expires_at,
        sort_order, created_at, updated_at
      ) VALUES (?, ?, 'fssai_licence', 'FSSAI Lic. No. 12823999000456 verified',
                'Statutory packing registration verified by TeaFloww QA',
                'FSSAI Food Business Operator Lic. No. 12823999000456',
                'FSSAI-IN-2026-WB-0456', 1, 'system_seeder', CURRENT_TIMESTAMP, '2027-12-31T23:59:59Z', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(randomUUID(), trialId);

    database.prepare(`
      INSERT INTO trial_claims (
        id, trial_id, claim_type, label, claim_text, basis,
        evidence_ref, verified, approved_by, approved_at, expires_at,
        sort_order, created_at, updated_at
      ) VALUES (?, ?, 'origin', '100% Indian tea garden blend with direct estate invoices',
                'Direct estate procurement lots from Moran and Batabari',
                'Certified tea garden auction procurement lots',
                'LOT-SILIGURI-2026-OCT', 1, 'system_seeder', CURRENT_TIMESTAMP, '2027-06-30T23:59:59Z', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(randomUUID(), trialId);

    // Step 3: Transition status to 'published' (now that components sum to 200g)
    database.prepare(`
      UPDATE trials
      SET status = 'published', published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(trialId);

    // Initial audit entry
    database.prepare(`
      INSERT INTO trial_audit (
        id, trial_id, revision, action, actor_type, actor_id,
        actor_email, diff_json, reason, ip_address, created_at
      ) VALUES (?, ?, 1, 'seed_create', 'system', 'seed_script',
                'system@teafloww.com', '{}', 'Initial sample kit seed', '127.0.0.1', CURRENT_TIMESTAMP)
    `).run(randomUUID(), trialId);
  })();

  console.log(`Successfully seeded sample trial ${trialId} (${slug})`);
}

if (process.argv[1] && process.argv[1].endsWith("seed-sample-trial.mjs")) {
  seedSampleTrial();
  db.close();
}
