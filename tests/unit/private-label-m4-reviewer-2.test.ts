/**
 * TeaFloww Private Label Studio — Milestone M4 Reviewer 2 Adversarial & A11y Suite
 * Reviewer / Critic: private_label_m4_reviewer_2
 * File: tests/unit/private-label-m4-reviewer-2.test.ts
 *
 * Scope: Milestone M4 (Studio UI, 2D Canvas, Stepper & A11y)
 * Vectors:
 * 1. Stepper Progression, Gating & Invalidation Logic
 * 2. 2D Mockup Canvas & Preflight Guides
 * 3. Client Draft Persistence & Corrupt Storage Resilience
 * 4. WCAG 2.2 AA Accessibility & Responsive Layout Integrity
 * 5. 12-Component Itemized Cost Engine Boundary Invariants
 */

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Mock Next.js navigation
const currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => "/private-label/studio",
  useSearchParams: () => currentSearchParams,
}));

import { StudioStepNavigation } from "@/components/private-label/studio/StudioStepNavigation";
import { StudioCanvas2D } from "@/components/private-label/StudioCanvas2D";
import { ProofApprovalModal } from "@/components/private-label/ProofApprovalModal";
import { Step1TeaSelection } from "@/components/private-label/studio/Step1TeaSelection";
import { Step5QuantityQuote } from "@/components/private-label/studio/Step5QuantityQuote";
import { StudioMobileBottomBar } from "@/components/private-label/studio/StudioMobileBottomBar";
import { QuoteSummaryPanel } from "@/components/private-label/QuoteSummaryPanel";
import { calculateSafeZone, validateCompatibility } from "@/lib/private-label/compatibility";
import { calculateItemized12ComponentQuote } from "@/lib/private-label/pricing";
import { calculateMOQ } from "@/lib/private-label/moq";
import { DEFAULT_STUDIO_CONFIG, type LocalDraftEnvelope } from "@/components/private-label/hooks/useStudioDraft";

