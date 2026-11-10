/**
 * TeaFloww Private Label Studio — Milestone M4 Adversarial Challenger Test Suite
 * Challenger: private_label_m4_challenger_1 (Role: Pricing Math, Dual-Rate GST & CAS Stress)
 * File: tests/unit/private-label-m4-challenger-1.test.ts
 *
 * Scope: Milestone M4 (Configurator, 12-Component Itemized Pricing, Dual-Rate GST & CAS Concurrency)
 *
 * Vectors:
 * 1. Vector 1: 12-Component Itemized Quote Engine Arithmetic Verification & Stress
 *    - Independent mathematical oracles for all 12 cost components.
 *    - Base tea cost with 3% loss factor allowance: grossKg = netKg * 1.03.
 *    - Rotogravure cylinder fees strictly isolated to gravure print method.
 *    - Label application fee (50 paise) isolated to paper_label and bopp_label.
 *    - Nitrogen flushing (75 paise/unit), cleanroom labor, QC batch retention cupping (₹2,500/batch).
 *    - 5-ply cartons (₹60/carton), palletizing piecewise threshold (<20 vs >=20 cartons).
 *    - Zoned domestic freight (local, metro, national) and international manual review gate.
 * 2. Vector 2: Dual-Rate Indian GST Reconciliation & Zero-Drift Invariant Stress
 *    - 5% GST on tea leaf taxable base (HSN 0902) vs 18% on materials/services/margin.
 *    - Proportional margin distribution between tea and non-tea.
 *    - Invariant 1: Conservation of Taxable Base (teaTaxableBase + nonTeaTaxableBase === subtotalDirect + margin).
 *    - Invariant 2: Zero Paise Drift (taxPaise === teaGstPaise + nonTeaGstPaise).
 *    - Invariant 3: Grand Total Reconciliation (grandTotal === subtotalDirect + margin + tax).
 *    - Rounding Stress Grid across 10 quantity test vectors: Q in [1, 7, 13, 137, 500, 1000, 2468, 10000, 77777, 500000].
 * 3. Vector 3: CAS Concurrency Control & Mid-Air Collision Stress
 *    - Sequential revision increments (1 -> 2 -> 3).
 *    - Mid-air collision detection: stale expected_revision throws PrivateLabelRevisionConflictError.
 *    - High-concurrency race condition harness: 15 simultaneous updates, exactly 1 winner, 14 conflicts (409).
 *    - REST API route parity: PUT / PATCH with expected_revision, 409 Conflict payload verification.
 *    - Schema rejection on missing or invalid expected_revision (< 1).
 *    - Tenant isolation: cross-tenant access returns 404 Not Found.
 *    - In-transaction audit logging to pl_audit.
 * 4. Vector 4: Edge Cases, Boundary Extremes & Security Redaction
 *    - Zero quantity boundary: Q = 0, no division by zero, unit price = 0.
 *    - Fractional fill weights (2.5g pyramid teabag, 33.33g sample).
 *    - Huge volume integer safety: Q = 500,000 units within Number.isSafeInteger.
 *    - Missing rate triggers: manual_quote_required for unverified tea/packaging costs.
 *    - Confidentiality: public DTO and live calculation endpoint strictly redact margin_paise and COGS.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(
  tmpdir(),
  `pl-m4-challenger1-${process.pid}-${Date.now()}.sqlite`
);
process.env.DATABASE_PATH = TEST_DB;
(process.env as Record<string, string | undefined>).NODE_ENV = "test";

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  calculateItemized12ComponentQuote,
  calculateQuote,
} from "@/lib/private-label/pricing";
import {
  toPublicQuoteWithItemsDto,
  toPublicQuoteDto,
  toPublicProjectDto,
} from "@/lib/private-label/public-dto";
import {
  PrivateLabelRevisionConflictError,
  PrivateLabelNotFoundError,
  type AuditActor,
  type DetailedPricingParams,
  type PrintMethodCode,
  type PriceBookTier,
} from "@/lib/private-label/types";

// Import REST API route handlers
import {
  PUT as handleProjectPut,
  PATCH as handleProjectPatch,
  GET as handleProjectGet,
} from "@/app/api/v1/private-label/projects/[id]/route";
import { POST as handleLiveQuoteCalculate } from "@/app/api/v1/private-label/quotes/calculate/route";
import { POST as handleLiveMoqCalculate } from "@/app/api/v1/private-label/moq/calculate/route";

const ACTOR_CUSTOMER_A: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-m4-challenger-001",
  actor_email: "challenger_alice@teafloww.com",
};

const ACTOR_CUSTOMER_B: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-m4-challenger-002",
  actor_email: "challenger_bob@teafloww.com",
};

describe("Milestone M4 Adversarial Challenger 1: Pricing Math, Dual-Rate GST & CAS Stress", () => {
  beforeAll(() => {
    // 1. Initialize isolated SQLite test database with schema migrations
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    // 2. Insert test customer entities
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('cust-m4-challenger-001', 'challenger_alice@teafloww.com', 'Alice Enterprise Tea'),
             ('cust-m4-challenger-002', 'challenger_bob@teafloww.com', 'Bob Global Imports')
    `).run();

    // 3. Insert baseline tea options
    db.prepare(`
      INSERT OR IGNORE INTO pl_tea_options (
        id, slug, name, origin_estate, region, grade, flush, tea_category,
        description, caffeine_level, base_cost_per_kg_paise, min_batch_kg,
        is_published, sample_available, revision
      ) VALUES (
        'tea_chal_darjeeling', 'challenger-darjeeling-ff', 'Challenger Darjeeling First Flush',
        'Singbulli Estate', 'Darjeeling', 'FTGFOP1', 'First Flush', 'black',
        'Empirical verification tea grade', 'medium', 240000, 10.0, 1, 1, 1
      ), (
        'tea_chal_assam', 'challenger-assam-orthodox', 'Challenger Assam Orthodox Gold',
        'Halmari Estate', 'Assam', 'TGFOP', 'Second Flush', 'black',
        'Malty high-density orthodox tea', 'high', 160000, 25.0, 1, 1, 1
      )
    `).run();

    // 4. Insert baseline packaging variants matching migration 045 schema
    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_variants (
        id, family_id, slug, sku, title, material, finish, closure_type,
        capacity_description, net_weight_capacity_grams, width_mm, height_mm,
        label_safe_width_mm, label_safe_height_mm, supplier_name, unit_cost_paise,
        moq_units, order_multiple, status, revision
      ) VALUES (
        'pack_chal_pouch_100', 'fam_pouch', 'chal-pouch-100g', 'CHAL-POUCH-100G',
        'Challenger Kraft Barrier Pouch 100g', 'Kraft/EVOH Foil', 'Matte Finish',
        'Degassing Valve & Resealable Zipper', '100g net capacity', 100.0, 160.0, 230.0,
        140.0, 180.0, 'Siliguri Pack Works', 1500,
        500, 50, 'published', 1
      ), (
        'pack_chal_tin_250', 'fam_tin', 'chal-tin-250g', 'CHAL-TIN-250G',
        'Challenger Seamless Tinplate Canister 250g', 'Food-Grade Tinplate', 'Satin Enamel',
        'Slip Lid with Foil Seal', '250g net capacity', 250.0, 90.0, 140.0,
        80.0, 120.0, 'Nirva Metal Works', 4500,
        1000, 100, 'published', 1
      )
    `).run();

    // 5. Insert print methods matching migration 045 schema
    db.prepare(`
      INSERT OR IGNORE INTO pl_print_methods (
        id, code, name, description, color_model, max_colors,
        setup_fee_paise, cylinder_fee_per_color_paise,
        min_order_units, lead_time_days, is_active
      ) VALUES (
        'pm_chal_bopp', 'bopp_label', 'Challenger BOPP Label', 'Waterproof film label', 'cmyk', 6,
        150000, 0, 500, 7, 1
      ), (
        'pm_chal_gravure', 'gravure', 'Challenger Rotogravure Cylinder', 'Direct film printing', 'spot', 8,
        350000, 800000, 5000, 21, 1
      ), (
        'pm_chal_digital', 'direct_digital', 'Challenger Direct Digital', 'Short run direct inkjet', 'cmyk', 4,
        50000, 0, 100, 5, 1
      )
    `).run();
  });

  afterAll(() => {
    try {
      rmSync(TEST_DB, { force: true });
      rmSync(`${TEST_DB}-wal`, { force: true });
      rmSync(`${TEST_DB}-shm`, { force: true });
    } catch {
      // ignore cleanup errors
    }
  });

  // ==========================================================================
  // Vector 1: 12-Component Itemized Quote Engine Arithmetic Verification
  // ==========================================================================
  describe("Vector 1: 12-Component Itemized Quote Engine Arithmetic Verification", () => {
    const baseParams: DetailedPricingParams = {
      requestedUnits: 1000,
      netWeightGrams: 100,
      teaOption: {
        id: "tea_chal_darjeeling",
        baseCostPerKgPaise: 240000, // ₹2,400.00/kg
        minBatchKg: 10,
      },
      packagingVariant: {
        id: "pack_chal_pouch_100",
        unitCostPaise: 1500, // ₹15.00/pack
        closureRatePaise: 200, // ₹2.00/pack
        tareWeightGrams: 16,
        packsPerCarton: 24,
      },
      printMethod: {
        id: "pm_chal_bopp",
        code: "bopp_label",
        setupFeePaise: 150000, // ₹1,500 setup
        cylinderFeePerColorPaise: 0,
        unitCostPaise: 250, // ₹2.50/label
      },
      colorCount: 4,
      isNitrogenFlushEnabled: true,
      priceBook: {
        id: "pb_standard",
        marginRate: 0.25,
        fillingLaborPaisePerUnit: 300, // ₹3.00/unit
        qcChargePaisePerBatch: 250000, // ₹2,500/batch
        lossAllowanceRate: 0.03, // 3% loss
      },
      destinationZone: "metro",
      activeTiers: [],
    };

    it("Vector 1.1: Component 1 (Base Tea Cost with 3% loss factor) computes gross kg and exact paise", () => {
      const res = calculateItemized12ComponentQuote(baseParams);
      expect(res.status).toBe("firm_issued");
      const b = res.breakdown!;

      // Net tea: 1000 * 100g / 1000 = 100 kg
      // Gross tea: 100 * 1.03 = 103 kg
      // Tea cost: Math.round(103 * 240000) = 24,720,000 paise (₹2,47,200.00)
      expect(b.metrics.netTeaKg).toBe(100);
      expect(b.metrics.grossTeaKg).toBe(103);
      expect(b.teaCostPaise).toBe(24720000);
      expect(Number.isInteger(b.teaCostPaise)).toBe(true);

      // Custom loss allowance test: 5% loss
      const res5Loss = calculateItemized12ComponentQuote({
        ...baseParams,
        priceBook: {
          ...baseParams.priceBook!,
          lossAllowanceRate: 0.05,
        },
      });
      // Gross: 100 * 1.05 = 105 kg -> 105 * 240000 = 25,200,000 paise
      expect(res5Loss.breakdown!.metrics.grossTeaKg).toBe(105);
      expect(res5Loss.breakdown!.teaCostPaise).toBe(25200000);
    });

    it("Vector 1.2: Component 2 (Primary Packaging Structure) handles baseline and active tier discounts", () => {
      // Without tier: 1000 units * 1500 paise = 1,500,000 paise (₹15,000)
      const resBase = calculateItemized12ComponentQuote(baseParams);
      expect(resBase.breakdown!.packagingCostPaise).toBe(1500000);

      // With active tier: 1000-4999 units -> 1250 paise
      const tiers: PriceBookTier[] = [
        {
          id: "tier_pkg_001",
          price_book_id: "pb_standard",
          item_type: "packaging",
          item_id: "pack_chal_pouch_100",
          min_qty: 1000,
          max_qty: 4999,
          unit_price_paise: 1250,
          created_at: new Date().toISOString(),
        },
      ];
      const resTier = calculateItemized12ComponentQuote({
        ...baseParams,
        activeTiers: tiers,
      });
      // 1000 units * 1250 paise = 1,250,000 paise
      expect(resTier.breakdown!.packagingCostPaise).toBe(1250000);
      expect(resTier.breakdown?.appliedTiers?.packagingTierPricePaise).toBe(1250);
    });

    it("Vector 1.3: Component 3 (Print Method Run Cost) uses tier or default code piece-rate", () => {
      // bopp_label: 1000 units * 250 paise = 250,000 paise (₹2,500)
      const res = calculateItemized12ComponentQuote(baseParams);
      expect(res.breakdown!.printingCostPaise).toBe(250000);

      // Fallback code rates when unitCostPaise is undefined
      const codes: Array<[PrintMethodCode, number]> = [
        ["paper_label", 150],
        ["bopp_label", 250],
        ["direct_digital", 450],
        ["gravure", 120],
        ["screen_print", 300],
        ["sleeve", 350],
      ];
      for (const [code, expectedRate] of codes) {
        const testRes = calculateItemized12ComponentQuote({
          ...baseParams,
          printMethod: {
            id: `pm_${code}`,
            code,
            setupFeePaise: 100000,
          },
        });
        expect(testRes.breakdown!.printingCostPaise).toBe(1000 * expectedRate);
      }
    });

    it("Vector 1.4: Component 4 (Tooling Setup) isolates cylinder fees STRICTLY to rotogravure", () => {
      // 1. bopp_label with 4 colors: gravure cylinder fee MUST be 0
      const resBopp = calculateItemized12ComponentQuote({
        ...baseParams,
        printMethod: {
          id: "pm_bopp",
          code: "bopp_label",
          setupFeePaise: 150000,
          cylinderFeePerColorPaise: 800000, // Should be ignored because code !== gravure
        },
        colorCount: 6,
      });
      expect(resBopp.breakdown!.toolingSetupPaise).toBe(150000); // Only setup fee

      // 2. gravure with 5 colors: setupFee (350000) + 5 * 800000 (4000000) = 4,350,000 paise
      const resGravure = calculateItemized12ComponentQuote({
        ...baseParams,
        printMethod: {
          id: "pm_gravure",
          code: "gravure",
          setupFeePaise: 350000,
          cylinderFeePerColorPaise: 800000,
        },
        colorCount: 5,
      });
      expect(resGravure.breakdown!.toolingSetupPaise).toBe(350000 + 5 * 800000);
      expect(resGravure.breakdown!.toolingSetupPaise).toBe(4350000);
    });

    it("Vector 1.5: Component 5 (Closures & Label Application) adds 50 paise label app fee strictly for labels", () => {
      // For bopp_label: closureRate (200) + labelApp (50) = 250 paise * 1000 = 250,000 paise
      const resBopp = calculateItemized12ComponentQuote(baseParams);
      expect(resBopp.breakdown!.closureFinishingCostPaise).toBe(1000 * (200 + 50));

      // For direct_digital: labelApp is 0 -> 200 * 1000 = 200,000 paise
      const resDigital = calculateItemized12ComponentQuote({
        ...baseParams,
        printMethod: {
          id: "pm_digital",
          code: "direct_digital",
          setupFeePaise: 50000,
          unitCostPaise: 450,
        },
      });
      expect(resDigital.breakdown!.closureFinishingCostPaise).toBe(1000 * 200);
    });

    it("Vector 1.6: Component 6 (Nitrogen Flushing) applies 75 paise/unit if enabled, 0 if disabled", () => {
      // Enabled: 1000 * 75 = 75,000 paise
      const resOn = calculateItemized12ComponentQuote({
        ...baseParams,
        isNitrogenFlushEnabled: true,
      });
      expect(resOn.breakdown!.nitrogenFlushingCostPaise).toBe(75000);

      // Disabled: 0 paise
      const resOff = calculateItemized12ComponentQuote({
        ...baseParams,
        isNitrogenFlushEnabled: false,
      });
      expect(resOff.breakdown!.nitrogenFlushingCostPaise).toBe(0);
    });

    it("Vector 1.7: Component 7 (Cleanroom Filling Labor) evaluates unit piece-rate", () => {
      // 1000 units * 300 paise = 300,000 paise (₹3,000)
      const res = calculateItemized12ComponentQuote(baseParams);
      expect(res.breakdown!.laborCostPaise).toBe(300000);

      // Custom price book labor: 450 paise/unit
      const resCustom = calculateItemized12ComponentQuote({
        ...baseParams,
        priceBook: {
          ...baseParams.priceBook!,
          fillingLaborPaisePerUnit: 450,
        },
      });
      expect(resCustom.breakdown!.laborCostPaise).toBe(450000);
    });

    it("Vector 1.8: Component 8 (QC & Batch Cupping) evaluates gross tea kg against min batch size", () => {
      // Gross tea: 103 kg. minBatchKg: 10 kg. batchCount: Math.ceil(103 / 10) = 11 batches.
      // qcCostPaise = 11 * 250000 = 2,750,000 paise (₹27,500)
      const res = calculateItemized12ComponentQuote(baseParams);
      expect(res.breakdown!.metrics.batchCount).toBe(11);
      expect(res.breakdown!.qcCostPaise).toBe(11 * 250000);

      // Larger minBatchKg: 50 kg -> Math.ceil(103 / 50) = 3 batches -> 3 * 250000 = 750,000 paise
      const resLargeBatch = calculateItemized12ComponentQuote({
        ...baseParams,
        teaOption: {
          ...baseParams.teaOption,
          minBatchKg: 50,
        },
      });
      expect(resLargeBatch.breakdown!.metrics.batchCount).toBe(3);
      expect(resLargeBatch.breakdown!.qcCostPaise).toBe(750000);
    });

    it("Vector 1.9: Component 9 (Corrugated Cartons) evaluates 5-ply carton units and fees", () => {
      // Q = 1000, packsPerCarton = 24 -> Math.ceil(1000 / 24) = 42 cartons
      // cartonCost = 42 * 6000 paise = 252,000 paise (₹2,520)
      const res = calculateItemized12ComponentQuote(baseParams);
      expect(res.breakdown!.metrics.cartonCount).toBe(42);
      expect(res.breakdown!.cartonCostPaise).toBe(42 * 6000);
    });

    it("Vector 1.10: Component 10 (Palletizing & Moisture Wrap) exercises piecewise threshold (<20 vs >=20 cartons)", () => {
      // 1. Q = 100 -> cartonCount = Math.ceil(100 / 24) = 5 cartons (< 20)
      // Small order rule: Math.max(5000, 5 * 300) = 5000 paise (₹50 min handling)
      const resSmall = calculateItemized12ComponentQuote({
        ...baseParams,
        requestedUnits: 100,
      });
      expect(resSmall.breakdown!.metrics.cartonCount).toBe(5);
      expect(resSmall.breakdown!.palletizingCostPaise).toBe(5000);

      // 2. Q = 1000 -> cartonCount = 42 (>= 20)
      // Pallet count: Math.ceil(42 / 40) = 2 pallets
      // Palletizing cost: 2 * 75000 = 150,000 paise (₹1,500)
      const resLarge = calculateItemized12ComponentQuote(baseParams);
      expect(resLarge.breakdown!.metrics.palletCount).toBe(2);
      expect(resLarge.breakdown!.palletizingCostPaise).toBe(150000);
    });

    it("Vector 1.11: Component 11 (Domestic Freight Logistics) validates local, metro, national rates and weight calculation", () => {
      // Total weight: grossTeaKg (103) + packWeight (1000*16/1000 = 16) + cartonWeight (42*0.8 = 33.6) + palletWeight (2*18 = 36)
      // Total weight = Math.ceil(103 + 16 + 33.6 + 36) = Math.ceil(188.6) = 189 kg
      const resMetro = calculateItemized12ComponentQuote(baseParams);
      expect(resMetro.breakdown!.metrics.totalWeightKg).toBe(189);
      // Metro: 35000 base + 189 * 5500 = 35000 + 1039500 = 1,074,500 paise
      expect(resMetro.breakdown!.freightCostPaise).toBe(35000 + 189 * 5500);

      // Local: 20000 base + 189 * 2500 = 20000 + 472500 = 492,500 paise
      const resLocal = calculateItemized12ComponentQuote({
        ...baseParams,
        destinationZone: "local",
      });
      expect(resLocal.breakdown!.freightCostPaise).toBe(20000 + 189 * 2500);

      // National: 45000 base + 189 * 7500 = 45000 + 1417500 = 1,462,500 paise
      const resNational = calculateItemized12ComponentQuote({
        ...baseParams,
        destinationZone: "national",
      });
      expect(resNational.breakdown!.freightCostPaise).toBe(45000 + 189 * 7500);
    });

    it("Vector 1.12: Component 12 (Commercial Margin) rounds to integer and scales by marginRate", () => {
      const res = calculateItemized12ComponentQuote(baseParams);
      const b = res.breakdown!;
      const expectedMargin = Math.round(b.subtotalDirectPaise * 0.25);
      expect(b.marginPaise).toBe(expectedMargin);
      expect(Number.isInteger(b.marginPaise)).toBe(true);
    });

    it("Vector 1.13: Full 12-component sum identity holds with 0 paise drift", () => {
      const res = calculateItemized12ComponentQuote(baseParams);
      const b = res.breakdown!;

      const directSum =
        b.teaCostPaise +
        b.packagingCostPaise +
        b.printingCostPaise +
        b.toolingSetupPaise +
        b.closureFinishingCostPaise +
        b.nitrogenFlushingCostPaise +
        b.laborCostPaise +
        b.qcCostPaise +
        b.cartonCostPaise +
        b.palletizingCostPaise +
        b.freightCostPaise;

      expect(b.subtotalDirectPaise).toBe(directSum);
      expect(b.grandTotalPaise).toBe(b.subtotalDirectPaise + b.marginPaise + b.taxPaise);
    });

    it("Vector 1.14: calculateQuote legacy calculation matches tea, setup, and grand total invariants", () => {
      const legacy = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: {
          id: baseParams.teaOption.id,
          baseCostPerKgPaise: Number(baseParams.teaOption.baseCostPerKgPaise ?? 240000),
        },
        packagingVariant: {
          id: baseParams.packagingVariant.id,
          unitCostPaise: Number(baseParams.packagingVariant.unitCostPaise ?? 1500),
          closureRatePaise: Number(baseParams.packagingVariant.closureRatePaise ?? 200),
          tareWeightGrams: Number(baseParams.packagingVariant.tareWeightGrams ?? 16),
          packsPerCarton: Number(baseParams.packagingVariant.packsPerCarton ?? 24),
        },
        printMethod: {
          id: baseParams.printMethod.id,
          code: baseParams.printMethod.code,
          setupFeePaise: Number(baseParams.printMethod.setupFeePaise ?? 150000),
          cylinderFeePerColorPaise: Number(baseParams.printMethod.cylinderFeePerColorPaise ?? 0),
        },
        colorCount: 4,
        priceBook: {
          id: baseParams.priceBook?.id ?? "pb_standard",
          marginRate: Number(baseParams.priceBook?.marginRate ?? 0.25),
          fillingLaborPaisePerUnit: Number(baseParams.priceBook?.fillingLaborPaisePerUnit ?? 300),
          qcChargePaisePerBatch: Number(baseParams.priceBook?.qcChargePaisePerBatch ?? 250000),
          lossAllowanceRate: Number(baseParams.priceBook?.lossAllowanceRate ?? 0.03),
        },
        destinationZone: "metro",
      });
      expect(legacy.status).toBe("firm_issued");
      expect(legacy.breakdown!.teaCostPaise).toBe(24720000);
      expect(legacy.breakdown!.setupFeePaise).toBe(150000);
      expect(legacy.breakdown!.grandTotalPaise).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Vector 2: Dual-Rate Indian GST Reconciliation & Zero-Drift Invariant Stress
  // ==========================================================================
  describe("Vector 2: Dual-Rate Indian GST Reconciliation & Zero-Drift Invariant Stress", () => {
    it("Vector 2.1: Conservation of Taxable Base holds: teaTaxableBase + nonTeaTaxableBase === subtotalDirect + margin", () => {
      const quantities = [1, 5, 23, 100, 500, 1000, 5000, 10000];
      for (const q of quantities) {
        const res = calculateItemized12ComponentQuote({
          requestedUnits: q,
          netWeightGrams: 100,
          teaOption: { id: "tea_1", baseCostPerKgPaise: 240000 },
          packagingVariant: { id: "pkg_1", unitCostPaise: 1500 },
          printMethod: { id: "pm_1", code: "bopp_label", setupFeePaise: 150000 },
        });
        const b = res.breakdown!;
        const totalTaxable = b.subtotalDirectPaise + b.marginPaise;
        const sumBases =
          b.taxDetails.teaTaxableBasePaise + b.taxDetails.nonTeaTaxableBasePaise;

        expect(sumBases).toBe(totalTaxable);
      }
    });

    it("Vector 2.2: Dual-rate split computes 5% on tea leaf and 18% on non-tea items/services with zero paise mismatch", () => {
      const res = calculateItemized12ComponentQuote({
        requestedUnits: 1500,
        netWeightGrams: 150,
        teaOption: { id: "tea_1", baseCostPerKgPaise: 180000 },
        packagingVariant: { id: "pkg_1", unitCostPaise: 2000 },
        printMethod: { id: "pm_1", code: "paper_label", setupFeePaise: 100000 },
      });
      const b = res.breakdown!;

      const expectedTeaGst = Math.round(b.taxDetails.teaTaxableBasePaise * 0.05);
      const expectedNonTeaGst = Math.round(b.taxDetails.nonTeaTaxableBasePaise * 0.18);

      expect(b.taxDetails.teaGstPaise).toBe(expectedTeaGst);
      expect(b.taxDetails.nonTeaGstPaise).toBe(expectedNonTeaGst);
      // Zero paise mismatch between total tax and component taxes
      expect(b.taxPaise).toBe(expectedTeaGst + expectedNonTeaGst);
      expect(b.taxPaise).toBe(b.taxDetails.teaGstPaise + b.taxDetails.nonTeaGstPaise);
    });

    it("Vector 2.3: Grand Total Reconciliation holds: grandTotal === totalTaxable + taxPaise", () => {
      const res = calculateItemized12ComponentQuote({
        requestedUnits: 2500,
        netWeightGrams: 200,
        teaOption: { id: "tea_1", baseCostPerKgPaise: 300000 },
        packagingVariant: { id: "pkg_1", unitCostPaise: 3500 },
        printMethod: { id: "pm_1", code: "gravure", setupFeePaise: 350000, cylinderFeePerColorPaise: 800000 },
        colorCount: 6,
      });
      const b = res.breakdown!;
      const totalTaxable = b.taxDetails.teaTaxableBasePaise + b.taxDetails.nonTeaTaxableBasePaise;
      expect(b.grandTotalPaise).toBe(totalTaxable + b.taxPaise);
      expect(b.grandTotalPaise).toBe(
        b.taxDetails.teaTaxableBasePaise +
          b.taxDetails.nonTeaTaxableBasePaise +
          b.taxDetails.teaGstPaise +
          b.taxDetails.nonTeaGstPaise
      );
    });

    it("Vector 2.4: Rounding Stress Grid across 10 extreme quantities asserts integer precision and 0 paise discrepancy", () => {
      const testQuantities = [1, 7, 13, 137, 500, 1000, 2468, 10000, 77777, 500000];

      for (const q of testQuantities) {
        const res = calculateItemized12ComponentQuote({
          requestedUnits: q,
          netWeightGrams: 100,
          teaOption: { id: "tea_1", baseCostPerKgPaise: 245678, minBatchKg: 10 },
          packagingVariant: {
            id: "pkg_1",
            unitCostPaise: 1537,
            closureRatePaise: 189,
            packsPerCarton: 24,
          },
          printMethod: {
            id: "pm_1",
            code: "bopp_label",
            setupFeePaise: 150000,
            unitCostPaise: 247,
          },
          colorCount: 4,
          isNitrogenFlushEnabled: true,
          priceBook: {
            id: "pb_1",
            marginRate: 0.235, // fractional margin rate
            fillingLaborPaisePerUnit: 315,
            qcChargePaisePerBatch: 250000,
            lossAllowanceRate: 0.032,
          },
          destinationZone: "metro",
        });

        expect(res.status).toBe("firm_issued");
        const b = res.breakdown!;

        // 1. Every single currency amount must be a clean integer
        expect(Number.isInteger(b.teaCostPaise)).toBe(true);
        expect(Number.isInteger(b.packagingCostPaise)).toBe(true);
        expect(Number.isInteger(b.printingCostPaise)).toBe(true);
        expect(Number.isInteger(b.toolingSetupPaise)).toBe(true);
        expect(Number.isInteger(b.closureFinishingCostPaise)).toBe(true);
        expect(Number.isInteger(b.nitrogenFlushingCostPaise)).toBe(true);
        expect(Number.isInteger(b.laborCostPaise)).toBe(true);
        expect(Number.isInteger(b.qcCostPaise)).toBe(true);
        expect(Number.isInteger(b.cartonCostPaise)).toBe(true);
        expect(Number.isInteger(b.palletizingCostPaise)).toBe(true);
        expect(Number.isInteger(b.freightCostPaise)).toBe(true);
        expect(Number.isInteger(b.subtotalDirectPaise)).toBe(true);
        expect(Number.isInteger(b.marginPaise)).toBe(true);
        expect(Number.isInteger(b.taxDetails.teaTaxableBasePaise)).toBe(true);
        expect(Number.isInteger(b.taxDetails.nonTeaTaxableBasePaise)).toBe(true);
        expect(Number.isInteger(b.taxDetails.teaGstPaise)).toBe(true);
        expect(Number.isInteger(b.taxDetails.nonTeaGstPaise)).toBe(true);
        expect(Number.isInteger(b.taxPaise)).toBe(true);
        expect(Number.isInteger(b.grandTotalPaise)).toBe(true);
        expect(Number.isInteger(b.unitPricePaise)).toBe(true);

        // 2. Exact GST reconciliation identity
        expect(b.taxPaise).toBe(b.taxDetails.teaGstPaise + b.taxDetails.nonTeaGstPaise);

        // 3. Exact taxable base conservation identity
        expect(b.taxDetails.teaTaxableBasePaise + b.taxDetails.nonTeaTaxableBasePaise).toBe(
          b.subtotalDirectPaise + b.marginPaise
        );

        // 4. Exact grand total identity
        expect(b.grandTotalPaise).toBe(b.subtotalDirectPaise + b.marginPaise + b.taxPaise);

        // 5. Positive numbers
        expect(b.grandTotalPaise).toBeGreaterThan(0);
        expect(b.unitPricePaise).toBeGreaterThan(0);
      }
    });

    it("Vector 2.5: Extreme margin rate stress (0% to 100%) preserves GST invariants without drift", () => {
      const marginRates = [0.0, 0.05, 0.15, 0.25, 0.5, 1.0];

      for (const mRate of marginRates) {
        const res = calculateItemized12ComponentQuote({
          requestedUnits: 1000,
          netWeightGrams: 100,
          teaOption: { id: "tea_1", baseCostPerKgPaise: 200000 },
          packagingVariant: { id: "pkg_1", unitCostPaise: 1200 },
          printMethod: { id: "pm_1", code: "paper_label", setupFeePaise: 100000 },
          priceBook: {
            id: "pb_test",
            marginRate: mRate,
          },
        });
        const b = res.breakdown!;
        expect(b.taxPaise).toBe(b.taxDetails.teaGstPaise + b.taxDetails.nonTeaGstPaise);
        expect(b.grandTotalPaise).toBe(b.subtotalDirectPaise + b.marginPaise + b.taxPaise);
        expect(b.taxDetails.teaTaxableBasePaise + b.taxDetails.nonTeaTaxableBasePaise).toBe(
          b.subtotalDirectPaise + b.marginPaise
        );
      }
    });
  });

  // ==========================================================================
  // Vector 3: CAS Concurrency Control & Mid-Air Collision Stress
  // ==========================================================================
  describe("Vector 3: CAS Concurrency Control & Mid-Air Collision Stress", () => {
    it("Vector 3.1: Sequential revision updates increment revision strictly by +1 and never drop or skip", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Challenger Project Sequential",
          target_market: "IN",
          notes: "Initial draft creation",
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      expect(project.revision).toBe(1);

      // Update 1: expected_revision = 1 -> revision advances to 2
      const updated1 = PrivateLabelService.updateProjectDraft(
        project.id,
        1,
        { title: "Challenger Project Sequential Rev 2" },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );
      expect(updated1.revision).toBe(2);
      expect(updated1.title).toBe("Challenger Project Sequential Rev 2");

      // Update 2: expected_revision = 2 -> revision advances to 3
      const updated2 = PrivateLabelService.updateProjectDraft(
        project.id,
        2,
        { title: "Challenger Project Sequential Rev 3" },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );
      expect(updated2.revision).toBe(3);
      expect(updated2.title).toBe("Challenger Project Sequential Rev 3");
    });

    it("Vector 3.2: Stale expected_revision throws PrivateLabelRevisionConflictError with current and expected revisions", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Challenger Project Conflict",
          target_market: "IN",
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // Advance to revision 2
      PrivateLabelService.updateProjectDraft(
        project.id,
        1,
        { title: "First mutation" },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );

      // Attempt update with stale revision 1
      expect(() => {
        PrivateLabelService.updateProjectDraft(
          project.id,
          1,
          { title: "Stale collision update" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      }).toThrow(PrivateLabelRevisionConflictError);

      try {
        PrivateLabelService.updateProjectDraft(
          project.id,
          1,
          { title: "Stale collision update" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      } catch (err) {
        expect(err).toBeInstanceOf(PrivateLabelRevisionConflictError);
        const conflict = err as PrivateLabelRevisionConflictError;
        expect(conflict.current_revision).toBe(2);
        expect(conflict.expected_revision).toBe(1);
        expect(conflict.message).toContain("Revision conflict");
      }
    });

    it("Vector 3.3: Future expected_revision (non-matching) is strictly rejected", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Challenger Project Future Rev",
          target_market: "IN",
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      expect(() => {
        PrivateLabelService.updateProjectDraft(
          project.id,
          99, // Future revision
          { title: "Future revision attempt" },
          ACTOR_CUSTOMER_A,
          ACTOR_CUSTOMER_A.actor_id
        );
      }).toThrow(PrivateLabelRevisionConflictError);
    });

    it("Vector 3.4: Simulated high-concurrency race condition: 15 concurrent updates yields exactly 1 success and 14 409 conflicts", async () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "High Concurrency Project Race",
          target_market: "IN",
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );
      expect(project.revision).toBe(1);

      // 15 workers simultaneously attempt to update using expected_revision = 1
      const concurrencyLevel = 15;
      const tasks = Array.from({ length: concurrencyLevel }, (_, i) => {
        return new Promise<{ id: number; success: boolean; error?: unknown }>((resolve) => {
          try {
            PrivateLabelService.updateProjectDraft(
              project.id,
              1,
              { notes: `Race worker ${i} update` },
              ACTOR_CUSTOMER_A,
              ACTOR_CUSTOMER_A.actor_id
            );
            resolve({ id: i, success: true });
          } catch (err) {
            resolve({ id: i, success: false, error: err });
          }
        });
      });

      const results = await Promise.all(tasks);
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      // Exactly ONE update must succeed
      expect(successes.length).toBe(1);
      // Exactly 14 updates must fail with conflict
      expect(failures.length).toBe(concurrencyLevel - 1);

      for (const f of failures) {
        expect(f.error).toBeInstanceOf(PrivateLabelRevisionConflictError);
      }

      // Final project state must be at revision 2, never corrupted or skipped
      const rechecked = PrivateLabelService.getProject(project.id, ACTOR_CUSTOMER_A.actor_id);
      expect(rechecked.revision).toBe(2);
    });

    it("Vector 3.5: HTTP REST API Route PUT /projects/[id] emits HTTP 409 Conflict on revision mismatch", async () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "API Conflict Test Project", target_market: "IN" },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // 1. Valid update with expected_revision = 1 -> returns 200 OK
      const validReq = new Request(
        `http://localhost/api/v1/private-label/projects/${project.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-customer-id": ACTOR_CUSTOMER_A.actor_id,
          },
          body: JSON.stringify({
            expected_revision: 1,
            title: "Updated via API Rev 2",
          }),
        }
      );
      const validRes = await handleProjectPut(validReq, {
        params: Promise.resolve({ id: project.id }),
      });
      expect(validRes.status).toBe(200);
      const validBody = await validRes.json();
      expect(validBody.revision).toBe(2);

      // 2. Conflicting update with stale expected_revision = 1 -> returns 409 Conflict
      const conflictReq = new Request(
        `http://localhost/api/v1/private-label/projects/${project.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-customer-id": ACTOR_CUSTOMER_A.actor_id,
          },
          body: JSON.stringify({
            expected_revision: 1,
            title: "Attempted Stale Overwrite",
          }),
        }
      );
      const conflictRes = await handleProjectPut(conflictReq, {
        params: Promise.resolve({ id: project.id }),
      });
      expect(conflictRes.status).toBe(409);
      const conflictBody = await conflictRes.json();
      expect(conflictBody.error).toContain("Revision conflict");
      expect(conflictBody.current_revision).toBe(2);
      expect(conflictBody.expected_revision).toBe(1);
    });

    it("Vector 3.6: HTTP REST API Route PATCH parity: PATCH enforces CAS revision check identically", async () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "API Patch Test Project", target_market: "IN" },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const conflictPatchReq = new Request(
        `http://localhost/api/v1/private-label/projects/${project.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-customer-id": ACTOR_CUSTOMER_A.actor_id,
          },
          body: JSON.stringify({
            expected_revision: 99, // mismatch
            notes: "Patch notes",
          }),
        }
      );
      const patchRes = await handleProjectPatch(conflictPatchReq, {
        params: Promise.resolve({ id: project.id }),
      });
      expect(patchRes.status).toBe(409);
    });

    it("Vector 3.7: HTTP REST API rejects requests with missing or non-positive expected_revision with 400 Bad Request", async () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "API Validation Test Project", target_market: "IN" },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // Missing expected_revision
      const missingRevReq = new Request(
        `http://localhost/api/v1/private-label/projects/${project.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-customer-id": ACTOR_CUSTOMER_A.actor_id,
          },
          body: JSON.stringify({
            title: "Missing revision title",
          }),
        }
      );
      const resMissing = await handleProjectPut(missingRevReq, {
        params: Promise.resolve({ id: project.id }),
      });
      expect(resMissing.status).toBe(400);

      // Invalid expected_revision: 0
      const zeroRevReq = new Request(
        `http://localhost/api/v1/private-label/projects/${project.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-customer-id": ACTOR_CUSTOMER_A.actor_id,
          },
          body: JSON.stringify({
            expected_revision: 0,
            title: "Zero revision title",
          }),
        }
      );
      const resZero = await handleProjectPut(zeroRevReq, {
        params: Promise.resolve({ id: project.id }),
      });
      expect(resZero.status).toBe(400);
    });

    it("Vector 3.8: Tenant isolation anti-enumeration: Customer B mutating Customer A's project returns 404 (not 409 or 403)", async () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Customer A Secret Dossier", target_market: "IN" },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // Customer B attempts to update Customer A's project
      const crossTenantReq = new Request(
        `http://localhost/api/v1/private-label/projects/${project.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-customer-id": ACTOR_CUSTOMER_B.actor_id, // Bob
          },
          body: JSON.stringify({
            expected_revision: 1,
            title: "Attacker Malicious Edit",
          }),
        }
      );
      const res = await handleProjectPut(crossTenantReq, {
        params: Promise.resolve({ id: project.id }),
      });
      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error).toBe("Project not found");
    });

    it("Vector 3.9: Audit logging records atomic mutation event with revision and diff in pl_audit", () => {
      const db = getDb();
      const project = PrivateLabelService.createProjectDraft(
        { title: "Audited Project Draft", target_market: "IN" },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      PrivateLabelService.updateProjectDraft(
        project.id,
        1,
        { title: "Updated With Audit Diff", target_market: "AE" },
        ACTOR_CUSTOMER_A,
        ACTOR_CUSTOMER_A.actor_id
      );

      const auditRow = db
        .prepare(
          "SELECT * FROM pl_audit WHERE entity_type = 'project' AND entity_id = ? AND revision = 2"
        )
        .get(project.id) as { action: string; actor_id: string; diff_json: string } | undefined;

      expect(auditRow).toBeDefined();
      expect(auditRow!.action).toBe("update_draft");
      expect(auditRow!.actor_id).toBe(ACTOR_CUSTOMER_A.actor_id);
      const diff = JSON.parse(auditRow!.diff_json);
      expect(diff.title).toBe("Updated With Audit Diff");
      expect(diff.target_market).toBe("AE");
    });

    it("Vector 3.10: GET /api/v1/private-label/projects/[id] isolates tenant data and returns 404 for non-owner", async () => {
      const project = PrivateLabelService.createProjectDraft(
        { title: "Isolated Dossier", target_market: "IN" },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      // Customer A reads own project -> 200 OK
      const reqA = new Request(`http://localhost/api/v1/private-label/projects/${project.id}`, {
        headers: { "x-customer-id": ACTOR_CUSTOMER_A.actor_id },
      });
      const resA = await handleProjectGet(reqA, { params: Promise.resolve({ id: project.id }) });
      expect(resA.status).toBe(200);

      // Customer B reads Customer A project -> 404 Not Found
      const reqB = new Request(`http://localhost/api/v1/private-label/projects/${project.id}`, {
        headers: { "x-customer-id": ACTOR_CUSTOMER_B.actor_id },
      });
      const resB = await handleProjectGet(reqB, { params: Promise.resolve({ id: project.id }) });
      expect(resB.status).toBe(404);

      // Non-existent project throws PrivateLabelNotFoundError at service layer
      expect(() => {
        PrivateLabelService.getProject("proj_non_existent", ACTOR_CUSTOMER_A.actor_id);
      }).toThrow(PrivateLabelNotFoundError);
    });
  });

  // ==========================================================================
  // Vector 4: Edge Cases, Boundary Extremes & Security Redaction
  // ==========================================================================
  describe("Vector 4: Edge Cases, Boundary Extremes & Security Redaction", () => {
    it("Vector 4.1: Zero quantity boundary (Q = 0) does not crash or divide by zero; unit price is 0", () => {
      const res = calculateItemized12ComponentQuote({
        requestedUnits: 0,
        netWeightGrams: 100,
        teaOption: { id: "tea_1", baseCostPerKgPaise: 240000 },
        packagingVariant: { id: "pkg_1", unitCostPaise: 1500 },
        printMethod: { id: "pm_1", code: "bopp_label", setupFeePaise: 150000 },
      });

      expect(res.status).toBe("firm_issued");
      const b = res.breakdown!;
      expect(b.teaCostPaise).toBe(0);
      expect(b.packagingCostPaise).toBe(0);
      expect(b.unitPricePaise).toBe(0);
      expect(Number.isNaN(b.grandTotalPaise)).toBe(false);
      expect(Number.isFinite(b.grandTotalPaise)).toBe(true);
    });

    it("Vector 4.2: Fractional fill weights (e.g. 2.5g pyramid teabag) compute accurate integer paise", () => {
      // 10,000 pyramid teabags of 2.5g
      // Net tea: 10000 * 2.5 / 1000 = 25 kg
      // Gross tea: 25 * 1.03 = 25.75 kg
      // Tea rate: ₹3,000/kg (300000 paise)
      // Tea cost: Math.round(25.75 * 300000) = 7,725,000 paise (₹77,250.00)
      const res = calculateItemized12ComponentQuote({
        requestedUnits: 10000,
        netWeightGrams: 2.5,
        teaOption: { id: "tea_1", baseCostPerKgPaise: 300000 },
        packagingVariant: { id: "pkg_1", unitCostPaise: 1200 },
        printMethod: { id: "pm_1", code: "bopp_label", setupFeePaise: 150000 },
      });

      const b = res.breakdown!;
      expect(b.metrics.netTeaKg).toBe(25);
      expect(b.metrics.grossTeaKg).toBe(25.75);
      expect(b.teaCostPaise).toBe(7725000);
      expect(Number.isInteger(b.teaCostPaise)).toBe(true);
    });

    it("Vector 4.3: Huge volume stress (Q = 500,000 units) remains well within Number.isSafeInteger", () => {
      const res = calculateItemized12ComponentQuote({
        requestedUnits: 500000,
        netWeightGrams: 100,
        teaOption: { id: "tea_1", baseCostPerKgPaise: 240000 },
        packagingVariant: { id: "pkg_1", unitCostPaise: 1500, tareWeightGrams: 15 },
        printMethod: { id: "pm_1", code: "gravure", setupFeePaise: 350000, cylinderFeePerColorPaise: 800000 },
        colorCount: 8,
      });

      const b = res.breakdown!;
      expect(Number.isSafeInteger(b.subtotalDirectPaise)).toBe(true);
      expect(Number.isSafeInteger(b.marginPaise)).toBe(true);
      expect(Number.isSafeInteger(b.taxPaise)).toBe(true);
      expect(Number.isSafeInteger(b.grandTotalPaise)).toBe(true);
      expect(b.grandTotalPaise).toBeGreaterThan(0);
      expect(b.taxPaise).toBe(b.taxDetails.teaGstPaise + b.taxDetails.nonTeaGstPaise);
    });

    it("Vector 4.4: Missing or zero rates properly trigger manual_quote_required", () => {
      // 1. Zero tea cost
      const resZeroTea = calculateItemized12ComponentQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: { id: "tea_1", baseCostPerKgPaise: 0 },
        packagingVariant: { id: "pkg_1", unitCostPaise: 1500 },
        printMethod: { id: "pm_1", code: "bopp_label" },
      });
      expect(resZeroTea.status).toBe("manual_quote_required");
      expect(resZeroTea.missingRates).toContain("tea_base_cost_unverified");

      // 2. Zero packaging unit cost
      const resZeroPack = calculateItemized12ComponentQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: { id: "tea_1", baseCostPerKgPaise: 240000 },
        packagingVariant: { id: "pkg_1", unitCostPaise: 0 },
        printMethod: { id: "pm_1", code: "bopp_label" },
      });
      expect(resZeroPack.status).toBe("manual_quote_required");
      expect(resZeroPack.missingRates).toContain("packaging_unit_cost_unverified");
    });

    it("Vector 4.5: International freight destination triggers manual_quote_required gate", () => {
      const resIntl = calculateItemized12ComponentQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: { id: "tea_1", baseCostPerKgPaise: 240000 },
        packagingVariant: { id: "pkg_1", unitCostPaise: 1500 },
        printMethod: { id: "pm_1", code: "bopp_label" },
        destinationZone: "international",
      });
      expect(resIntl.status).toBe("manual_quote_required");
      expect(resIntl.missingRates).toContain("international_freight_requires_quote");
    });

    it("Vector 4.6: Live quote calculation API endpoint strictly redacts marginPaise from response", async () => {
      const req = new Request("http://localhost/api/v1/private-label/quotes/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teaOptionId: "tea_chal_darjeeling",
          packagingVariantId: "pack_chal_pouch_100",
          printMethodId: "pm_chal_bopp",
          requestedUnits: 1000,
          netWeightGrams: 100,
          colorCount: 4,
          destinationZone: "metro",
        }),
      });

      const res = await handleLiveQuoteCalculate(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("firm_issued");
      expect(data.breakdown).toBeDefined();

      // Ensure marginPaise is redacted
      expect(data.breakdown.marginPaise).toBeUndefined();
      // Ensure customer-visible items are present
      expect(data.breakdown.teaCostPaise).toBeGreaterThan(0);
      expect(data.breakdown.packagingCostPaise).toBeGreaterThan(0);
      expect(data.breakdown.taxPaise).toBeGreaterThan(0);
      expect(data.breakdown.grandTotalPaise).toBeGreaterThan(0);
    });

    it("Vector 4.7: Whitelist Public Quote DTO strictly excludes margin_paise, supplier COGS, and private notes", () => {
      const sampleQuote = {
        id: "quote_test_001",
        quote_number: "TF-PLQ-20261110-1234",
        project_id: "proj_001",
        price_book_id: "pb_secret_internal",
        status: "estimated" as const,
        version: 1,
        currency: "INR",
        tea_subtotal_paise: 24720000,
        packaging_subtotal_paise: 1750000,
        printing_subtotal_paise: 250000,
        tooling_setup_paise: 150000,
        labor_subtotal_paise: 375000,
        qc_subtotal_paise: 2750000,
        freight_paise: 1476500,
        margin_paise: 7868000, // CONFIDENTIAL MARGIN
        tax_paise: 6500000,
        grand_total_paise: 45839500,
        price_breakdown_json: JSON.stringify({
          teaCostPaise: 24720000,
          marginPaise: 7868000, // CONFIDENTIAL
          supplierInternalCogs: 18000000, // CONFIDENTIAL
          taxDetails: { teaGstPaise: 1545000, nonTeaGstPaise: 4955000 },
          metrics: { netTeaKg: 100, grossTeaKg: 103, cartonCount: 42 },
        }),
        pdf_summary_url: "/private-label/quotes/quote_test_001/print",
        issued_at: new Date().toISOString(),
        valid_until: new Date(Date.now() + 14 * 86400000).toISOString(),
        accepted_at: null,
        revision: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [
          {
            id: "qi_001",
            quote_id: "quote_test_001",
            project_item_id: "pi_001",
            description: "Darjeeling Tea in Pouch",
            quantity: 1000,
            unit_price_paise: 4584,
            line_total_paise: 45839500,
            cost_breakdown_json: JSON.stringify({
              supplierMargin: 2000000,
            }),
            created_at: new Date().toISOString(),
          },
        ],
      };

      const publicDto = toPublicQuoteWithItemsDto(sampleQuote);

      // Verify margin is redacted
      expect((publicDto as unknown as Record<string, unknown>).margin_paise).toBeUndefined();
      expect((publicDto as unknown as Record<string, unknown>).price_book_id).toBeUndefined();
      expect(publicDto.items[0] && (publicDto.items[0] as unknown as Record<string, unknown>).cost_breakdown_json).toBeUndefined();

      // Verify price_breakdown only includes sanitized taxDetails and metrics
      expect(publicDto.price_breakdown).toBeDefined();
      expect((publicDto.price_breakdown as unknown as Record<string, unknown>).marginPaise).toBeUndefined();
      expect((publicDto.price_breakdown as unknown as Record<string, unknown>).supplierInternalCogs).toBeUndefined();
      expect(publicDto.price_breakdown?.taxDetails?.teaGstPaise).toBe(1545000);
      expect(publicDto.price_breakdown?.taxDetails?.nonTeaGstPaise).toBe(4955000);
      expect(publicDto.price_breakdown?.metrics?.netTeaKg).toBe(100);
    });

    it("Vector 4.8: Live MOQ calculation endpoint evaluates multi-dimensional rules via POST /moq/calculate", async () => {
      const req = new Request("http://localhost/api/v1/private-label/moq/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestedUnits: 100, // below packaging MOQ of 500
          netWeightGrams: 100,
          teaMinBatchKg: 10,
          packagingMOQ: 500,
          orderMultiple: 50,
        }),
      });

      const res = await handleLiveMoqCalculate(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.eligible).toBe(false);
      expect(data.minUnits).toBeGreaterThanOrEqual(500);
      expect(data.reasons.length).toBeGreaterThan(0);
    });

    it("Vector 4.9: Whitelist Public Project and Quote DTOs protect confidential business data", () => {
      const project = PrivateLabelService.createProjectDraft(
        {
          title: "Public DTO Target",
          target_market: "IN",
          notes: "INTERNAL OPERATOR CONFIDENTIAL NOTES",
        },
        ACTOR_CUSTOMER_A.actor_id,
        ACTOR_CUSTOMER_A
      );

      const pubProject = toPublicProjectDto(project);
      expect(pubProject.id).toBe(project.id);
      expect(pubProject.title).toBe(project.title);
      expect((pubProject as unknown as Record<string, unknown>).notes).toBeUndefined();
      expect((pubProject as unknown as Record<string, unknown>).owner_customer_id).toBeUndefined();

      const baseQuoteDto = toPublicQuoteDto({
        id: "quote_test_pub",
        quote_number: "TF-PLQ-20261110-9999",
        project_id: project.id,
        price_book_id: "pb_internal_classified",
        status: "firm_issued",
        version: 1,
        currency: "INR",
        tea_subtotal_paise: 24720000,
        packaging_subtotal_paise: 1750000,
        printing_subtotal_paise: 250000,
        tooling_setup_paise: 150000,
        labor_subtotal_paise: 375000,
        qc_subtotal_paise: 2750000,
        freight_paise: 1476500,
        margin_paise: 7868000,
        tax_paise: 6500000,
        grand_total_paise: 45839500,
        price_breakdown_json: "{}",
        pdf_summary_url: "/print",
        issued_at: new Date().toISOString(),
        valid_until: new Date().toISOString(),
        accepted_at: null,
        revision: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      expect(baseQuoteDto.id).toBe("quote_test_pub");
      expect((baseQuoteDto as unknown as Record<string, unknown>).margin_paise).toBeUndefined();
      expect((baseQuoteDto as unknown as Record<string, unknown>).price_book_id).toBeUndefined();
    });
  });
});
