import React from "react";
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { StudioAuthModal } from "@/components/private-label/StudioAuthModal";
import { Step5QuantityQuote } from "@/components/private-label/studio/Step5QuantityQuote";
import { QuoteSummaryPanel } from "@/components/private-label/QuoteSummaryPanel";
import type { QuoteEstimateResult } from "@/components/private-label/hooks/useQuoteEstimate";

describe("Private Label Studio: Quotation Generation & Auth Modal Tests", () => {
  const dummyEstimate = {
    moq: {
      eligible: true,
      reasons: [],
      minUnits: 500,
      nextValidUnits: 500,
      teaUnitsRequired: 500,
      constraints: {
        teaBatchUnits: 500,
        packagingMOQ: 500,
        printMOQ: 500,
        fillingMOQ: 500,
        orderMultiple: 100,
      },
    },
    breakdown: {
      unitPricePaise: 4500,
      grandTotalPaise: 4500000,
      teaCostPaise: 2000000,
      packagingCostPaise: 1000000,
      printingCostPaise: 500000,
      toolingSetupPaise: 100000,
      closureFinishingCostPaise: 100000,
      nitrogenFlushingCostPaise: 0,
      laborCostPaise: 200000,
      qcCostPaise: 100000,
      cartonCostPaise: 200000,
      palletizingCostPaise: 100000,
      freightCostPaise: 200000,
      subtotalDirectPaise: 4000000,
      taxPaise: 500000,
    },
    isEligible: true,
    unitPriceInr: 45,
    grandTotalInr: 45000,
    formattedUnitPrice: "₹45.00",
    formattedGrandTotal: "₹45,000.00",
    isLoadingServerQuote: false,
    serverQuoteError: null,
  };

  it("renders StudioAuthModal with accessible dialog role and tabs when open", () => {
    const html = renderToStaticMarkup(
      React.createElement(StudioAuthModal, {
        isOpen: true,
        onClose: vi.fn(),
        onSuccess: vi.fn(),
        intendedAction: "quote",
        whatsappNumber: "+91 7001304853",
      })
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Sign in to generate quotation");
    expect(html).toContain("Create Free Account");
    expect(html).toContain("WhatsApp");
  });

  it("does not render StudioAuthModal when closed", () => {
    const html = renderToStaticMarkup(
      React.createElement(StudioAuthModal, {
        isOpen: false,
        onClose: vi.fn(),
        onSuccess: vi.fn(),
      })
    );

    expect(html).toBe("");
  });

  it("renders actionError and sign-in button in Step5QuantityQuote when needsLogin is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(Step5QuantityQuote, {
        quantityUnits: 1000,
        destinationZone: "metro",
        isNitrogenFlushEnabled: false,
        notes: "",
        estimate: dummyEstimate as unknown as QuoteEstimateResult,
        onChangeQuantity: vi.fn(),
        onChangeDestinationZone: vi.fn(),
        onToggleNitrogenFlush: vi.fn(),
        onChangeNotes: vi.fn(),
        onGenerateQuote: vi.fn(),
        onSaveDraft: vi.fn(),
        onPrev: vi.fn(),
        actionError: "Sign in or create a free account to generate your official quotation.",
        needsLogin: true,
        onOpenAuthModal: vi.fn(),
      })
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Sign in or create a free account to generate your official quotation.");
    expect(html).toContain("Sign in or create free account to generate quotation");
    expect(html).toContain("Generate Official Quotation");
  });

  it("renders actionError in QuoteSummaryPanel with prompt to sign in", () => {
    const html = renderToStaticMarkup(
      React.createElement(QuoteSummaryPanel, {
        estimate: dummyEstimate as unknown as QuoteEstimateResult,
        quantityUnits: 1000,
        onGenerateQuote: vi.fn(),
        actionError: "Sign in or create a free account to generate your official quotation.",
        needsLogin: true,
        onOpenAuthModal: vi.fn(),
      })
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain("Sign in or create a free account to generate your official quotation.");
    expect(html).toContain("Sign in or register to generate quote");
  });
});