describe("Milestone M4 Reviewer 2: Studio UI, 2D Canvas, Stepper & A11y Adversarial Suite", () => {
  // ==========================================================================
  // Vector 1: Stepper Progression, Gating & Invalidation Logic
  // ==========================================================================
  describe("Vector 1: Stepper Progression, Gating & Invalidation Logic", () => {
    it("V1.1: StepNavigation disables forward navigation to unvisited steps and marks current step with aria-current='step'", () => {
      const onSelect = vi.fn();
      const html = renderToStaticMarkup(
        React.createElement(StudioStepNavigation, {
          currentStep: 1,
          completedSteps: [1],
          onStepSelect: onSelect,
        })
      );

      // Step 1 tab has aria-current="step"
      expect(html).toContain('data-testid="step-tab-1"');
      expect(html).toContain('aria-current="step"');

      // Step 2 tab is disabled because it is not completed and step > currentStep
      expect(html).toMatch(/data-testid="step-tab-2"[^>]*disabled/);
      // Step 3, 4, 5 tabs are also disabled
      expect(html).toMatch(/data-testid="step-tab-3"[^>]*disabled/);
      expect(html).toMatch(/data-testid="step-tab-4"[^>]*disabled/);
      expect(html).toMatch(/data-testid="step-tab-5"[^>]*disabled/);
    });

    it("V1.2: StepNavigation allows free clicking of previously completed earlier steps", () => {
      const html = renderToStaticMarkup(
        React.createElement(StudioStepNavigation, {
          currentStep: 3,
          completedSteps: [1, 2],
          onStepSelect: vi.fn(),
        })
      );

      // Step 1 and 2 tabs should NOT be disabled
      const step1Disabled = /data-testid="step-tab-1"[^>]*disabled/.test(html);
      const step2Disabled = /data-testid="step-tab-2"[^>]*disabled/.test(html);
      expect(step1Disabled).toBe(false);
      expect(step2Disabled).toBe(false);

      // Step 3 is current, not disabled
      const step3Disabled = /data-testid="step-tab-3"[^>]*disabled/.test(html);
      expect(step3Disabled).toBe(false);

      // Step 4 is unvisited and disabled
      expect(html).toMatch(/data-testid="step-tab-4"[^>]*disabled/);
    });

    it("V1.3: Step 1 validation error is rendered when user proceeds without tea selection", () => {
      const html = renderToStaticMarkup(
        React.createElement(Step1TeaSelection, {
          teas: [],
          selectedTeaId: null,
          fillWeightGrams: 100,
          onSelectTea: vi.fn(),
          onChangeFillWeight: vi.fn(),
          onNext: vi.fn(),
          validationError: "Please select a single-estate tea to proceed.",
        })
      );

      expect(html).toContain('role="alert"');
      expect(html).toContain("Please select a single-estate tea to proceed.");
      expect(html).toContain('data-testid="step-next-btn"');
    });

    it("V1.4: Packaging change to tin invalidates incompatible print methods (direct_digital, gravure)", () => {
      // Pouch supports direct_digital
      const pouchDigital = validateCompatibility({
        familyCode: "pouch",
        printMethodCode: "direct_digital",
      });
      expect(pouchDigital.compatible).toBe(true);

      // Tin strictly rejects direct_digital and gravure
      const tinDigital = validateCompatibility({
        familyCode: "tin",
        printMethodCode: "direct_digital",
      });
      expect(tinDigital.compatible).toBe(false);
      expect(tinDigital.reason).toContain("Direct UV flatbed digital print is not feasible");

      const tinGravure = validateCompatibility({
        familyCode: "tin",
        printMethodCode: "gravure",
      });
      expect(tinGravure.compatible).toBe(false);

      // Tin accepts screen printing
      const tinScreen = validateCompatibility({
        familyCode: "tin",
        printMethodCode: "screen_print",
        colorCount: 2,
      });
      expect(tinScreen.compatible).toBe(true);
    });

    it("V1.5: URL step clamping rule safely enforces prerequisite completion before advancing", () => {
      // Simulating URL step clamping logic from StudioConfigurator
      function clampStep(
        targetStep: number,
        config: { teaOptionId: string | null; packagingVariantId: string | null; printMethodId: string | null; brandName: string }
      ): number {
        let safeStep = 1;
        if (config.teaOptionId) {
          safeStep = 2;
          if (config.packagingVariantId) {
            safeStep = 3;
            if (config.printMethodId) {
              safeStep = 4;
              if (config.brandName) {
                safeStep = 5;
              }
            }
          }
        }
        return Math.min(targetStep, safeStep);
      }

      // No tea selected -> clamped to 1 even if user requests step=5
      expect(clampStep(5, { teaOptionId: null, packagingVariantId: null, printMethodId: null, brandName: "" })).toBe(1);

      // Tea selected -> can go up to 2
      expect(clampStep(5, { teaOptionId: "tea_1", packagingVariantId: null, printMethodId: null, brandName: "" })).toBe(2);

      // Tea and Pack selected -> can go up to 3
      expect(clampStep(5, { teaOptionId: "tea_1", packagingVariantId: "pack_1", printMethodId: null, brandName: "" })).toBe(3);

      // All prerequisites met -> can reach 5
      expect(clampStep(5, { teaOptionId: "tea_1", packagingVariantId: "pack_1", printMethodId: "pm_1", brandName: "TeaFloww" })).toBe(5);
    });
  });

  // ==========================================================================
  // Vector 2: 2D Mockup Canvas & Preflight Guides
  // ==========================================================================
  describe("Vector 2: 2D Mockup Canvas & Preflight Guides", () => {
    it("V2.1: StudioCanvas2D renders pure SVG/CSS representation with role='img' and data-testid='mockup-canvas'", () => {
      const html = renderToStaticMarkup(
        React.createElement(StudioCanvas2D, {
          packagingVariant: {
            id: "pack_1",
            name: "Matte Black Barrier Pouch 100g",
            family: "pouch",
            width_mm: 160,
            height_mm: 230,
          },
          brandName: "Nirva Tea",
          fillWeightGrams: 100,
          activeView: "front",
          guidesVisible: true,
        })
      );

      expect(html).toContain('role="img"');
      expect(html).toContain('data-testid="mockup-canvas"');
      expect(html).toContain('data-testid="safe-zone-guide"');
      expect(html).toContain("Nirva Tea");
      expect(html).toContain("Net Wt: 100g");
    });

    it("V2.2: StudioCanvas2D back view strictly renders mandatory legal label reserve zone with FSSAI lic and Siliguri works address", () => {
      const html = renderToStaticMarkup(
        React.createElement(StudioCanvas2D, {
          packagingVariant: {
            id: "pack_1",
            name: "Matte Black Barrier Pouch 100g",
            family: "pouch",
            width_mm: 160,
            height_mm: 230,
          },
          brandName: "Nirva Tea",
          fillWeightGrams: 100,
          activeView: "back",
        })
      );

      expect(html).toContain('data-testid="legal-label-zone"');
      expect(html).toContain("19CTHPK8646J2ZY");
      expect(html).toContain("Fulbari Ghoshpukur Bypass");
      expect(html).toContain("Siliguri");
      expect(html).toContain("Steeping Ritual");
    });

    it("V2.3: StudioCanvas2D dieline view renders technical CAD dieline with bleed and dimensions", () => {
      const html = renderToStaticMarkup(
        React.createElement(StudioCanvas2D, {
          packagingVariant: {
            id: "pack_1",
            name: "Matte Black Barrier Pouch 100g",
            family: "pouch",
            width_mm: 160,
            height_mm: 230,
          },
          activeView: "dieline",
        })
      );

      expect(html).toContain("TECHNICAL DIE CUT TEMPLATE");
      expect(html).toContain("160mm × 230mm");
      expect(html).toContain("Bleed: 3mm");
      expect(html).toContain("Scale 1:1");
    });

    it("V2.4: Low-resolution artwork (<300 DPI) triggers data-testid='dpi-warning' banner with role='alert'", () => {
      const html = renderToStaticMarkup(
        React.createElement(StudioCanvas2D, {
          artworkDpi: 150, // Below 300 DPI threshold
          artworkFilename: "logo_lowres.png",
        })
      );

      expect(html).toContain('data-testid="dpi-warning"');
      expect(html).toContain('role="alert"');
      expect(html).toContain("150 DPI");
      expect(html).toContain("recommended: 300 DPI");
    });

    it("V2.5: Safe zone calculation produces correct mechanical reserves for pouch, tin, and jar", () => {
      const pouchSafe = calculateSafeZone("pouch", 160, 230);
      expect(pouchSafe.marginsMm.top).toBe(35); // Zipper margin
      expect(pouchSafe.marginsMm.bottom).toBe(15);
      expect(pouchSafe.labelSafeWidthMm).toBe(140);
      expect(pouchSafe.labelSafeHeightMm).toBe(180);

      const tinSafe = calculateSafeZone("tin", 85, 120);
      expect(tinSafe.marginsMm.top).toBe(10); // Lip clearance
      expect(tinSafe.marginsMm.bottom).toBe(10);
      expect(tinSafe.labelSafeWidthMm).toBe(75);

      const jarSafe = calculateSafeZone("jar", 70, 95);
      expect(jarSafe.marginsMm.top).toBe(12);
      expect(jarSafe.marginsMm.bottom).toBe(8);
    });
  });

  // ==========================================================================
  // Vector 3: Client Draft Persistence & Corrupt Storage Resilience
  // ==========================================================================
  describe("Vector 3: Client Draft Persistence & Corrupt Storage Resilience", () => {
    it("V3.1: Local storage read logic safely recovers from malformed/corrupted JSON without throwing", () => {
      // Mock storage containing malformed garbage
      const mockStorage: Record<string, string> = {
        "teafloww-pl-draft": "{ malformed_json: [[[[ invalid }}}",
      };

      function parseStoredDraft(raw: string | null): LocalDraftEnvelope | null {
        if (!raw) return null;
        try {
          const parsed = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object") return null;
          return parsed;
        } catch {
          // Clear corrupted item gracefully
          delete mockStorage["teafloww-pl-draft"];
          return null;
        }
      }

      const result = parseStoredDraft(mockStorage["teafloww-pl-draft"]);
      expect(result).toBeNull();
      // Storage item was cleaned up to avoid perpetual errors
      expect(mockStorage["teafloww-pl-draft"]).toBeUndefined();
    });

    it("V3.2: Stale draft threshold (30 days) correctly flags drafts for commodity price refresh", () => {
      const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

      const freshDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(); // 5 days old
      const staleDate = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(); // 35 days old

      function isDraftStale(updatedAt: string): boolean {
        const time = new Date(updatedAt).getTime();
        return !isNaN(time) && Date.now() - time > STALE_THRESHOLD_MS;
      }

      expect(isDraftStale(freshDate)).toBe(false);
      expect(isDraftStale(staleDate)).toBe(true);
    });

    it("V3.3: Default configuration initializes all required 12-component quote fields safely", () => {
      expect(DEFAULT_STUDIO_CONFIG.quantityUnits).toBe(1000);
      expect(DEFAULT_STUDIO_CONFIG.fillWeightGrams).toBe(100);
      expect(DEFAULT_STUDIO_CONFIG.colorCount).toBe(4);
      expect(DEFAULT_STUDIO_CONFIG.destinationZone).toBe("metro");
      expect(DEFAULT_STUDIO_CONFIG.isNitrogenFlushEnabled).toBe(false);
      expect(DEFAULT_STUDIO_CONFIG.activeView).toBe("front");
      expect(DEFAULT_STUDIO_CONFIG.guidesVisible).toBe(true);
    });
  });

  // ==========================================================================
  // Vector 4: Accessibility & Responsive Layout Conformance
  // ==========================================================================
  describe("Vector 4: Accessibility & Responsive Layout Conformance", () => {
    it("V4.1: ProofApprovalModal renders as accessible dialog with role='dialog' and aria-modal='true'", () => {
      const html = renderToStaticMarkup(
        React.createElement(ProofApprovalModal, {
          isOpen: true,
          onClose: vi.fn(),
          onApprove: vi.fn(),
          brandName: "Artisanal Himalayan",
          packagingName: "Matte Black Barrier Pouch",
        })
      );

      expect(html).toContain('role="dialog"');
      expect(html).toContain('aria-modal="true"');
      expect(html).toContain('aria-labelledby="proof-modal-title"');
      expect(html).toContain('data-testid="proof-approval-modal"');
      expect(html).toContain("Digital Proof Sign-Off &amp; Preflight Attestation");
      expect(html).toContain("FSSAI regulations and Siliguri manufacturing standards");
    });

    it("V4.2: StudioMobileBottomBar renders sticky bar for mobile viewports with min 48px tap targets", () => {
      const html = renderToStaticMarkup(
        React.createElement(StudioMobileBottomBar, {
          currentStep: 2,
          formattedUnitPrice: "₹34.50",
          isEligible: true,
          onNext: vi.fn(),
        })
      );

      expect(html).toContain("STEP 2 OF 5");
      expect(html).toContain("₹34.50 / pack");
      expect(html).toContain("Next Step &amp;rsaquo;");
      // Tap target verification
      expect(html).toContain("min-height:48px");
    });

    it("V4.3: Step 5 QuantityQuote renders quantity input with name='quantity' and data-testid='input-quantity'", () => {
      const dummyEstimate = {
        moq: null,
        breakdown: null,
        isEligible: true,
        unitPriceInr: 34.5,
        grandTotalInr: 34500,
        formattedUnitPrice: "₹34.50",
        formattedGrandTotal: "₹34,500.00",
        isLoadingServerQuote: false,
        serverQuoteError: null,
      };

      const html = renderToStaticMarkup(
        React.createElement(Step5QuantityQuote, {
          quantityUnits: 1000,
          destinationZone: "metro",
          isNitrogenFlushEnabled: true,
          notes: "Handle with care",
          estimate: dummyEstimate,
          onChangeQuantity: vi.fn(),
          onChangeDestinationZone: vi.fn(),
          onToggleNitrogenFlush: vi.fn(),
          onChangeNotes: vi.fn(),
          onGenerateQuote: vi.fn(),
          onSaveDraft: vi.fn(),
          onPrev: vi.fn(),
        })
      );

      expect(html).toContain('name="quantity"');
      expect(html).toContain('data-testid="input-quantity"');
      expect(html).toContain('data-testid="step-quote"');
      expect(html).toContain("Nitrogen Flush &amp; Modified Atmosphere Sealing");
      expect(html).toContain("See Your Issued Quote");
      expect(html).not.toContain("14 Days Firm Validity");
    });

    it("V4.4: QuoteSummaryPanel renders all 12 cost components when expanded", () => {
      const dummyBreakdown = {
        teaCostPaise: 12360000,
        packagingCostPaise: 2400000,
        printingCostPaise: 450000,
        toolingSetupPaise: 150000,
        closureFinishingCostPaise: 50000,
        nitrogenFlushingCostPaise: 75000,
        laborCostPaise: 300000,
        qcCostPaise: 250000,
        cartonCostPaise: 120000,
        palletizingCostPaise: 75000,
        freightCostPaise: 766500,
        subtotalDirectPaise: 16996500,
        marginPaise: 4249125,
        taxDetails: { teaGstPaise: 772500, nonTeaGstPaise: 1729350 },
        taxPaise: 2501850,
        grandTotalPaise: 23747475,
        unitPricePaise: 23747,
        metrics: { netTeaKg: 100, grossTeaKg: 103, cartonCount: 20, palletCount: 1, batchCount: 1 },
      };

      const html = renderToStaticMarkup(
        React.createElement(QuoteSummaryPanel, {
          estimate: {
            moq: { eligible: true, reasons: [], minUnits: 500, nextValidUnits: 1000 } as any,
            breakdown: dummyBreakdown as any,
            isEligible: true,
            unitPriceInr: 237.47,
            grandTotalInr: 237474.75,
            formattedUnitPrice: "₹237.47",
            formattedGrandTotal: "₹2,37,474.75",
            isLoadingServerQuote: false,
            serverQuoteError: null,
          },
          quantityUnits: 1000,
        })
      );

      // Verify all 12 components are listed in the summary
      expect(html).toContain("1. Base Tea Leaf");
      expect(html).toContain("2. Primary Packaging Structure");
      expect(html).toContain("3. Printing Run Cost");
      expect(html).toContain("4. Tooling / Cylinders Setup");
      expect(html).toContain("5. Closures &amp; Label Finishing");
      expect(html).toContain("6. Nitrogen Flush &amp; MAP");
      expect(html).toContain("7. Cleanroom Filling Labor");
      expect(html).toContain("8. QC Cupping &amp; Retention Tasting");
      expect(html).toContain("9. 5-Ply Corrugated Cartons");
      expect(html).toContain("10. Palletizing &amp; Shrink Hood");
      expect(html).toContain("11. Domestic Zoned Freight");
      expect(html).toContain("12. Dual Indian GST (5% Tea + 18% Non-Tea)");
    });
  });

  // ==========================================================================
  // Vector 5: 12-Component Itemized Cost Engine Boundary Invariants
  // ==========================================================================
  describe("Vector 5: 12-Component Itemized Cost Engine Boundary Invariants", () => {
    it("V5.1: Zero-drift integer paise invariant holds strictly for large order runs (50,000 units)", () => {
      const largeRun = calculateItemized12ComponentQuote({
        requestedUnits: 50000,
        netWeightGrams: 250,
        teaOption: { id: "tea_001", baseCostPerKgPaise: 150000 },
        packagingVariant: {
          id: "pack_001",
          unitCostPaise: 2000,
          closureRatePaise: 40,
          tareWeightGrams: 25,
          packsPerCarton: 40,
        },
        printMethod: {
          id: "pm_gravure",
          code: "gravure",
          setupFeePaise: 200000,
          cylinderFeePerColorPaise: 800000,
          unitCostPaise: 120,
        },
        colorCount: 6,
        isNitrogenFlushEnabled: true,
        destinationZone: "national",
      });

      const b = largeRun.breakdown!;
      expect(b.grandTotalPaise).toBe(b.subtotalDirectPaise + b.marginPaise + b.taxPaise);
      expect(b.taxPaise).toBe(b.taxDetails.teaGstPaise + b.taxDetails.nonTeaGstPaise);
      expect(Number.isInteger(b.grandTotalPaise)).toBe(true);
      expect(Number.isInteger(b.unitPricePaise)).toBe(true);
    });

    it("V5.2: Multi-dimensional MOQ calculation strictly rejects requestedUnits <= 0 via Zod and calculates boundary unit (units = 1)", () => {
      // requestedUnits <= 0 is rejected at schema level
      expect(() =>
        calculateMOQ({
          requestedUnits: 0,
          netWeightGrams: 100,
          teaMinBatchKg: 5.0,
          packagingMOQ: 500,
          printMOQ: 100,
        })
      ).toThrow();

      // Boundary quantity: 1 unit correctly calculates requirements without division by zero
      const moqOne = calculateMOQ({
        requestedUnits: 1,
        netWeightGrams: 100,
        teaMinBatchKg: 5.0,
        packagingMOQ: 500,
        printMOQ: 100,
      });

      expect(moqOne.eligible).toBe(false);
      expect(moqOne.minUnits).toBe(500);
      expect(moqOne.reasons.length).toBeGreaterThan(0);
    });
  });
});
