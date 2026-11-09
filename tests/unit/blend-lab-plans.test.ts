import { describe, it, expect } from "vitest";
import {
  BLEND_LAB_PLANS,
  ORDERED_PLANS,
  getPlanByCode,
  listPlans,
  splitTaxInclusive,
  formatInr,
  canDownloadPdfReport,
  canRequestTrialBlend,
} from "@/lib/blend-lab/plans";

describe("Blend Lab Plans Catalog & Entitlements", () => {
  it("defines the three mandatory service plans with exact integer paise pricing", () => {
    expect(BLEND_LAB_PLANS.MATCH_QUOTE.totalPaise).toBe(29900);
    expect(BLEND_LAB_PLANS.QUALITY_AUDIT.totalPaise).toBe(199900);
    expect(BLEND_LAB_PLANS.SIGNATURE.totalPaise).toBe(299900);
    expect(ORDERED_PLANS).toHaveLength(3);
    expect(listPlans()).toHaveLength(3);
  });

  it("calculates 18% inclusive GST properly without decimal drift", () => {
    const quoteTax = splitTaxInclusive(29900, 1800);
    expect(quoteTax.basePaise).toBe(25339);
    expect(quoteTax.taxPaise).toBe(4561);
    expect(quoteTax.basePaise + quoteTax.taxPaise).toBe(29900);

    const auditTax = splitTaxInclusive(199900, 1800);
    expect(auditTax.basePaise + auditTax.taxPaise).toBe(199900);

    const signatureTax = splitTaxInclusive(299900, 1800);
    expect(signatureTax.basePaise + signatureTax.taxPaise).toBe(299900);
  });

  it("enforces plan entitlement rules strictly", () => {
    // Match & Quote (₹299): No PDF laboratory report, no trial shipments
    expect(canDownloadPdfReport("MATCH_QUOTE")).toBe(false);
    expect(canRequestTrialBlend("MATCH_QUOTE")).toBe(false);

    // Quality Audit (₹1,999): Detailed PDF report, but no physical candidate development
    expect(canDownloadPdfReport("QUALITY_AUDIT")).toBe(true);
    expect(canRequestTrialBlend("QUALITY_AUDIT")).toBe(false);

    // Signature Blend Lab (₹2,999): Full PDF report AND physical candidate dispatch
    expect(canDownloadPdfReport("SIGNATURE")).toBe(true);
    expect(canRequestTrialBlend("SIGNATURE")).toBe(true);
  });

  it("formats prices consistently in Indian Rupees", () => {
    expect(formatInr(29900)).toBe("₹299");
    expect(formatInr(199900)).toBe("₹1,999");
    expect(formatInr(299900)).toBe("₹2,999");
  });

  it("returns null for invalid plan codes", () => {
    expect(getPlanByCode("INVALID_TIER")).toBeNull();
  });
});
