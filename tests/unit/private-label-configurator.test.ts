/**
/**
 * TeaFloww Private Label Studio — Milestone M4 Configurator & 12-Component Pricing Unit Test Suite
 * File: tests/unit/private-label-configurator.test.ts
 *
 * Verifies:
 * 1. 12-Component itemized pricing calculations, test vectors, zero-drift integer paise, and dual-rate GST (5% tea vs 18% non-tea).
 * 2. Multi-dimensional MOQ calculation, batch kg conversions, order multiples, and deterministic blocker strings.
 * 3. Packaging x print compatibility matrix, invalidation rules, and mechanical safe-zone geometry.
 * 4. Pure Node.js branded PDF buffer generation (PDF-1.4 header, Nirva GSTIN 19CTHPK8646J2ZY, Siliguri works, expired watermark).
 * 5. Public quote DTO projections strictly redacting margin_paise, supplier COGS, and private notes.
 * 6. REST API routes and business gate enforcement (CAS 409 conflict, tenant 404 isolation, stateless calculation endpoints).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

const TEST_DB = path.join(tmpdir(), `pl-configurator-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

import { getDb } from "@/lib/db";
import { PrivateLabelService } from "@/lib/private-label/service";
import { calculateItemized12ComponentQuote } from "@/lib/private-label/pricing";
import { calculateMOQ } from "@/lib/private-label/moq";
import {
  validateCompatibility,
  calculateSafeZone,
} from "@/lib/private-label/compatibility";
import {
  generateQuotationPdfBuffer,
  generatePrintableQuotationHtml,
  formatPaiseToInr,
  formatCurrency,
  TEAFLOWW_BRAND_CONSTANTS,
} from "@/lib/private-label/pdf";
import {
  toPublicQuoteWithItemsDto,
  toPublicQuoteItemDto,
} from "@/lib/private-label/public-dto";
import {
  PrivateLabelRevisionConflictError,
  PrivateLabelNotFoundError,
  PrivateLabelGateError,
  type AuditActor,
  type QuoteWithItems,
} from "@/lib/private-label/types";

// Import API route handlers for direct unit testing
import { POST as handleMoqCalculate } from "@/app/api/v1/private-label/moq/calculate/route";
import { POST as handleQuoteCalculate } from "@/app/api/v1/private-label/quotes/calculate/route";
import { GET as handleGetPdf } from "@/app/api/v1/private-label/quotes/[id]/pdf/route";

const ACTOR_CUSTOMER_A: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-m4-001",
  actor_email: "alice@himalayantraders.in",
};

const ACTOR_CUSTOMER_B: AuditActor = {
  actor_type: "customer",
  actor_id: "cust-m4-002",
  actor_email: "bob@overseastea.com",
};

describe("Milestone M4: Configurator & 12-Component Quotation Engine", () => {
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
      VALUES ('cust-m4-001', 'alice@himalayantraders.in', 'Alice Himalayan Traders'),
             ('cust-m4-002', 'bob@overseastea.com', 'Bob Overseas Tea')
    `).run();

    // Seed test tea option
    db.prepare(`
      INSERT OR IGNORE INTO pl_tea_options (
        id, slug, name, origin_estate, region, grade, flush, tea_category,
        description, caffeine_level, base_cost_per_kg_paise, min_batch_kg,
        is_published, sample_available, revision
      ) VALUES (
        'tea_001', 'singbulli-first-flush', 'Singbulli First Flush FTGFOP1', 'Singbulli Estate',
        'Darjeeling', 'FTGFOP1', 'First Flush', 'black', 'Floral Darjeeling first flush',
        'medium', 120000, 5.0, 1, 1, 1
      )
    `).run();

    // Seed test packaging variant
    db.prepare(`
      INSERT OR IGNORE INTO pl_packaging_variants (
        id, family_id, slug, sku, title, material, finish, closure_type,
        capacity_description, net_weight_capacity_grams, width_mm, height_mm,
        label_safe_width_mm, label_safe_height_mm, supplier_name, unit_cost_paise,
        moq_units, order_multiple, status, revision
      ) VALUES (
        'pack_001', 'fam_pouch', 'matte-black-kraft-pouch-100g', 'PL-MBK-100G',
        'Matte Black Barrier Pouch 100g', 'Kraft/Aluminum Foil', 'Matte Soft-Touch',
        'Resealable Zipper', '100g net capacity', 100.0, 160.0, 230.0,
        140.0, 180.0, 'Siliguri Packaging Ltd', 2400,
        500, 50, 'published', 1
      )
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
    } catch {}
  });

  // ==========================================================================
  // Suite 1: 12-Component Itemized Pricing Engine & Dual-Rate Indian GST
  // ==========================================================================
  describe("1. 12-Component Pricing Engine & Dual-Rate Indian GST", () => {
    it("computes all 12 cost components accurately for a standard pouch run", () => {
      const result = calculateItemized12ComponentQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: {
          id: "tea_001",
          baseCostPerKgPaise: 120000, // ₹1,200.00 / kg
          minBatchKg: 5.0,
        },
        packagingVariant: {
          id: "pack_001",
          unitCostPaise: 2400, // ₹24.00
          closureRatePaise: 50, // ₹0.50
          tareWeightGrams: 18,
          packsPerCarton: 50,
        },
        printMethod: {
          id: "pm_direct_digital",
          code: "direct_digital",
          setupFeePaise: 150000, // ₹1,500.00
          cylinderFeePerColorPaise: 0,
        },
        colorCount: 4,
        isNitrogenFlushEnabled: true,
        destinationZone: "metro",
      });

      expect(result.status).toBe("firm_issued");
      expect(result.requiresOperatorReview).toBe(false);
      expect(result.breakdown).toBeDefined();

      const b = result.breakdown!;

      // 1. Base tea cost: netKg = (1000 * 100)/1000 = 100kg. grossKg = 100 * 1.03 = 103kg.
      // teaCost = 103 * 120000 = 12,360,000 paise (₹123,600.00)
      expect(b.metrics.netTeaKg).toBe(100);
      expect(b.metrics.grossTeaKg).toBe(103);
      expect(b.teaCostPaise).toBe(12360000);

      // 2. Primary packaging: 1000 * 2400 = 2,400,000 paise
      expect(b.packagingCostPaise).toBe(2400000);

      // 3. Print run cost: direct digital fallback = 450p * 1000 = 450,000 paise
      expect(b.printingCostPaise).toBe(450000);

      // 4. Tooling / cylinders: setup fee = 150,000 paise, cylinders = 0
      expect(b.toolingSetupPaise).toBe(150000);

      // 5. Closures & secondary labels: 1000 * 50 = 50,000 paise
      expect(b.closureFinishingCostPaise).toBe(50000);

      // 6. Nitrogen flushing: 1000 * 75 = 75,000 paise
      expect(b.nitrogenFlushingCostPaise).toBe(75000);

      // 7. Cleanroom filling labor: 1000 * 300 = 300,000 paise
      expect(b.laborCostPaise).toBe(300000);

      // 8. QC sensory tasting: 11 batches of 10kg max * 250,000 = 2,750,000 paise
      expect(b.metrics.batchCount).toBe(11);
      expect(b.qcCostPaise).toBe(2750000);

      // 9. Master cartons: 1000 / 50 = 20 cartons. 20 * 6,000 = 120,000 paise
      expect(b.metrics.cartonCount).toBe(20);
      expect(b.cartonCostPaise).toBe(120000);

      // 10. Palletizing: 20 cartons >= 20 cartons -> 1 pallet * 75,000 = 75,000 paise
      expect(b.metrics.palletCount).toBe(1);
      expect(b.palletizingCostPaise).toBe(75000);

      // 11. Zoned freight: total weight ~ 103kg (tea) + 18kg (pack) + 12kg (cartons) = 133kg.
      // Metro rate = ₹350 + (133 * 55) = ₹350 + ₹7,315 = ₹7,665 = 766,500 paise
      expect(b.freightCostPaise).toBeGreaterThan(700000);

      // 12. Direct subtotal is sum of direct components
      expect(b.subtotalDirectPaise).toBe(
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
          b.freightCostPaise
      );

      // Margin: default 25% on subtotalDirectPaise
      expect(b.marginPaise).toBe(Math.round(b.subtotalDirectPaise * 0.25));

      // Dual-Rate Indian GST:
      // Tea GST = 5% of teaCostPaise (with margin share)
      // Non-Tea GST = 18% of non-tea taxable base
      expect(b.taxDetails.teaGstPaise).toBeGreaterThan(0);
      expect(b.taxDetails.nonTeaGstPaise).toBeGreaterThan(0);
      expect(b.taxPaise).toBe(b.taxDetails.teaGstPaise + b.taxDetails.nonTeaGstPaise);

      // Grand total = direct + margin + tax
      expect(b.grandTotalPaise).toBe(b.subtotalDirectPaise + b.marginPaise + b.taxPaise);

      // Unit price = round(grandTotalPaise / 1000)
      expect(b.unitPricePaise).toBe(Math.round(b.grandTotalPaise / 1000));
    });

    it("applies cylinder tooling charges strictly when print method is rotogravure", () => {
      const gravureResult = calculateItemized12ComponentQuote({
        requestedUnits: 5000,
        netWeightGrams: 250,
        teaOption: { id: "tea_001", baseCostPerKgPaise: 100000 },
        packagingVariant: { id: "pack_001", unitCostPaise: 3000 },
        printMethod: {
          id: "pm_gravure",
          code: "gravure",
          setupFeePaise: 200000, // ₹2,000 setup
          cylinderFeePerColorPaise: 800000, // ₹8,000 per cylinder
        },
        colorCount: 6, // 6 cylinders
      });

      // Tooling fee = 200,000 setup + (6 * 800,000) = 5,000,000 paise (₹50,000.00)
      expect(gravureResult.breakdown?.toolingSetupPaise).toBe(5000000);
    });

    it("applies quantity break discounts when activeTiers are provided", () => {
      const tieredResult = calculateItemized12ComponentQuote({
        requestedUnits: 2500,
        netWeightGrams: 100,
        teaOption: { id: "tea_001", baseCostPerKgPaise: 120000 },
        packagingVariant: { id: "pack_001", unitCostPaise: 2400 },
        printMethod: { id: "pm_001", code: "direct_digital" },
        activeTiers: [
          {
            item_type: "packaging",
            item_id: "pack_001",
            min_qty: 2000,
            max_qty: 4999,
            unit_price_paise: 1950, // Discount from 2400p to 1950p
          },
        ],
      });

      // Packaging cost should reflect tier rate 1950p
      expect(tieredResult.breakdown?.packagingCostPaise).toBe(2500 * 1950);
      expect(tieredResult.breakdown?.appliedTiers?.packagingTierPricePaise).toBe(1950);
    });

    it("requires manual operator review for international destination freight", () => {
      const intlResult = calculateItemized12ComponentQuote({
        requestedUnits: 1000,
        netWeightGrams: 100,
        teaOption: { id: "tea_001", baseCostPerKgPaise: 100000 },
        packagingVariant: { id: "pack_001", unitCostPaise: 2000 },
        printMethod: { id: "pm_direct_digital", code: "direct_digital" },
        destinationZone: "international",
      });

      expect(intlResult.status).toBe("manual_quote_required");
      expect(intlResult.requiresOperatorReview).toBe(true);
      expect(intlResult.missingRates).toContain("international_freight_requires_quote");
    });
  });

  // ==========================================================================
  // Suite 2: Multi-Dimensional MOQ Engine & Batch Constraints
  // ==========================================================================
  describe("2. Multi-Dimensional MOQ Engine", () => {
    it("enforces tea batch minimum kg and converts to minimum required units", () => {
      // 5.0 kg minimum blend at 100g/pack requires ceil((5.0 * 1000) / 100) = 50 packs
      const moq1 = calculateMOQ({
        requestedUnits: 30,
        netWeightGrams: 100,
        teaMinBatchKg: 5.0,
        packagingMOQ: 10,
        printMOQ: 10,
      });

      expect(moq1.eligible).toBe(false);
      expect(moq1.teaUnitsRequired).toBe(50);
      expect(moq1.reasons[0]).toContain("below minimum tea blending batch");

      // Meeting 50 units satisfies the constraint
      const moq2 = calculateMOQ({
        requestedUnits: 100,
        netWeightGrams: 100,
        teaMinBatchKg: 5.0,
        packagingMOQ: 100,
        printMOQ: 100,
        fillingMOQ: 100,
      });
      expect(moq2.eligible).toBe(true);
    });

    it("enforces master carton order multiple alignment and computes next valid quantity", () => {
      const moq = calculateMOQ({
        requestedUnits: 535,
        netWeightGrams: 100,
        teaMinBatchKg: 5.0,
        packagingMOQ: 500,
        printMOQ: 100,
        orderMultiple: 50,
      });

      expect(moq.eligible).toBe(false);
      expect(moq.nextValidUnits).toBe(550); // ceil(535/50)*50 = 550
      expect(moq.reasons.some((r) => r.includes("exact multiple of 50"))).toBe(true);
    });
  });

  // ==========================================================================
  // Suite 3: Packaging × Print Compatibility & Safe-Zone Geometry
  // ==========================================================================
  describe("3. Packaging Compatibility & Safe-Zone Geometry", () => {
    it("validates that pre-formed metal tins reject direct digital and rotogravure", () => {
      const digitalOnTin = validateCompatibility({
        familyCode: "tin",
        printMethodCode: "direct_digital",
      });
      expect(digitalOnTin.compatible).toBe(false);

      const gravureOnTin = validateCompatibility({
        familyCode: "tin",
        printMethodCode: "gravure",
      });
      expect(gravureOnTin.compatible).toBe(false);

      const screenOnTin = validateCompatibility({
        familyCode: "tin",
        printMethodCode: "screen_print",
        colorCount: 2,
      });
      expect(screenOnTin.compatible).toBe(true);
    });

    it("validates that flexible pouches accept digital, gravure, and labels, but reject screen printing", () => {
      const screenOnPouch = validateCompatibility({
        familyCode: "pouch",
        printMethodCode: "screen_print",
      });
      expect(screenOnPouch.compatible).toBe(false);

      const digitalOnPouch = validateCompatibility({
        familyCode: "pouch",
        printMethodCode: "direct_digital",
      });
      expect(digitalOnPouch.compatible).toBe(true);
    });

    it("computes mechanical safe-zone margins and bleed for flexible pouch structures", () => {
      const pouchSafe = calculateSafeZone("pouch", 160, 230);
      expect(pouchSafe.marginsMm.top).toBe(35); // 35mm top reserve for zipper & notch
      expect(pouchSafe.marginsMm.bottom).toBe(15); // 15mm bottom gusset
      expect(pouchSafe.marginsMm.left).toBe(10);
      expect(pouchSafe.marginsMm.right).toBe(10);
      expect(pouchSafe.labelSafeWidthMm).toBe(160 - 20); // 140mm
      expect(pouchSafe.labelSafeHeightMm).toBe(230 - 50); // 180mm
      expect(pouchSafe.bleedMm).toBe(3);
    });
  });

  // ==========================================================================
  // Suite 4: Pure Node.js Branded PDF Buffer & Printable HTML Generation
  // ==========================================================================
  describe("4. Branded Quotation PDF & Printable HTML Engine", () => {
    const mockQuote: QuoteWithItems = {
      id: "quote_test_001",
      quote_number: "TF-PLQ-20261110-0001",
      project_id: "proj_test_001",
      price_book_id: "pb_default",
      status: "firm_issued",
      version: 1,
      revision: 1,
      currency: "INR",
      tea_subtotal_paise: 12360000,
      packaging_subtotal_paise: 2400000,
      printing_subtotal_paise: 450000,
      tooling_setup_paise: 150000,
      labor_subtotal_paise: 300000,
      qc_subtotal_paise: 250000,
      freight_paise: 766500,
      margin_paise: 4169125,
      tax_paise: 1850000,
      grand_total_paise: 22695625,
      price_breakdown_json: JSON.stringify({
        taxDetails: { teaGstPaise: 720000, nonTeaGstPaise: 1130000 },
        metrics: { netTeaKg: 100, grossTeaKg: 103, cartonCount: 20 },
      }),
      valid_until: new Date(Date.now() + 14 * 86400 * 1000).toISOString(),
      issued_at: new Date().toISOString(),
      accepted_at: null,
      pdf_summary_url: "/private-label/quotes/quote_test_001/print",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        {
          id: "item_001",
          quote_id: "quote_test_001",
          project_item_id: "pi_001",
          description: "Single-Estate Darjeeling First Flush in 100g Matte Barrier Pouch",
          quantity: 1000,
          unit_price_paise: 22696,
          line_total_paise: 22695625,
          cost_breakdown_json: "{}",
          created_at: new Date().toISOString(),
        },
      ],
    };

    it("generates a valid binary PDF-1.4 buffer with Nirva brand constants and GSTIN", () => {
      const buffer = generateQuotationPdfBuffer(mockQuote);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(500);

      const pdfHeader = buffer.subarray(0, 8).toString("ascii");
      expect(pdfHeader).toContain("%PDF-1.4");

      const pdfContent = buffer.toString("binary");
      expect(pdfContent).toContain(TEAFLOWW_BRAND_CONSTANTS.entityName);
      expect(pdfContent).toContain(TEAFLOWW_BRAND_CONSTANTS.gstin);
      expect(pdfContent).toContain("%%EOF");
    });

    it("watermarks expired quotes clearly in PDF buffer", () => {
      const expiredQuote: QuoteWithItems = {
        ...mockQuote,
        valid_until: new Date(Date.now() - 86400 * 1000).toISOString(), // yesterday
      };

      const buffer = generateQuotationPdfBuffer(expiredQuote);
      const pdfContent = buffer.toString("binary");
      expect(pdfContent).toContain("EXPIRED");
    });

    it("generates semantic printable HTML layout with print rules and 50/50 payment terms", () => {
      const html = generatePrintableQuotationHtml(mockQuote);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("19CTHPK8646J2ZY");
      expect(html).toContain("50 / 50 Milestone Schedule");
      expect(html).toContain("14-Day Price Lock Guarantee");
      expect(html).toContain("@media print");
    });

    it("formats currencies correctly for international buyers", () => {
      expect(formatPaiseToInr(22695625)).toBe("₹2,26,956.25");
      expect(formatCurrency(840000, "USD")).toContain("$");
      expect(formatCurrency(900000, "EUR")).toContain("€");
    });
  });

  // ==========================================================================
  // Suite 5: Whitelist Public DTO Projections
  // ==========================================================================
  describe("5. Whitelist Public DTO Projections", () => {
    it("redacts margin_paise, supplier COGS, and private notes from public quote DTO", () => {
      const quote: QuoteWithItems = {
        id: "quote_secret_001",
        quote_number: "TF-PLQ-SECRET",
        project_id: "proj_secret",
        price_book_id: "pb_001",
        status: "firm_issued",
        version: 1,
        revision: 1,
        currency: "INR",
        tea_subtotal_paise: 1000000,
        packaging_subtotal_paise: 500000,
        printing_subtotal_paise: 200000,
        tooling_setup_paise: 100000,
        labor_subtotal_paise: 100000,
        qc_subtotal_paise: 250000,
        freight_paise: 150000,
        margin_paise: 800000, // HIGHLY CONFIDENTIAL
        tax_paise: 400000,
        grand_total_paise: 3500000,
        price_breakdown_json: JSON.stringify({
          marginPaise: 800000,
          supplierCogs: 1200000,
          internalNotes: "Special supplier discount negotiated",
        }),
        valid_until: null,
        issued_at: null,
        accepted_at: null,
        pdf_summary_url: "/print",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        items: [],
      };

      const publicDto = toPublicQuoteWithItemsDto(quote);

      expect((publicDto as any).margin_paise).toBeUndefined();
      expect((publicDto as any).price_breakdown_json).toBeUndefined();
      expect(publicDto.grand_total_paise).toBe(3500000);
      expect(publicDto.tea_subtotal_paise).toBe(1000000);
    });

    it("redacts supplier piece-rates and supplier IDs from public quote items", () => {
      const item = {
        id: "item_sec_01",
        quote_id: "q_01",
        project_item_id: "pi_01",
        line_number: 1,
        description: "100g Pouch Darjeeling",
        quantity: 500,
        unit_price_paise: 1500,
        line_total_paise: 750000,
        supplier_id: "secret_supplier_99",
        supplier_piece_rate: 900,
        cost_breakdown_json: '{"supplier_cogs": 450000}',
        created_at: new Date().toISOString(),
      };

      const publicItem = toPublicQuoteItemDto(item as any);
      expect((publicItem as any).supplier_id).toBeUndefined();
      expect((publicItem as any).supplier_piece_rate).toBeUndefined();
      expect((publicItem as any).cost_breakdown_json).toBeUndefined();
      expect(publicItem.unit_price_paise).toBe(1500);
    });
  });

  // ==========================================================================
  // Suite 6: Domain Service Operations, Synchronized Items & CAS Gating
  // ==========================================================================
  describe("6. Domain Service Operations & CAS Concurrency", () => {
    it("synchronizes project items upon draft creation and CAS update", () => {
      const draft = PrivateLabelService.createProjectDraft(
        {
          title: "Multi-Item Project",
          target_market: "IN",
          items: [
            {
              tea_option_id: "tea_001",
              packaging_variant_id: "pack_001",
              print_method_id: "pm_direct_digital",
              fill_weight_grams: 100,
              quantity_units: 1000,
              color_count: 4,
            },
          ],
        },
        "cust-m4-001",
        ACTOR_CUSTOMER_A
      );

      expect(draft.revision).toBe(1);

      // Verify item was persisted
      const db = getDb();
      const items = db
        .prepare("SELECT * FROM pl_project_items WHERE project_id = ?")
        .all(draft.id) as any[];
      expect(items.length).toBe(1);
      expect(items[0].tea_option_id).toBe("tea_001");
      expect(items[0].quantity_units).toBe(1000);

      // Update project with CAS revision check
      const updated = PrivateLabelService.updateProjectDraft(
        draft.id,
        1,
        {
          title: "Multi-Item Project Updated",
          items: [
            {
              tea_option_id: "tea_001",
              packaging_variant_id: "pack_001",
              print_method_id: "pm_direct_digital",
              fill_weight_grams: 250,
              quantity_units: 2500,
              color_count: 4,
            },
          ],
        },
        ACTOR_CUSTOMER_A,
        "cust-m4-001"
      );

      expect(updated.revision).toBe(2);

      const itemsUpdated = db
        .prepare("SELECT * FROM pl_project_items WHERE project_id = ?")
        .all(draft.id) as any[];
      expect(itemsUpdated.length).toBe(1);
      expect(itemsUpdated[0].fill_weight_grams).toBe(250);
      expect(itemsUpdated[0].quantity_units).toBe(2500);

      // Concurrent update with stale revision 1 must throw CAS conflict error
      expect(() =>
        PrivateLabelService.updateProjectDraft(
          draft.id,
          1, // Stale! Revision is now 2
          { title: "Stale Concurrent Update" },
          ACTOR_CUSTOMER_A,
          "cust-m4-001"
        )
      ).toThrow(PrivateLabelRevisionConflictError);
    });

    it("enforces tenant isolation and throws PrivateLabelNotFoundError on cross-tenant access", () => {
      const draftA = PrivateLabelService.createProjectDraft(
        { title: "Client A Project" },
        "cust-m4-001",
        ACTOR_CUSTOMER_A
      );

      // Client B attempts to read Client A's project
      expect(() =>
        PrivateLabelService.getProject(draftA.id, "cust-m4-002")
      ).toThrow(PrivateLabelNotFoundError);

      // Client B attempts to update Client A's project
      expect(() =>
        PrivateLabelService.updateProjectDraft(
          draftA.id,
          1,
          { title: "Unauthorized Overwrite" },
          ACTOR_CUSTOMER_B,
          "cust-m4-002"
        )
      ).toThrow(PrivateLabelNotFoundError);
    });

    it("rejects physically incompatible printing and over-capacity fills on the server", () => {
      const base = { tea_option_id: "tea_001", packaging_variant_id: "pack_001", print_method_id: "pm_screen_print", fill_weight_grams: 100, quantity_units: 1000, color_count: 2 };
      const project = PrivateLabelService.createProjectDraft({ title: "Invalid print configuration", items: [base] }, "cust-m4-001", ACTOR_CUSTOMER_A);
      expect(() => PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-m4-001")).toThrow(PrivateLabelGateError);
      expect(() => PrivateLabelService.calculateLiveQuote({ teaOptionId: "tea_001", packagingVariantId: "pack_001", printMethodId: "pm_paper_label", requestedUnits: 1000, netWeightGrams: 100, colorCount: 8 })).toThrow(PrivateLabelGateError);
      expect(() => PrivateLabelService.calculateLiveQuote({ teaOptionId: "tea_001", packagingVariantId: "pack_001", printMethodId: "pm_bopp_label", requestedUnits: 1000, netWeightGrams: 250, colorCount: 4 })).toThrow(PrivateLabelGateError);
    });

    it("uses unique quote identifiers rather than a four-digit random number pool", () => {
      const item = { tea_option_id: "tea_001", packaging_variant_id: "pack_001", print_method_id: "pm_direct_digital", fill_weight_grams: 100, quantity_units: 1000 };
      const project = PrivateLabelService.createProjectDraft({ title: "Unique quote numbers", items: [item] }, "cust-m4-001", ACTOR_CUSTOMER_A);
      const first = PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-m4-001");
      const second = PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-m4-001");
      expect(first.quote_number).toMatch(/^TF-PLQ-\d{8}-[A-F0-9]{32}$/);
      expect(second.quote_number).not.toBe(first.quote_number);
    });

    it("saves edits after quoting without deleting referenced items or changing quote snapshots", () => {
      const item = { tea_option_id: "tea_001", packaging_variant_id: "pack_001", print_method_id: "pm_direct_digital", fill_weight_grams: 100, quantity_units: 1000 };
      const project = PrivateLabelService.createProjectDraft({ title: "Quoted draft edits", items: [item] }, "cust-m4-001", ACTOR_CUSTOMER_A);
      const oldItemId = PrivateLabelService.getProject(project.id, "cust-m4-001").items[0].id;
      const quote = PrivateLabelService.createQuote(project.id, {}, ACTOR_CUSTOMER_A, "cust-m4-001");
      PrivateLabelService.updateProjectDraft(project.id, project.revision, { items: [{ ...item, quantity_units: 2500 }], draft_configuration: { brandName: "Revised preview" } }, ACTOR_CUSTOMER_A, "cust-m4-001");
      const updated = PrivateLabelService.getProject(project.id, "cust-m4-001");
      expect(updated.items[0].id).toBe(oldItemId);
      expect(updated.items[0].quantity_units).toBe(2500);
      expect(PrivateLabelService.getQuote(quote.id, "cust-m4-001").items[0].quantity).toBe(1000);
    });

    it("enforces MOQ gate during createQuote and generates 12-component items upon success", () => {
      // 1. Create project with quantity 20 packs (below MOQ of 500)
      const lowMoqProj = PrivateLabelService.createProjectDraft(
        {
          title: "Low MOQ Project",
          items: [
            {
              tea_option_id: "tea_001",
              packaging_variant_id: "pack_001",
              print_method_id: "pm_direct_digital",
              fill_weight_grams: 100,
              quantity_units: 20, // VIOLATION!
            },
          ],
        },
        "cust-m4-001",
        ACTOR_CUSTOMER_A
      );

      expect(() =>
        PrivateLabelService.createQuote(
          lowMoqProj.id,
          {},
          ACTOR_CUSTOMER_A,
          "cust-m4-001"
        )
      ).toThrow(PrivateLabelGateError);

      // 2. Create project with valid MOQ (1,000 units)
      const validProj = PrivateLabelService.createProjectDraft(
        {
          title: "Valid MOQ Project",
          items: [
            {
              tea_option_id: "tea_001",
              packaging_variant_id: "pack_001",
              print_method_id: "pm_direct_digital",
              fill_weight_grams: 100,
              quantity_units: 1000,
              color_count: 4,
            },
          ],
        },
        "cust-m4-001",
        ACTOR_CUSTOMER_A
      );

      const quote = PrivateLabelService.createQuote(
        validProj.id,
        { validity_days: 14, destination_zone: "metro" },
        ACTOR_CUSTOMER_A,
        "cust-m4-001"
      );

      expect(quote.status).toBe("estimated");
      expect(quote.quote_number).toMatch(/^TF-PLQ-\d{8}-[A-F0-9]{32}$/);
      expect(quote.valid_until).toBeDefined();
      expect(quote.pdf_summary_url).toBe(`/private-label/quotes/${quote.id}/print`);
      expect(quote.grand_total_paise).toBeGreaterThan(0);
      expect(quote.items.length).toBe(1);
      expect(quote.items[0].quantity).toBe(1000);
      expect(quote.items[0].unit_price_paise).toBeGreaterThan(0);
    });
  });

  // ==========================================================================
  // Suite 7: REST API Route Handlers
  // ==========================================================================
  describe("7. REST API Route Handlers", () => {
    it("handles stateless MOQ calculation via POST /api/v1/private-label/moq/calculate", async () => {
      const req = new Request("http://localhost/api/v1/private-label/moq/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_units: 1000,
          net_weight_grams: 100,
          tea_min_batch_kg: 5.0,
          packaging_moq: 500,
          print_moq: 100,
          order_multiple: 50,
        }),
      });

      const res = await handleMoqCalculate(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.eligible).toBe(true);
      expect(data.minUnits ?? data.min_units).toBe(500);
    });

    it("handles stateless quote calculation via POST /api/v1/private-label/quotes/calculate and redacts margin", async () => {
      const req = new Request("http://localhost/api/v1/private-label/quotes/calculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requested_units: 1000,
          net_weight_grams: 100,
          tea_option: { id: "tea_001", base_cost_per_kg_paise: 120000 },
          packaging_variant: { id: "pack_001", unit_cost_paise: 2400 },
          print_method: { id: "pm_direct_digital", code: "direct_digital" },
          color_count: 4,
          destination_zone: "metro",
        }),
      });

      const res = await handleQuoteCalculate(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.breakdown).toBeDefined();
      expect(data.breakdown.teaCostPaise).toBeGreaterThan(0);
      // Redacted from public response!
      expect(data.breakdown.marginPaise).toBeUndefined();
    });

    it("serves binary PDF via GET /api/v1/private-label/quotes/[id]/pdf", async () => {
      // 1. Create a firm quote first
      const proj = PrivateLabelService.createProjectDraft(
        {
          title: "PDF Test Project",
          items: [
            {
              tea_option_id: "tea_001",
              packaging_variant_id: "pack_001",
              print_method_id: "pm_direct_digital",
              fill_weight_grams: 100,
              quantity_units: 1000,
            },
          ],
        },
        "cust-m4-001",
        ACTOR_CUSTOMER_A
      );

      const quote = PrivateLabelService.createQuote(
        proj.id,
        {},
        ACTOR_CUSTOMER_A,
        "cust-m4-001"
      );

      const req = new Request(`http://localhost/api/v1/private-label/quotes/${quote.id}/pdf`, {
        method: "GET",
        headers: { "x-customer-id": "cust-m4-001" },
      });

      const res = await handleGetPdf(req, { params: Promise.resolve({ id: quote.id }) });
      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("application/pdf");

      const arrayBuf = await res.arrayBuffer();
      const pdfBuffer = Buffer.from(arrayBuf);
      expect(pdfBuffer.subarray(0, 8).toString("ascii")).toContain("%PDF-1.4");
    });
  });
});
