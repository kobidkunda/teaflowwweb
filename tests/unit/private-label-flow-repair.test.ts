import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { FeaturedPackagingGrid } from "@/components/private-label/landing/FeaturedPackagingGrid";
import { StudioTeaserPreview } from "@/components/private-label/landing/StudioTeaserPreview";
import { describe, it, expect } from "vitest";
import { PackagingDielineAction } from "@/components/private-label/detail/PackagingDielineAction";
import { Step3PrintMethod } from "@/components/private-label/studio/Step3PrintMethod";
import { DEFAULT_STUDIO_CONFIG, restoreStudioConfig } from "@/components/private-label/hooks/useStudioDraft";
import { earliestIncompleteStep, validateStudioStep, studioProjectPayload } from "@/components/private-label/studio/flow";
import { createProjectDraftRequestSchema } from "@/lib/private-label/schemas";

const ready = { ...DEFAULT_STUDIO_CONFIG, teaOptionId: "tea_qa", packagingVariantId: "pack_qa", packagingFamily: "pouch" as const, printMethodId: "print_qa", printMethodCode: "bopp_label" as const, brandName: "QA Brand" };

describe("private-label flow repairs", () => {
  it("clamps incomplete drafts to the first missing prerequisite", () => {
    expect(earliestIncompleteStep(DEFAULT_STUDIO_CONFIG)).toBe(1);
    expect(earliestIncompleteStep({ ...ready, packagingVariantId: null })).toBe(2);
    expect(earliestIncompleteStep({ ...ready, printMethodId: null })).toBe(3);
    expect(earliestIncompleteStep({ ...ready, brandName: "   " })).toBe(4);
    expect(earliestIncompleteStep(ready)).toBe(5);
  });
  it("requires artwork rights and rejects invalid quantities and weights", () => {
    expect(validateStudioStep({ ...ready, artworkUrl: "data:image/png;base64,AAAA" }, 4)).toContain("rights");
    expect(validateStudioStep({ ...ready, quantityUnits: 1.2 }, 5)).toBeTruthy();
    expect(validateStudioStep({ ...ready, fillWeightGrams: NaN }, 1)).toBeTruthy();
  });
  it("blocks incompatible prints after a packaging change", () => {
    expect(validateStudioStep({ ...ready, packagingFamily: "tin", printMethodCode: "direct_digital" }, 3)).toBeTruthy();
  });
  it("builds server-valid items from current selections, preserving color count", () => {
    const payload = studioProjectPayload({ ...ready, quantityUnits: 2500, colorCount: 6 });
    const parsed = createProjectDraftRequestSchema.parse(payload);
    expect(parsed.items?.[0].quantity_units).toBe(2500);
    expect(parsed.items?.[0].colorCount).toBe(6);
    expect(parsed.items?.[0].tea_option_id).toBe("tea_qa");
  });
});


describe("honest private-label discovery", () => {
  it("shows concepts rather than invented purchasable products for an empty catalogue", () => {
    const html = renderToStaticMarkup(React.createElement(FeaturedPackagingGrid, { variants: [] }));
    expect(html).toContain("AI-generated illustration");
    for (const family of ["pouch", "tin", "jar", "carton"]) expect(html).toContain(`${family}-concept.webp`);
    expect(html).not.toContain("/private-label/packaging/stand-up-pouch");
    expect(html).not.toContain("₹18.50");
    expect(html).toContain("/private-label#sample-kit");
  });
  it("routes the preview to the real studio without fabricated SKU links or prices", () => {
    const html = renderToStaticMarkup(React.createElement(StudioTeaserPreview));
    expect(html).toContain('href="/private-label/studio"');
    expect(html).not.toContain("stand-up-pouch-matte-black-250g");
    expect(html).not.toContain("72.50");
    expect(html).toContain("server-calculated estimate");
  });
});


describe("full form verification regressions", () => {
  it("recovers corrupt draft values without losing valid choices or crashing the studio", () => {
    const config = restoreStudioConfig({ ...ready, brandName: 42, artworkUrl: "javascript:alert(1)", rightsAttested: true, quantityUnits: Infinity, packagingFamily: "invalid" });
    expect(config.brandName).toBe("");
    expect(config.teaOptionId).toBe("tea_qa");
    expect(config.artworkUrl).toBeNull();
    expect(config.rightsAttested).toBe(false);
    expect(config.quantityUnits).toBe(1000);
    expect(config.packagingFamily).toBeNull();
    expect(() => earliestIncompleteStep(config)).not.toThrow();
  });
  it("rejects fractional, excessive and unsupported color inputs", () => {
    expect(validateStudioStep({ ...ready, colorCount: 8, printMethodCode: "paper_label" }, 3)).toContain("4 colors");
    expect(validateStudioStep({ ...ready, colorCount: 1.5 }, 3)).toContain("colors");
    expect(validateStudioStep({ ...ready, quantityUnits: 10000001 }, 5)).toBeTruthy();
  });
  it("shows a lower-color print method before selection so users can choose it", () => {
    const html = renderToStaticMarkup(React.createElement(Step3PrintMethod, {
      printMethods: [{ id: "screen", code: "screen_print", name: "Screen Printing", description: "Test method", color_model: "spot", max_colors: 3, setup_fee_paise: 100, cylinder_fee_per_color_paise: 0, min_order_units: 100, lead_time_days: 10 }],
      packagingFamily: "tin", selectedPrintMethodId: null, colorCount: 8, finishEmbellishment: "matte",
      onSelectPrintMethod: () => {}, onChangeColorCount: () => {}, onChangeFinish: () => {}, onNext: () => {}, onPrev: () => {},
    }));
    expect(html).toContain("Screen Printing");
  });
  it("routes missing dielines into an enquiry without reporting a fictitious queued request", () => {
    const missing = renderToStaticMarkup(React.createElement(PackagingDielineAction, { variantTitle: "QA Pouch" }));
    expect(missing).toContain("dieline=QA%20Pouch");
    expect(missing).not.toContain("Queued");
    expect(missing).not.toContain("/api/v1/private-label/packaging/");
    const present = renderToStaticMarkup(React.createElement(PackagingDielineAction, { variantTitle: "QA Pouch", dielineUrl: "/uploads/approved.pdf" }));
    expect(present).toContain('href="/uploads/approved.pdf"');
  });
});
