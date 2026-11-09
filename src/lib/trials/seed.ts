/**
 * TeaFloww Trials v3 — Development Seed Data
 *
 * Populates realistic, genuine Himalayan tea trial kits with authentic
 * estate provenance (Siliguri, Assam, Darjeeling, Dooars), 4x50g component
 * sachets, 5-stage optical assets, verified sensory tests, and FSSAI claims.
 *
 * Strictly idempotent: skips existing slugs.
 * Seed trials are created in 'draft' status to respect guarded lifecycle.
 */

import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export interface SeedResult {
  seeded: number;
  skipped: number;
  trialIds: string[];
}

export function seedTrials(): SeedResult {
  const db = getDb();
  let seeded = 0;
  let skipped = 0;
  const trialIds: string[] = [];

  const kits = [
    {
      trial: {
        slug: "four-tea-discovery-kit",
        title: "TeaFloww Four-Tea Discovery Kit",
        tagline: "Four distinct craft milk teas formulated from Siliguri CTC and fresh whole spices.",
        description:
          "The definitive sample kit for discerning tea stalls and milk chai enthusiasts. Contains four 50g sachets covering Strong CTC, Green Cardamom, Fresh Ginger, and Signature Masala. Every pouch is nitrogen-flushed and batch-coded with estate traceability.",
        price_paise: 20000, // ₹200.00
        compare_at_price_paise: 28000, // ₹280.00
        cost_paise: 11200, // ₹112.00
        sku: "TRIAL-STALL-4X50G",
        inventory_quantity: 150,
        inventory_policy: "track" as const,
        meta_title: "TeaFloww 4-Tea Discovery Kit | 4x50g Authentic Milk Chai Sampler",
        meta_description:
          "Sample Strong, Elaichi, Ginger, and Masala milk teas in 50g pouches. Real Siliguri tea garden provenance, zero artificial aromas.",
      },
      components: [
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
      ],
      assets: [
        {
          stage: "packaging" as const,
          asset_url: "/images/trials/discovery-packaging.jpg",
          alt_text: "Four nitrogen-flushed 50g pouches inside gold-embossed matte kraft discovery box",
        },
        {
          stage: "dry_leaf" as const,
          asset_url: "/images/trials/discovery-dry-leaf.jpg",
          alt_text: "Uniform granular CTC BP leaf granules showing deep reddish-black sheen",
        },
        {
          stage: "infused_leaf" as const,
          asset_url: "/images/trials/discovery-infused-leaf.jpg",
          alt_text: "Coppery infused CTC tea grains post 3-minute boil",
        },
        {
          stage: "liquor" as const,
          asset_url: "/images/trials/discovery-liquor.jpg",
          alt_text: "Deep crimson liquor in professional white cupping cup",
        },
        {
          stage: "milk_tea" as const,
          asset_url: "/images/trials/discovery-milk-tea.jpg",
          alt_text: "Frothy karak chai poured into traditional glass tea cup with rich tan froth",
        },
      ],
      brew_guides: [
        {
          protocol_name: "Siliguri Double Boil",
          tea_dose_g: 2.5,
          water_ml: 100,
          milk_ml: 100,
          sugar_g: 4.0,
          temp_c: 95,
          steep_time_sec: 180,
          steps_json: JSON.stringify([
            "Bring 100ml filtered water to a rolling boil in kettle or saucepan.",
            "Add 2.5g (1 heaping tsp) of tea grains and boil briskly for 90 seconds.",
            "Pour 100ml fresh whole buffalo/cow milk and simmer until foam rises twice.",
            "Strain through fine mesh into warmed glass tumbler and serve hot.",
          ]),
          notes: "Yields 150ml of full-bodied roadside stall cutting chai.",
        },
      ],
      sensory_tests: [
        {
          tester_name: "Master Taster Rajesh Sharma",
          method: "ISO_3103_tasting",
          aroma_score: 8.5,
          body_score: 9.0,
          briskness_score: 8.8,
          astringency_score: 7.5,
          finish_score: 8.9,
          milk_performance_score: 9.4,
          color_hex: "#7A3E1D",
          metrics_json: JSON.stringify({
            cupping_notes: "Deep malty backbone with excellent dairy suspension and clean sweet finish.",
          }),
          verified: 1,
        },
      ],
      claims: [
        {
          claim_type: "fssai_licence",
          label: "FSSAI Lic. No. 12823999000456 verified",
          claim_text: "Statutory packing registration verified by TeaFloww QA",
          basis: "FSSAI Food Business Operator Lic. No. 12823999000456",
          evidence_ref: "FSSAI-IN-2026-WB-0456",
          verified: 1,
          approved_by: "system_seeder",
          expires_at: "2027-12-31T23:59:59Z",
        },
        {
          claim_type: "origin",
          label: "100% Indian tea garden blend with direct estate invoices",
          claim_text: "Direct estate procurement lots from Moran and Batabari",
          basis: "Certified tea garden auction procurement lots",
          evidence_ref: "LOT-SILIGURI-2026-OCT",
          verified: 1,
          approved_by: "system_seeder",
          expires_at: "2027-06-30T23:59:59Z",
        },
      ],
    },
    {
      trial: {
        slug: "himalayan-high-altitude-ctc-orthodox-sampler",
        title: "Himalayan High-Altitude CTC & Orthodox Sampler",
        tagline: "Experience the spectrum from brisk high-grown CTC to delicate whole-leaf orthodox teas.",
        description:
          "A premium exploration kit for specialty cafes and tea rooms comparing high-elevation Assam orthodox leaf with robust Dooars CTC grain.",
        price_paise: 26000,
        compare_at_price_paise: 35000,
        cost_paise: 14500,
        sku: "TRIAL-HIMALAYA-4X50G",
        inventory_quantity: 80,
        inventory_policy: "track" as const,
        meta_title: "Himalayan High-Altitude CTC & Orthodox Sampler | TeaFloww",
        meta_description:
          "Taste whole-leaf Upper Assam FTGFOP1 alongside high-elevation Dooars and Darjeeling autumn flush.",
      },
      components: [
        {
          slot_index: 0,
          name: "Upper Assam FTGFOP1 Orthodox",
          estate: "Mangalam Estate",
          grade: "FTGFOP1 Clonal",
          flush: "Second Flush",
          elevation: "240m AMSL",
          weight_g: 50,
          quantity: 1,
          tasting_notes: JSON.stringify(["Muscatel", "Honey", "Golden Tips", "Silky"]),
          brew_temp_c: 90,
          brew_time_sec: 240,
          leaf_dose_g: 2.0,
        },
        {
          slot_index: 1,
          name: "Terai High-Pungency CTC",
          estate: "Hansqua Estate",
          grade: "CTC BOP",
          flush: "Autumn Flush",
          elevation: "190m AMSL",
          weight_g: 50,
          quantity: 1,
          tasting_notes: JSON.stringify(["Pungent", "Full Body", "Red Liquor", "Earthy"]),
          brew_temp_c: 95,
          brew_time_sec: 180,
          leaf_dose_g: 2.5,
        },
        {
          slot_index: 2,
          name: "Darjeeling Autumnal Wonder",
          estate: "Gopaldhara Estate",
          grade: "FTGFOP Autumn Leaf",
          flush: "Autumn Flush",
          elevation: "1800m AMSL",
          weight_g: 50,
          quantity: 1,
          tasting_notes: JSON.stringify(["Woody", "Ripe Peach", "Mild Astringency"]),
          brew_temp_c: 88,
          brew_time_sec: 210,
          leaf_dose_g: 2.0,
        },
        {
          slot_index: 3,
          name: "Dooars Bold Grain CTC",
          estate: "Chuapara Estate",
          grade: "CTC BP Bold",
          flush: "Rain Flush",
          elevation: "210m AMSL",
          weight_g: 50,
          quantity: 1,
          tasting_notes: JSON.stringify(["Heavy Body", "Dark Liquor", "Cream Tolerant"]),
          brew_temp_c: 95,
          brew_time_sec: 180,
          leaf_dose_g: 2.5,
        },
      ],
      assets: [
        {
          stage: "packaging" as const,
          asset_url: "/images/trials/himalayan-packaging.jpg",
          alt_text: "Himalayan sampler kit box with botanical tea leaf foil line art",
        },
        {
          stage: "dry_leaf" as const,
          asset_url: "/images/trials/himalayan-dry-leaf.jpg",
          alt_text: "Golden-tipped whole leaf orthodox alongside fine granular CTC grains",
        },
      ],
      brew_guides: [
        {
          protocol_name: "Gentle Infusion Protocol",
          tea_dose_g: 2.0,
          water_ml: 150,
          milk_ml: 0,
          sugar_g: 0,
          temp_c: 90,
          steep_time_sec: 240,
          steps_json: JSON.stringify([
            "Heat 150ml spring water to 90°C.",
            "Infuse whole leaf tea for 4 minutes in pre-warmed porcelain pot.",
            "Decant completely without squeezing leaves.",
          ]),
          notes: "Ideal for tasting high-altitude muscatel aromatics without milk.",
        },
      ],
      sensory_tests: [],
      claims: [
        {
          claim_type: "fssai_licence",
          label: "FSSAI Lic. No. 12823999000456 verified",
          claim_text: "Single origin pack records",
          basis: "FSSAI Food Business Operator Lic. No. 12823999000456",
          evidence_ref: "FSSAI-IN-2026-WB-0456",
          verified: 1,
          approved_by: "system_seeder",
          expires_at: "2027-12-31T23:59:59Z",
        },
      ],
    },
    {
      trial: {
        slug: "siliguri-junction-kadak-chai-assortment",
        title: "Siliguri Junction Kadak Chai Assortment",
        tagline: "Built for high-volume tea-stalls requiring immediate color payoff and maximum milk tolerance.",
        description:
          "Formulated after cupping at roadside highway stalls across Siliguri and Jalpaiguri. Provides strong leaf liquor that cuts through full-cream buffalo milk.",
        price_paise: 19000,
        compare_at_price_paise: 24000,
        cost_paise: 9800,
        sku: "TRIAL-JUNCTION-4X50G",
        inventory_quantity: 200,
        inventory_policy: "track" as const,
        meta_title: "Siliguri Junction Kadak Chai Assortment | TeaFloww",
        meta_description:
          "Highway kadak cutting chai blends. Instant strong red color and heavy body for tea stalls.",
      },
      components: [
        {
          slot_index: 0,
          name: "CTC BP Highway Blend",
          estate: "Danguajhar Estate",
          grade: "CTC BP Standard",
          flush: "Second Flush",
          elevation: "190m AMSL",
          weight_g: 50,
          quantity: 1,
          tasting_notes: JSON.stringify(["Robust", "Brisk", "Malty", "Dark Copper"]),
          brew_temp_c: 95,
          brew_time_sec: 180,
          leaf_dose_g: 2.5,
        },
        {
          slot_index: 1,
          name: "CTC Dust Cutting Blend",
          estate: "Matelli Estate",
          grade: "CTC PD Dust",
          flush: "Rain Flush",
          elevation: "230m AMSL",
          weight_g: 50,
          quantity: 1,
          tasting_notes: JSON.stringify(["Fast Liquor", "Intense Color", "High Tannin"]),
          brew_temp_c: 95,
          brew_time_sec: 120,
          leaf_dose_g: 2.0,
        },
        {
          slot_index: 2,
          name: "Ginger-Cardamom Kadak Blend",
          estate: "Mohurgong & Gulma Estate",
          grade: "CTC Blend with Spices",
          flush: "Autumn Flush",
          elevation: "210m AMSL",
          weight_g: 50,
          quantity: 1,
          tasting_notes: JSON.stringify(["Zingy", "Cardamom Aroma", "Warming"]),
          brew_temp_c: 95,
          brew_time_sec: 180,
          leaf_dose_g: 2.5,
        },
        {
          slot_index: 3,
          name: "Tulsi Adrak CTC",
          estate: "Kurseong Foothills",
          grade: "CTC Blend with Holy Basil",
          flush: "Rain Flush",
          elevation: "350m AMSL",
          weight_g: 50,
          quantity: 1,
          tasting_notes: JSON.stringify(["Herbal Refreshment", "Spicy", "Soothing Finish"]),
          brew_temp_c: 95,
          brew_time_sec: 200,
          leaf_dose_g: 2.5,
        },
      ],
      assets: [
        {
          stage: "packaging" as const,
          asset_url: "/images/trials/junction-packaging.jpg",
          alt_text: "Siliguri Junction kadak chai assortment kraft gift sleeve",
        },
      ],
      brew_guides: [
        {
          protocol_name: "Highway Cutting Protocol",
          tea_dose_g: 3.0,
          water_ml: 80,
          milk_ml: 120,
          sugar_g: 6.0,
          temp_c: 98,
          steep_time_sec: 240,
          steps_json: JSON.stringify([
            "Boil water, tea grains, and crushed ginger vigorously for 2 minutes.",
            "Add high-fat milk and sugar, boiling back and forth three times.",
            "Pour from high elevation to aerate and develop foam.",
          ]),
          notes: "Maximum density and caffeine payoff for early morning markets.",
        },
      ],
      sensory_tests: [],
      claims: [
        {
          claim_type: "fssai_licence",
          label: "FSSAI Lic. No. 12823999000456 verified",
          claim_text: "Highway stall trial formulation record",
          basis: "FSSAI Food Business Operator Lic. No. 12823999000456",
          evidence_ref: "FSSAI-IN-2026-WB-0456",
          verified: 1,
          approved_by: "system_seeder",
          expires_at: "2027-12-31T23:59:59Z",
        },
      ],
    },
  ];

  db.transaction(() => {
    for (const kit of kits) {
      const existing = db
        .prepare("SELECT id FROM trials WHERE slug = ?")
        .get(kit.trial.slug) as { id: string } | undefined;

      if (existing) {
        skipped++;
        trialIds.push(existing.id);
        continue;
      }

      const trialId = randomUUID();

      // Insert trials row
      db.prepare(`
        INSERT INTO trials (
          id, slug, title, tagline, description, status,
          pack_format, net_weight_g, price_paise, compare_at_price_paise,
          cost_paise, sku, inventory_quantity, inventory_policy,
          meta_title, meta_description, revision,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, 'draft',
          '4x50g_sachets', 200, ?, ?,
          ?, ?, ?, ?,
          ?, ?, 1,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(
        trialId,
        kit.trial.slug,
        kit.trial.title,
        kit.trial.tagline,
        kit.trial.description,
        kit.trial.price_paise,
        kit.trial.compare_at_price_paise || null,
        kit.trial.cost_paise || null,
        kit.trial.sku,
        kit.trial.inventory_quantity,
        kit.trial.inventory_policy,
        kit.trial.meta_title,
        kit.trial.meta_description
      );

      // Insert 4 components
      const componentIds: string[] = [];
      for (const comp of kit.components) {
        const compId = randomUUID();
        componentIds.push(compId);
        db.prepare(`
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
          comp.elevation || null,
          comp.tasting_notes,
          comp.brew_temp_c,
          comp.brew_time_sec,
          comp.leaf_dose_g,
          comp.slot_index
        );
      }

      // Insert assets
      for (let i = 0; i < (kit.assets || []).length; i++) {
        const a = kit.assets[i];
        db.prepare(`
          INSERT INTO trial_assets (
            id, trial_id, component_id, slot_index, media_id, asset_url,
            stage, alt_text, caption, rights_status, sort_order, created_at, updated_at
          ) VALUES (?, ?, NULL, NULL, NULL, ?, ?, ?, NULL, 'approved', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(randomUUID(), trialId, a.asset_url, a.stage, a.alt_text, i);
      }

      // Insert brew guides
      for (let i = 0; i < (kit.brew_guides || []).length; i++) {
        const g = kit.brew_guides[i];
        db.prepare(`
          INSERT INTO trial_brew_guides (
            id, trial_id, component_id, protocol_name, tea_dose_g, water_ml,
            milk_ml, sugar_g, temp_c, steep_time_sec, steps_json, notes, sort_order,
            created_at, updated_at
          ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          randomUUID(),
          trialId,
          g.protocol_name,
          g.tea_dose_g,
          g.water_ml,
          g.milk_ml,
          g.sugar_g,
          g.temp_c,
          g.steep_time_sec,
          g.steps_json,
          g.notes,
          i
        );
      }

      // Insert sensory tests
      for (const s of kit.sensory_tests || []) {
        db.prepare(`
          INSERT INTO trial_sensory_tests (
            id, trial_id, component_id, sample_id, lot_id, tester_name,
            tested_at, method, aroma_score, body_score, briskness_score,
            astringency_score, finish_score, milk_performance_score,
            color_hex, metrics_json, verified, notes, created_at, updated_at
          ) VALUES (?, ?, NULL, 'SAMPLE-001', 'LOT-SILIGURI-2026', ?,
                    CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL,
                    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          randomUUID(),
          trialId,
          s.tester_name,
          s.method,
          s.aroma_score,
          s.body_score,
          s.briskness_score,
          s.astringency_score,
          s.finish_score,
          s.milk_performance_score,
          s.color_hex,
          s.metrics_json
        );
      }

      // Insert claims
      for (let i = 0; i < (kit.claims || []).length; i++) {
        const c = kit.claims[i];
        db.prepare(`
          INSERT INTO trial_claims (
            id, trial_id, claim_type, label, claim_text, basis,
            evidence_ref, verified, approved_by, approved_at, expires_at,
            sort_order, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        `).run(
          randomUUID(),
          trialId,
          c.claim_type,
          c.label,
          c.claim_text,
          c.basis,
          c.evidence_ref,
          c.verified,
          c.approved_by,
          c.expires_at,
          i
        );
      }

      // Insert audit record for creation
      db.prepare(`
        INSERT INTO trial_audit (
          id, trial_id, revision, action, actor_type, actor_id,
          actor_email, diff_json, reason, ip_address, created_at
        ) VALUES (?, ?, 1, 'seed_create', 'system', 'seed_script',
                  'system@teafloww.com', '{}', 'Initial development seed', '127.0.0.1', CURRENT_TIMESTAMP)
      `).run(randomUUID(), trialId);

      seeded++;
      trialIds.push(trialId);
    }
  })();

  return { seeded, skipped, trialIds };
}
