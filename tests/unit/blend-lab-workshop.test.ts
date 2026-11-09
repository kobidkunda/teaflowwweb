import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TierComparisonTable } from "@/components/blend-lab/TierComparisonTable";
import { SyntheticReportPreview } from "@/components/blend-lab/SyntheticReportPreview";
import { BlendLabHero } from "@/components/blend-lab/BlendLabHero";
import { BLEND_LAB_PLANS } from "@/lib/blend-lab/plans-catalog";
import type { BlendLabContentData } from "@/lib/blend-lab/content";

const render = (component: React.ReactElement) => renderToStaticMarkup(component);

describe("Blend Lab workshop purchase information", () => {
  it("renders supplied plan pricing, tax, deliverables and the corresponding intake URL", () => {
    const plan = { ...BLEND_LAB_PLANS.MATCH_QUOTE, title: "Operator service", totalPaise: 50000, taxRateBps: 500, features: ["Operator deliverable"], exclusions: ["Trial samples excluded"] };
    const html = render(React.createElement(TierComparisonTable, { plans: [plan] }));
    expect(html).toContain("Operator service");
    expect(html).toContain("₹500");
    expect(html).not.toContain("₹299");
    expect(html).toContain("Operator deliverable");
    expect(html).toContain("Trial samples excluded");
    expect(html).toContain('/blend-lab/start?plan=MATCH_QUOTE');
    expect(html).toContain("Includes 5% GST");
    expect(html).not.toContain("Tea Quality Audit");
  });

  it("offers contact help without purchase links when no plans are supplied", () => {
    const html = render(React.createElement(TierComparisonTable, { plans: [] }));
    expect(html).toContain("Services are currently unavailable");
    expect(html).toContain('href="/contact"');
    expect(html).not.toContain("/blend-lab/start");
  });

  it("preserves operator-authored hero copy", () => {
    const content: BlendLabContentData = { texts: { homeEyebrow: "", homeTitle: "", homeDescription: "", heroEyebrow: "CUSTOM EYEBROW", heroTitle: "Custom tasting service", heroDescription: "Operator description" }, heroPlacement: null, homePlacement: null, faqs: [] };
    const html = render(React.createElement(BlendLabHero, { content }));
    expect(html).toContain("Custom tasting service");
    expect(html).toContain("Operator description");
    expect(html).toContain("CUSTOM EYEBROW");
    expect(html).toContain("AI-generated illustration");
    expect(html).not.toContain("9.1 / 10");
  });

  it("makes the report example available as a native disclosure and identifies its scope", () => {
    const html = render(React.createElement(SyntheticReportPreview));
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("Inside your evaluation");
    expect(html).toContain("Illustrative report");
    expect(html).toContain("Detailed reports are included with Tea Quality Audit and Signature Blend Lab");
    expect(html).not.toContain("8.5");
    expect(html).not.toContain("certified");
  });
});
