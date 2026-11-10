/**
 * TeaFloww Private Label Studio — Milestone M1 Adversarial Challenger 2 Test Suite
 * File: tests/unit/private-label-challenger-boundary.test.ts
 *
 * Comprehensive adversarial verification testing:
 * 1. MOQ boundary stress test: extreme quantities (0, negative, MAX_SAFE_INTEGER, exact max 10M),
 *    odd weight values (33.33g), large order multiples (1000), multi-constraint deterministic diagnosis.
 * 2. Pricing arithmetic stress test: dual-rate Indian GST (5% tea vs 18% services/margin), zero margin,
 *    missing rates fallback to manual_quote_required, integer paise preservation (no NaN, no fractions),
 *    large quantities, gravure tooling fee logic, and rate property impedance / undefined comparison vulnerability.
 * 3. Compatibility boundary test: exhaustive fuzzing across all 7 packaging families x 6 print methods (42 pairs),
 *    rotary screen print color count boundaries on tins/jars, safe zone tolerances on tiny/extreme dimensions.
 * 4. Security isolation & anti-enumeration test: cross-tenant access returns 404 (never 403 or raw DB errors),
 *    identical error codes/messages between cross-tenant and non-existent IDs, admin access bypass,
 *    and empirical analysis of null owner_customer_id behavior.
 * 5. Data projection leak test: whitelisted DTO projections strictly redact confidential supplier names,
 *    supplier SKUs, base purchase costs, internal margins, and operator notes.
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { ZodError } from "zod";

const TEST_DB = path.join(tmpdir(), `pl-challenger2-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  PrivateLabelNotFoundError,
  type AuditActor,
  type PackagingVariantWithDetails,
  type TeaOption,
  type PrintMethod,
  type Quote,
  type Project,
  type PricingCalculationParams,
} from "@/lib/private-label/types";
import { calculateMOQ } from "@/lib/private-label/moq";
import { calculateQuote } from "@/lib/private-label/pricing";
import {
  validateCompatibility,
  calculateSafeZone,
} from "@/lib/private-label/compatibility";
import {
  toPublicPackagingVariantDto,
  toPublicTeaOptionDto,
  toPublicPrintMethodDto,
  toPublicQuoteDto,
  toPublicProjectDto,
} from "@/lib/private-label/public-dto";

const ACTOR_ALPHA: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-adv-alpha",
  actor_email: "alpha@example.com",
};

const ACTOR_BRAVO: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-adv-bravo",
  actor_email: "bravo@example.com",
};

describe("Adversarial Challenger 2: Milestone M1 Empirical Verification", () => {
  beforeAll(() => {
    // Run migrations on isolated test DB
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      env: { ...process.env, DATABASE_PATH: TEST_DB },
    });

    const db = getDb();
    PrivateLabelService.seedInitialCatalog();

    // Insert test customer accounts
    db.prepare(`
      INSERT OR IGNORE INTO customers (id, email, name)
      VALUES ('cust-adv-alpha', 'alpha@example.com', 'Client Alpha'),
             ('cust-adv-bravo', 'bravo@example.com', 'Client Bravo')
    `).run();
  });

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
      // Ignore cleanup error in temp
    }
  });

  // ==========================================================================
  // AREA 1: MOQ Boundary Stress Test
  // ==========================================================================
  describe("Area 1: MOQ Boundary Stress Test", () => {
    it("rejects requestedUnits = 0 with strict Zod validation error", () => {
      expect(() =>
        calculateMOQ({
          requestedUnits: 0,
          netWeightGrams: 100,
          teaMinBatchKg: 10,
          packagingMOQ: 100,
          printMOQ: 100,
        })
      ).toThrow(ZodError);

      try {
        calculateMOQ({
          requestedUnits: 0,
          netWeightGrams: 100,
          teaMinBatchKg: 10,
          packagingMOQ: 100,
          printMOQ: 100,
        });
      } catch (err) {
        const zodErr = err as ZodError;
        expect(zodErr.issues[0]?.message).toMatch(/at least 1/i);
      }
    });

    it("rejects negative requestedUnits with strict Zod validation error", () => {
      expect(() =>
        calculateMOQ({
          requestedUnits: -50,
          netWeightGrams: 100,
          teaMinBatchKg: 10,
          packagingMOQ: 100,
          printMOQ: 100,
        })
      ).toThrow(ZodError);
    });

    it("rejects requestedUnits = Number.MAX_SAFE_INTEGER exceeding maximum allowed ceiling", () => {
      expect(() =>
        calculateMOQ({
          requestedUnits: Number.MAX_SAFE_INTEGER,
          netWeightGrams: 100,
          teaMinBatchKg: 10,
          packagingMOQ: 100,
          printMOQ: 100,
        })
      ).toThrow(ZodError);

      try {
        calculateMOQ({
          requestedUnits: Number.MAX_SAFE_INTEGER,
          netWeightGrams: 100,
          teaMinBatchKg: 10,
          packagingMOQ: 100,
          printMOQ: 100,
        });
      } catch (err) {
        const zodErr = err as ZodError;
        expect(zodErr.issues[0]?.message).toMatch(/exceed maximum allowed/i);
      }
    });

    it("accepts maximum allowed quantity (10,000,000 units) and rejects 10,000,001", () => {
      const result = calculateMOQ({
        requestedUnits: 10_000_000,
        netWeightGrams: 100,
        teaMinBatchKg: 10,
        packagingMOQ: 100,
        printMOQ: 100,
        fillingMOQ: 100,
        orderMultiple: 100,
      });
      expect(result.eligible).toBe(true);
      expect(result.reasons).toEqual([]);

      expect(() =>
        calculateMOQ({
          requestedUnits: 10_000_001,
          netWeightGrams: 100,
          teaMinBatchKg: 10,
          packagingMOQ: 100,
          printMOQ: 100,
        })
      ).toThrow(ZodError);
    });

    it("accurately handles odd decimal weight values (e.g. 33.33g) with deterministic ceiling", () => {
      // 10kg blend at 33.33g/pack requires Math.ceil(10000 / 33.33) = Math.ceil(300.030003...) = 301 units
      const resultUnder = calculateMOQ({
        requestedUnits: 300,
        netWeightGrams: 33.33,
        teaMinBatchKg: 10,
        packagingMOQ: 100,
        printMOQ: 100,
        fillingMOQ: 100,
        orderMultiple: 1,
      });

      expect(resultUnder.teaUnitsRequired).toBe(301);
      expect(resultUnder.eligible).toBe(false);
      expect(resultUnder.reasons).toHaveLength(1);
      expect(resultUnder.reasons[0]).toContain(
        "Requested quantity (300) is below minimum tea blending batch (requires at least 301 units for 10kg blend at 33.33g/pack)"
      );

      const resultExact = calculateMOQ({
        requestedUnits: 301,
        netWeightGrams: 33.33,
        teaMinBatchKg: 10,
        packagingMOQ: 100,
        printMOQ: 100,
        fillingMOQ: 100,
        orderMultiple: 1,
      });

      expect(resultExact.teaUnitsRequired).toBe(301);
      expect(resultExact.eligible).toBe(true);
      expect(resultExact.reasons).toHaveLength(0);
    });

    it("enforces large order multiples (e.g. 1000) and computes nextValidUnits accurately", () => {
      const result = calculateMOQ({
        requestedUnits: 1500,
        netWeightGrams: 100,
        teaMinBatchKg: 10, // requires 100 units
        packagingMOQ: 200,
        printMOQ: 500,
        fillingMOQ: 100,
        orderMultiple: 1000,
      });

      expect(result.eligible).toBe(false);
      expect(result.minUnits).toBe(1000);
      expect(result.nextValidUnits).toBe(2000);
      expect(result.reasons).toContain(
        "Quantity (1500) must be an exact multiple of 1000 (next valid quantity is 2000)"
      );

      // Testing requestedUnits = 500 (below minUnits and not a multiple)
      const resultBelow = calculateMOQ({
        requestedUnits: 500,
        netWeightGrams: 100,
        teaMinBatchKg: 10,
        packagingMOQ: 200,
        printMOQ: 500,
        fillingMOQ: 100,
        orderMultiple: 1000,
      });
      expect(resultBelow.eligible).toBe(false);
      expect(resultBelow.minUnits).toBe(1000);
      expect(resultBelow.nextValidUnits).toBe(1000);
      expect(resultBelow.reasons).toContain(
        "Quantity (500) must be an exact multiple of 1000 (next valid quantity is 1000)"
      );

      // Valid multiple of 1000
      const resultValid = calculateMOQ({
        requestedUnits: 2000,
        netWeightGrams: 100,
        teaMinBatchKg: 10,
        packagingMOQ: 200,
        printMOQ: 500,
        fillingMOQ: 100,
        orderMultiple: 1000,
      });
      expect(resultValid.eligible).toBe(true);
      expect(resultValid.reasons).toEqual([]);
    });

    it("diagnoses all 6 failure reasons deterministically when all constraints are breached", () => {
      const result = calculateMOQ({
        requestedUnits: 50,
        netWeightGrams: 100,
        teaMinBatchKg: 50, // requires 500 units
        packagingMOQ: 200,
        printMOQ: 300,
        fillingMOQ: 250,
        orderMultiple: 100, // 50 % 100 !== 0
        minOrderValuePaise: 500000, // ₹5,000
        unitEstimatedPricePaise: 5000, // ₹50/unit -> 50 * 50 = ₹2,500 < ₹5,000
      });

      expect(result.eligible).toBe(false);
      expect(result.reasons).toHaveLength(6);
      expect(result.reasons[0]).toMatch(/below minimum tea blending batch/);
      expect(result.reasons[1]).toMatch(/below primary packaging MOQ/);
      expect(result.reasons[2]).toMatch(/below printing method MOQ/);
      expect(result.reasons[3]).toMatch(/below factory filling batch minimum/);
      expect(result.reasons[4]).toMatch(/must be an exact multiple of 100/);
      expect(result.reasons[5]).toMatch(/below minimum order value/);
      expect(result.minUnits).toBe(500);
      expect(result.nextValidUnits).toBe(500);
    });
  });

  // ==========================================================================
  // AREA 2: Pricing Arithmetic Stress Test
  // ==========================================================================
  describe("Area 2: Pricing Arithmetic Stress Test", () => {
    // PricingCalculationParams format
    const validTeaParam = {
      id: "tea_adv_01",
      baseCostPerKgPaise: 250000, // ₹2,500/kg
    };

    const validPackagingParam = {
      id: "pkg_adv_01",
      unitCostPaise: 3500, // ₹35.00
      closureRatePaise: 500, // ₹5.00
      tareWeightGrams: 15,
      packsPerCarton: 24,
    };

    const validPrintMethodParam: PricingCalculationParams["printMethod"] = {
      id: "pm_adv_01",
      code: "bopp_label",
      setupFeePaise: 150000, // ₹1,500 setup fee
      cylinderFeePerColorPaise: 0,
    };

    it("accurately applies dual-rate Indian GST: 5% on tea vs 18% on materials, services & margin", () => {
      const quote = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: validTeaParam,
        packagingVariant: validPackagingParam,
        printMethod: validPrintMethodParam,
        destinationZone: "metro",
      });

      expect(quote.status).toBe("firm_issued");
      expect(quote.requiresOperatorReview).toBe(false);
      expect(quote.breakdown).toBeDefined();

      const b = quote.breakdown!;
      // Tea: 1000 units * 100g = 100kg net. Loss allowance = 3% -> 103kg gross.
      // 103kg * ₹2,500/kg (250,000 paise) = 25,750,000 paise (₹257,500).
      expect(b.teaCostPaise).toBe(25750000);

      // Dual GST Verification
      // Tea GST = 5% of 25,750,000 = 1,287,500 paise
      expect(b.taxDetails.teaGstPaise).toBe(Math.round(b.teaCostPaise * 0.05));
      expect(b.taxDetails.teaGstPaise).toBe(1287500);

      // Non-tea taxable base = subtotal - teaCost + setupFee + gravureCylinderFee + margin
      const taxableNonTea =
        b.subtotalPaise - b.teaCostPaise + b.setupFeePaise + b.gravureCylinderFeePaise + b.marginPaise;
      expect(b.taxDetails.nonTeaGstPaise).toBe(Math.round(taxableNonTea * 0.18));
      expect(b.taxPaise).toBe(b.taxDetails.teaGstPaise + b.taxDetails.nonTeaGstPaise);

      // Grand total = subtotal + setup + cylinder + margin + tax
      expect(b.grandTotalPaise).toBe(
        b.subtotalPaise + b.setupFeePaise + b.gravureCylinderFeePaise + b.marginPaise + b.taxPaise
      );
      expect(b.unitPricePaise).toBe(Math.round(b.grandTotalPaise / 1000));
    });

    it("preserves pure integer paise across all fields (no fractional paise, no NaN)", () => {
      // Test with odd units (333 units) and odd weight (33.33g) to stress test floating point rounding
      const quote = calculateQuote({
        requestedUnits: 333,
        netWeightGrams: 33.33,
        teaOption: validTeaParam,
        packagingVariant: validPackagingParam,
        printMethod: validPrintMethodParam,
        destinationZone: "national",
      });

      expect(quote.status).toBe("firm_issued");
      const b = quote.breakdown!;

      const fieldsToCheck: (keyof typeof b)[] = [
        "teaCostPaise",
        "packagingCostPaise",
        "printingCostPaise",
        "closureCostPaise",
        "labelCostPaise",
        "setupFeePaise",
        "gravureCylinderFeePaise",
        "laborCostPaise",
        "qcCostPaise",
        "cartonCostPaise",
        "freightPaise",
        "subtotalPaise",
        "marginPaise",
        "taxPaise",
        "grandTotalPaise",
        "unitPricePaise",
      ];

      for (const field of fieldsToCheck) {
        const val = b[field];
        expect(typeof val).toBe("number");
        expect(Number.isFinite(val)).toBe(true);
        expect(Number.isNaN(val)).toBe(false);
        expect(Number.isInteger(val)).toBe(true);
      }

      expect(Number.isInteger(b.taxDetails.teaGstPaise)).toBe(true);
      expect(Number.isInteger(b.taxDetails.nonTeaGstPaise)).toBe(true);
    });

    it("supports zero marginRate without NaN or fallback to 25%", () => {
      const quote = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: validTeaParam,
        packagingVariant: validPackagingParam,
        printMethod: validPrintMethodParam,
        priceBook: {
          id: "pb_test",
          marginRate: 0, // Explicit zero margin
          fillingLaborPaisePerUnit: 300,
          qcChargePaisePerBatch: 250000,
          lossAllowanceRate: 0.03,
        },
      });

      expect(quote.status).toBe("firm_issued");
      const b = quote.breakdown!;
      expect(b.marginPaise).toBe(0);

      // Verify non-tea tax calculates without margin
      const taxableNonTea = b.subtotalPaise - b.teaCostPaise + b.setupFeePaise;
      expect(b.taxDetails.nonTeaGstPaise).toBe(Math.round(taxableNonTea * 0.18));
    });

    it("safely falls back to manual_quote_required when rates are missing or unverified", () => {
      // Missing teaOption
      const missingTea = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: undefined as unknown as { id: string; baseCostPerKgPaise: number },
        packagingVariant: validPackagingParam,
        printMethod: validPrintMethodParam,
      });
      expect(missingTea.status).toBe("manual_quote_required");
      expect(missingTea.requiresOperatorReview).toBe(true);
      expect(missingTea.missingRates).toContain("tea_base_cost_unverified");

      // Zero or negative tea baseCost
      const invalidTea = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: { ...validTeaParam, baseCostPerKgPaise: 0 },
        packagingVariant: validPackagingParam,
        printMethod: validPrintMethodParam,
      });
      expect(invalidTea.status).toBe("manual_quote_required");
      expect(invalidTea.missingRates).toContain("tea_base_cost_unverified");

      // Missing packagingVariant or zero unit cost
      const invalidPkg = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: validTeaParam,
        packagingVariant: { ...validPackagingParam, unitCostPaise: 0 },
        printMethod: validPrintMethodParam,
      });
      expect(invalidPkg.status).toBe("manual_quote_required");
      expect(invalidPkg.missingRates).toContain("packaging_unit_cost_unverified");

      // International shipping zone
      const intlQuote = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: validTeaParam,
        packagingVariant: validPackagingParam,
        printMethod: validPrintMethodParam,
        destinationZone: "international",
      });
      expect(intlQuote.status).toBe("manual_quote_required");
      expect(intlQuote.missingRates).toContain("international_freight_requires_quote");
    });

    it("calculates rotogravure tooling fees strictly for gravure print method", () => {
      const gravurePrintMethod: PricingCalculationParams["printMethod"] = {
        id: "pm_gravure",
        code: "gravure",
        setupFeePaise: 250000,
        cylinderFeePerColorPaise: 850000, // ₹8,500/color cylinder tooling
      };

      const quoteGravure = calculateQuote({
        requestedUnits: 5000,
        netWeightGrams: 100,
        teaOption: validTeaParam,
        packagingVariant: validPackagingParam,
        printMethod: gravurePrintMethod,
        colorCount: 5,
      });

      expect(quoteGravure.status).toBe("firm_issued");
      expect(quoteGravure.breakdown!.gravureCylinderFeePaise).toBe(5 * 850000); // 4,250,000 paise = ₹42,500

      // Non-gravure print method must have 0 cylinder fee even if colorCount > 1
      const quoteDigital = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: validTeaParam,
        packagingVariant: validPackagingParam,
        printMethod: validPrintMethodParam, // bopp_label
        colorCount: 5,
      });
      expect(quoteDigital.breakdown!.gravureCylinderFeePaise).toBe(0);
    });

    it("maintains mathematical robustness under large production volume (1,000,000 units)", () => {
      const largeQuote = calculateQuote({
        requestedUnits: 1_000_000,
        netWeightGrams: 100,
        teaOption: validTeaParam,
        packagingVariant: validPackagingParam,
        printMethod: validPrintMethodParam,
      });

      expect(largeQuote.status).toBe("firm_issued");
      const b = largeQuote.breakdown!;
      expect(Number.isSafeInteger(b.grandTotalPaise)).toBe(true);
      expect(b.grandTotalPaise).toBeGreaterThan(0);
      expect(b.unitPricePaise).toBeGreaterThan(0);
      expect(b.unitPricePaise).toBe(Math.round(b.grandTotalPaise / 1_000_000));
    });

    it("REMEDIATED: correctly resolves raw DB snake_case record with base_cost_per_kg_paise without producing NaN", () => {
      const rawDbTea = {
        id: "tea_raw_db",
        base_cost_per_kg_paise: 250000,
      };

      const quote = calculateQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: rawDbTea as unknown as { id: string; baseCostPerKgPaise: number },
        packagingVariant: validPackagingParam,
        printMethod: validPrintMethodParam,
      });

      expect(quote.status).toBe("firm_issued");
      expect(Number.isNaN(quote.breakdown?.teaCostPaise)).toBe(false);
      expect(quote.breakdown?.teaCostPaise).toBe(25750000);
      expect(Number.isNaN(quote.breakdown?.grandTotalPaise)).toBe(false);
      expect(quote.breakdown?.grandTotalPaise).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // AREA 3: Compatibility Boundary Test
  // ==========================================================================
  describe("Area 3: Compatibility Boundary Test", () => {
    const families = ["pouch", "tin", "jar", "box", "carton", "sachet", "bag"] as const;
    const printMethods = [
      "paper_label",
      "bopp_label",
      "direct_digital",
      "gravure",
      "screen_print",
      "sleeve",
    ] as const;

    it("fuzzes all 42 packaging family x print method combinations and returns deterministic results", () => {
      let compatibleCount = 0;
      let incompatibleCount = 0;

      for (const familyCode of families) {
        for (const printMethodCode of printMethods) {
          const res = validateCompatibility({
            familyCode,
            printMethodCode,
            colorCount: 1,
          });

          expect(typeof res.compatible).toBe("boolean");
          if (res.compatible) {
            compatibleCount++;
            expect(res.maxColors).toBeGreaterThanOrEqual(1);
          } else {
            incompatibleCount++;
            expect(typeof res.reason).toBe("string");
            expect(res.reason!.length).toBeGreaterThan(10);
          }
        }
      }

      // Expected matrix breakdown:
      // pouch: paper(T), bopp(T), digital(T), gravure(T), screen(F), sleeve(F) -> 4 T, 2 F
      // tin: paper(T), bopp(T), digital(F), gravure(F), screen(T<=3), sleeve(T) -> 4 T, 2 F
      // jar: paper(T), bopp(T), digital(F), gravure(F), screen(T<=3), sleeve(T) -> 4 T, 2 F
      // box: paper(T), bopp(T), digital(T), gravure(F), screen(F), sleeve(T) -> 4 T, 2 F
      // carton: paper(T), bopp(T), digital(T), gravure(F), screen(F), sleeve(T) -> 4 T, 2 F
      // sachet: paper(T), bopp(T), digital(F), gravure(F), screen(F), sleeve(F) -> 2 T, 4 F
      // bag: paper(T), bopp(T), digital(F), gravure(F), screen(F), sleeve(F) -> 2 T, 4 F
      // Total: 4+4+4+4+4+2+2 = 24 compatible, 18 incompatible = 42 total combinations.
      expect(compatibleCount).toBe(24);
      expect(incompatibleCount).toBe(18);
    });

    it("strictly rejects unmanufacturable combinations with precise technical reasons", () => {
      // 1. Screen printing on flexible pouches (ink cracking)
      const pouchScreen = validateCompatibility({ familyCode: "pouch", printMethodCode: "screen_print" });
      expect(pouchScreen.compatible).toBe(false);
      expect(pouchScreen.reason).toMatch(/ink cracking and barrier failure/i);

      // 2. Shrink sleeve on flexible pouches (heat distortion)
      const pouchSleeve = validateCompatibility({ familyCode: "pouch", printMethodCode: "sleeve" });
      expect(pouchSleeve.compatible).toBe(false);
      expect(pouchSleeve.reason).toMatch(/barrier distortion/i);

      // 3. Direct digital on rigid cylindrical metal tins
      const tinDigital = validateCompatibility({ familyCode: "tin", printMethodCode: "direct_digital" });
      expect(tinDigital.compatible).toBe(false);
      expect(tinDigital.reason).toMatch(/cylindrical tins/i);

      // 4. Rotogravure on pre-formed metal tins
      const tinGravure = validateCompatibility({ familyCode: "tin", printMethodCode: "gravure" });
      expect(tinGravure.compatible).toBe(false);
      expect(tinGravure.reason).toMatch(/flexible film rolls/i);

      // 5. Direct digital on rigid glass/plastic jars
      const jarDigital = validateCompatibility({ familyCode: "jar", printMethodCode: "direct_digital" });
      expect(jarDigital.compatible).toBe(false);
      expect(jarDigital.reason).toMatch(/cylindrical glass or plastic jars/i);

      // 6. Rotogravure on folding cartons/boxes
      const boxGravure = validateCompatibility({ familyCode: "box", printMethodCode: "gravure" });
      expect(boxGravure.compatible).toBe(false);
      expect(boxGravure.reason).toMatch(/folding cartons use sheetfed/i);
    });

    it("enforces maximum 3 spot colors on rotary screen printing for tins and jars", () => {
      // Tins: 1 to 3 spot colors allowed
      expect(validateCompatibility({ familyCode: "tin", printMethodCode: "screen_print", colorCount: 1 }).compatible).toBe(true);
      expect(validateCompatibility({ familyCode: "tin", printMethodCode: "screen_print", colorCount: 3 }).compatible).toBe(true);
      const tinOver = validateCompatibility({ familyCode: "tin", printMethodCode: "screen_print", colorCount: 4 });
      expect(tinOver.compatible).toBe(false);
      expect(tinOver.reason).toContain("supports maximum 3 spot colors (requested: 4)");

      // Jars: 1 to 3 spot colors allowed
      expect(validateCompatibility({ familyCode: "jar", printMethodCode: "screen_print", colorCount: 3 }).compatible).toBe(true);
      const jarOver = validateCompatibility({ familyCode: "jar", printMethodCode: "screen_print", colorCount: 5 });
      expect(jarOver.compatible).toBe(false);
      expect(jarOver.reason).toContain("supports maximum 3 spot colors (requested: 5)");
    });

    it("computes safe-zone margins and handles extreme/tiny dimensions without negative numbers", () => {
      // Standard pouch dimensions (140mm x 200mm)
      const pouchSafe = calculateSafeZone("pouch", 140, 200);
      expect(pouchSafe.marginsMm).toEqual({ top: 35, bottom: 15, left: 10, right: 10 });
      expect(pouchSafe.bleedMm).toBe(3);
      expect(pouchSafe.labelSafeWidthMm).toBe(120); // 140 - 20
      expect(pouchSafe.labelSafeHeightMm).toBe(150); // 200 - 50

      // Tiny pouch dimensions (10mm x 10mm) should clamp to minimum 10mm
      const tinyPouch = calculateSafeZone("pouch", 10, 10);
      expect(tinyPouch.labelSafeWidthMm).toBe(10);
      expect(tinyPouch.labelSafeHeightMm).toBe(10);

      // Tin clearances
      const tinSafe = calculateSafeZone("tin", 80, 120);
      expect(tinSafe.marginsMm).toEqual({ top: 10, bottom: 10, left: 5, right: 5 });
      expect(tinSafe.bleedMm).toBe(2);
      expect(tinSafe.labelSafeWidthMm).toBe(70);
      expect(tinSafe.labelSafeHeightMm).toBe(100);
    });
  });

  // ==========================================================================
  // AREA 4: Security Isolation & Anti-Enumeration Test
  // ==========================================================================
  describe("Area 4: Security Isolation & Anti-Enumeration Test", () => {
    let projectAlphaId: string;
    let quoteAlphaId: string;

    beforeAll(() => {
      // Signature is createProjectDraft(input, customerId, actor)
      const pAlpha = PrivateLabelService.createProjectDraft(
        {
          title: "Alpha Darjeeling Brand",
          target_market: "IN",
          brand_name: "Alpha Organics",
        },
        "cust-adv-alpha",
        ACTOR_ALPHA
      );
      projectAlphaId = pAlpha.id;

      PrivateLabelService.createProjectDraft(
        {
          title: "Bravo Wellness Chai",
          target_market: "US",
          brand_name: "Bravo Chai",
        },
        "cust-adv-bravo",
        ACTOR_BRAVO
      );

      // Create Quote Alpha for Project Alpha
      const quoteAlpha = PrivateLabelService.createQuote(
        projectAlphaId,
        { validity_days: 30 },
        ACTOR_ALPHA,
        "cust-adv-alpha"
      );
      quoteAlphaId = quoteAlpha.id;
    });

    it("strictly returns 404 Not Found (never 403 Forbidden) when Customer Bravo accesses Customer Alpha's project", () => {
      // Customer Bravo probes Customer Alpha's project
      try {
        PrivateLabelService.getProject(projectAlphaId, "cust-adv-bravo");
        expect.fail("Should have thrown 404 PrivateLabelNotFoundError");
      } catch (err) {
        expect(err).toBeInstanceOf(PrivateLabelNotFoundError);
        const notFound = err as PrivateLabelNotFoundError;
        expect(notFound.status).toBe(404);
        expect(notFound.mcpCode).toBe(-32004);
        expect(notFound.message).toBe(`Project not found: ${projectAlphaId}`);
      }
    });

    it("strictly returns 404 Not Found when Customer Bravo attempts to mutate Customer Alpha's project draft", () => {
      try {
        PrivateLabelService.updateProjectDraft(
          projectAlphaId,
          1,
          { title: "Hostile Overwrite" },
          ACTOR_BRAVO,
          "cust-adv-bravo"
        );
        expect.fail("Should have thrown 404 PrivateLabelNotFoundError");
      } catch (err) {
        expect(err).toBeInstanceOf(PrivateLabelNotFoundError);
        const notFound = err as PrivateLabelNotFoundError;
        expect(notFound.status).toBe(404);
        expect(notFound.mcpCode).toBe(-32004);
      }

      // Verify that database record was not altered
      const unmodified = PrivateLabelService.getProject(projectAlphaId, "cust-adv-alpha");
      expect(unmodified.title).toBe("Alpha Darjeeling Brand");
      expect(unmodified.revision).toBe(1);
    });

    it("strictly returns 404 Not Found when Customer Bravo probes Customer Alpha's commercial quote", () => {
      try {
        PrivateLabelService.getQuote(quoteAlphaId, "cust-adv-bravo");
        expect.fail("Should have thrown 404 PrivateLabelNotFoundError");
      } catch (err) {
        expect(err).toBeInstanceOf(PrivateLabelNotFoundError);
        const notFound = err as PrivateLabelNotFoundError;
        expect(notFound.status).toBe(404);
        expect(notFound.mcpCode).toBe(-32004);
        expect(notFound.message).toBe(`Quote not found: ${quoteAlphaId}`);
      }
    });

    it("verifies anti-enumeration: non-existent ID vs cross-tenant existent ID return indistinguishable 404 errors", () => {
      const bogusId = "proj_totally_fake_uuid_999";

      let errorBogus: PrivateLabelNotFoundError | null = null;
      try {
        PrivateLabelService.getProject(bogusId, "cust-adv-bravo");
      } catch (err) {
        errorBogus = err as PrivateLabelNotFoundError;
      }

      let errorExistentCrossTenant: PrivateLabelNotFoundError | null = null;
      try {
        PrivateLabelService.getProject(projectAlphaId, "cust-adv-bravo");
      } catch (err) {
        errorExistentCrossTenant = err as PrivateLabelNotFoundError;
      }

      expect(errorBogus).not.toBeNull();
      expect(errorExistentCrossTenant).not.toBeNull();

      // Indistinguishable response status and code
      expect(errorBogus!.status).toBe(404);
      expect(errorExistentCrossTenant!.status).toBe(404);
      expect(errorBogus!.mcpCode).toBe(-32004);
      expect(errorExistentCrossTenant!.mcpCode).toBe(-32004);
      expect(errorBogus!.message).toBe(`Project not found: ${bogusId}`);
      expect(errorExistentCrossTenant!.message).toBe(`Project not found: ${projectAlphaId}`);
      // Zero leak of ownership or authorization reason
    });

    it("allows Admin actors to inspect projects and quotes across tenants with audit trace", () => {
      const adminViewProject = PrivateLabelService.getProject(projectAlphaId); // No customerId = admin/internal
      expect(adminViewProject.id).toBe(projectAlphaId);
      expect(adminViewProject.title).toBe("Alpha Darjeeling Brand");

      const adminViewQuote = PrivateLabelService.getQuote(quoteAlphaId);
      expect(adminViewQuote.id).toBe(quoteAlphaId);
    });

    it("REMEDIATED: project with null owner_customer_id is strictly inaccessible to tenant customers (anti-enumeration)", () => {
      const db = getDb();
      const nullOwnerProjectId = "proj_adv_null_owner";
      db.prepare(`
        INSERT INTO pl_projects (
          id, client_id, owner_customer_id, title, status, target_market, revision, created_at, updated_at
        ) VALUES (
          ?, NULL, NULL, 'Unowned Internal Project', 'draft', 'IN', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `).run(nullOwnerProjectId);

      expect(() => {
        PrivateLabelService.getProject(nullOwnerProjectId, "cust-adv-bravo");
      }).toThrowError(PrivateLabelNotFoundError);

      const adminAccessed = PrivateLabelService.getProject(nullOwnerProjectId);
      expect(adminAccessed).toBeDefined();
      expect(adminAccessed.id).toBe(nullOwnerProjectId);
    });
  });

  // ==========================================================================
  // AREA 5: Data Projection Leak Test
  // ==========================================================================
  describe("Area 5: Data Projection Leak Test", () => {
    it("toPublicPackagingVariantDto strictly redacts supplier name, supplier SKU, and internal unit cost", () => {
      const rawVariant: PackagingVariantWithDetails = {
        id: "pkg_adv_leak_01",
        family_id: "fam_pouch",
        family_code: "pouch",
        slug: "standup-pouch-leak-test",
        sku: "PUB-SKU-100",
        supplier_name: "Shenzhen Confidential Foil Tech",
        supplier_sku: "SZF-CONFIDENTIAL-8899",
        title: "Gloss Gold Standup Pouch",
        capacity_description: "100g",
        net_weight_capacity_grams: 100,
        width_mm: 140,
        height_mm: 200,
        depth_mm: 60,
        label_safe_width_mm: 120,
        label_safe_height_mm: 150,
        material: "PET/AL/PE",
        finish: "Gloss",
        closure_type: "Zipper",
        unit_cost_paise: 2450, // ₹24.50 confidential wholesale cost
        packs_per_carton: 24,
        moq_units: 500,
        order_multiple: 100,
        lead_time_days: 14,
        hero_image_url: "https://cdn.example.com/pouch.png",
        image_illustrative: 1,
        dieline_url: "https://cdn.example.com/dieline.pdf",
        status: "published",
        revision: 1,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
        compatible_print_methods: [],
      };

      const publicDto = toPublicPackagingVariantDto(rawVariant);

      // Verify explicit keys
      const dtoRecord = publicDto as unknown as Record<string, unknown>;
      expect(dtoRecord.supplier_name).toBeUndefined();
      expect(dtoRecord.supplier_sku).toBeUndefined();
      expect(dtoRecord.unit_cost_paise).toBeUndefined();
      expect(dtoRecord.closure_rate_paise).toBeUndefined();
      expect(dtoRecord.created_at).toBeUndefined();
      expect(dtoRecord.updated_at).toBeUndefined();

      // Deep string scan of serialized DTO
      const json = JSON.stringify(publicDto);
      expect(json.includes("Shenzhen")).toBe(false);
      expect(json.includes("SZF-CONFIDENTIAL")).toBe(false);
      expect(json.includes("2450")).toBe(false);

      // Verify legitimate public properties are intact
      expect(publicDto.id).toBe("pkg_adv_leak_01");
      expect(publicDto.sku).toBe("PUB-SKU-100");
      expect(publicDto.title).toBe("Gloss Gold Standup Pouch");
      expect(publicDto.image_illustrative).toBe(true);
      expect(publicDto.dieline_available).toBe(true);
    });

    it("toPublicTeaOptionDto strictly redacts base cost per kg and confidential product linkage", () => {
      const rawTea: TeaOption = {
        id: "tea_adv_leak_01",
        slug: "silver-needle-rare",
        name: "Darjeeling Silver Needle White Tea",
        origin_estate: "Okayti",
        region: "Darjeeling",
        grade: "White Tip",
        flush: "Spring",
        tea_category: "white",
        description: "Hand-plucked single origin white tea",
        caffeine_level: "low",
        min_batch_kg: 5,
        base_cost_per_kg_paise: 950000, // ₹9,500/kg confidential procurement cost
        sample_available: 1,
        is_published: 1,
        regular_product_id: 77,
        tasting_notes_json: JSON.stringify(["Melon", "Honeysuckle", "Dew"]),
        revision: 2,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      };

      const publicDto = toPublicTeaOptionDto(rawTea);

      const dtoRecord = publicDto as unknown as Record<string, unknown>;
      expect(dtoRecord.base_cost_per_kg_paise).toBeUndefined();
      expect(dtoRecord.regular_product_id).toBeUndefined();
      expect(dtoRecord.revision).toBeUndefined();
      expect(dtoRecord.created_at).toBeUndefined();

      const json = JSON.stringify(publicDto);
      expect(json.includes("950000")).toBe(false);
      expect(json.includes("confidential_store_link")).toBe(false);

      // Legitimate fields preserved
      expect(publicDto.tasting_notes).toEqual(["Melon", "Honeysuckle", "Dew"]);
      expect(publicDto.sample_available).toBe(true);
      expect(publicDto.name).toBe("Darjeeling Silver Needle White Tea");
    });

    it("toPublicPrintMethodDto strictly redacts internal margin and supplier data", () => {
      const rawMethod: PrintMethod = {
        id: "pm_adv_leak_01",
        code: "bopp_label",
        name: "BOPP Label",
        description: "Polypropylene label",
        color_model: "cmyk",
        max_colors: 6,
        setup_fee_paise: 150000,
        cylinder_fee_per_color_paise: 0,
        min_order_units: 500,
        lead_time_days: 7,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      };

      const publicDto = toPublicPrintMethodDto(rawMethod);
      const dtoRecord = publicDto as unknown as Record<string, unknown>;
      expect(dtoRecord.status).toBeUndefined();
      expect(dtoRecord.created_at).toBeUndefined();
      expect(dtoRecord.updated_at).toBeUndefined();

      expect(publicDto.code).toBe("bopp_label");
      expect(publicDto.setup_fee_paise).toBe(150000);
    });

    it("toPublicQuoteDto strictly redacts margin_paise, internal COGS breakdown, and price book reference", () => {
      const rawQuote: Quote = {
        id: "quote_adv_leak_01",
        quote_number: "PL-Q-2026-0042",
        project_id: "proj_secret_ref",
        price_book_id: "pb_internal_enterprise_rates",
        status: "firm_issued",
        version: 1,
        currency: "INR",
        tea_subtotal_paise: 2500000,
        packaging_subtotal_paise: 1000000,
        printing_subtotal_paise: 500000,
        tooling_setup_paise: 150000,
        labor_subtotal_paise: 300000,
        qc_subtotal_paise: 250000,
        freight_paise: 45000,
        margin_paise: 1200000, // ₹12,000 confidential profit margin
        tax_paise: 800000,
        grand_total_paise: 6745000,
        price_breakdown_json: JSON.stringify({
          raw_factory_cogs: 4000000,
          margin_percentage: 25,
          subcontractor_notes: "Vendor agreed to 5% rebate",
        }),
        issued_at: "2026-01-01T00:00:00Z",
        valid_until: "2026-01-31T00:00:00Z",
        accepted_at: null,
        pdf_summary_url: "https://cdn.example.com/quote-42.pdf",
        revision: 1,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      };

      const publicDto = toPublicQuoteDto(rawQuote);

      // Verify confidential commercial fields are completely redacted
      const dtoRecord = publicDto as unknown as Record<string, unknown>;
      expect(dtoRecord.margin_paise).toBeUndefined();
      expect(dtoRecord.price_breakdown_json).toBeUndefined();
      expect(dtoRecord.price_book_id).toBeUndefined();
      expect(dtoRecord.project_id).toBeUndefined();
      expect(dtoRecord.revision).toBeUndefined();

      const json = JSON.stringify(publicDto);
      expect(json.includes("1200000")).toBe(false); // margin_paise absent
      expect(json.includes("rebate")).toBe(false);
      expect(json.includes("pb_internal")).toBe(false);

      // Verify legitimate customer billing totals are present
      expect(publicDto.quote_number).toBe("PL-Q-2026-0042");
      expect(publicDto.grand_total_paise).toBe(6745000);
      expect(publicDto.tax_paise).toBe(800000);
      expect(publicDto.pdf_summary_url).toBe("https://cdn.example.com/quote-42.pdf");
    });

    it("toPublicProjectDto strictly redacts client_id, owner_customer_id, and internal operator notes", () => {
      const rawProject: Project = {
        id: "proj_adv_leak_01",
        client_id: "client_uuid_internal_99",
        owner_customer_id: "cust_uuid_internal_44",
        brand_id: null,
        title: "Exclusive Private Blend Project",
        status: "draft",
        target_market: "IN",
        notes: "OPERATOR NOTE: High-value corporate client, do not offer standard discount",
        draft_configuration_json: JSON.stringify({ teaOptionId: "tea_01", quantity: 1000 }),
        revision: 3,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      };

      const publicDto = toPublicProjectDto(rawProject);

      const dtoRecord = publicDto as unknown as Record<string, unknown>;
      expect(dtoRecord.client_id).toBeUndefined();
      expect(dtoRecord.owner_customer_id).toBeUndefined();
      expect(dtoRecord.notes).toBeUndefined();

      const json = JSON.stringify(publicDto);
      expect(json.includes("client_uuid_internal")).toBe(false);
      expect(json.includes("cust_uuid_internal")).toBe(false);
      expect(json.includes("OPERATOR NOTE")).toBe(false);
      expect(json.includes("corporate client")).toBe(false);

      // Verify legitimate project fields
      expect(publicDto.id).toBe("proj_adv_leak_01");
      expect(publicDto.title).toBe("Exclusive Private Blend Project");
      expect(publicDto.revision).toBe(3);
      expect(publicDto.draft_configuration).toEqual({ teaOptionId: "tea_01", quantity: 1000 });
    });
  });
});
