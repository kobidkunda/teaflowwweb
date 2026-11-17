import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { B2BPageContentRecord, B2BSettings } from "@/lib/business/repository";
import type { TrialPublicDto } from "@/lib/trials/types";
import { StarterLanding } from "@/components/business/starter/StarterLanding";

(globalThis as unknown as { React: typeof React }).React = React;
const { listPublic } = vi.hoisted(() => ({ listPublic: vi.fn() }));
vi.mock("@/lib/business/starterSamples", () => ({ getStarterSamples: listPublic }));
const content: B2BPageContentRecord = {
  id: "starter:en", segment: "starter", locale: "en", eyebrow: "Start here", headline: "Your tea business starts here.",
  intro: "Operator approved introduction", primary_cta: "Plan", secondary_cta: "Models", hero_image_url: "/images/hero-himalayan-tea.webp", hero_image_alt: "Original hero",
  process_intro: "Our process", steps: [{ title: "Operator step", body: "Step details" }], proof_title: "Approved proof", proof_body: "Approved details", proof_items: [],
  form_heading: "Plan with us", form_subhead: "Share your requirements", faq: [{ q: "Operator question?", a: "Operator answer" }], seo_title: "Business", seo_description: "Business planning", approved_at: "2026-11-17", updated_at: "2026-11-17",
};
const settings: B2BSettings = {
  id: "business", business_landing_enabled: true, leads_enabled: true, whatsapp_enabled: false, whatsapp_e164: null,
  support_hours: "Office hours", starter_hero_image_url: "", trader_hero_image_url: "", proof_image_1_url: "", proof_image_2_url: "", crm_webhook_enabled: false, updated_at: "2026-11-17",
};
const trial: TrialPublicDto = {
  id: "test-kit", slug: "test-kit", title: "Catalogue kit", tagline: null, description: null, status: "published", pack_format: "4x50g_sachets", net_weight_g: 200, price_paise: 34567, compare_at_price_paise: null, sku: "KIT", in_stock: false, hero_image: null,
  components: [{ slot_index: 1, name: "Catalogue tea", estate: "", grade: "", flush: "", elevation: null, weight_g: 50, tasting_notes: [], brewing: { temp_c: 95, time_sec: 180, dose_g: 2 }, bulk_link: null, assets: [] }], claims: [], meta: { title: null, description: null },
};
function render(overrides: Partial<Parameters<typeof StarterLanding>[0]> = {}) {
  return renderToStaticMarkup(StarterLanding({ content, settings, offers: [], locale: "en", quoteNotice: "Confirmed in writing", siliguriClaim: "Siliguri supply", ...overrides }));
}
describe("starter landing content boundaries", () => {
  beforeEach(() => listPublic.mockReturnValue({ trials: [], error: false }));
  it("keeps operator content and maps only the old starter headline/image", () => {
    const html = render();
    expect(html).toContain("Your tea business starts with a better first step.");
    expect(html).toContain("Operator approved introduction");
    expect(html).toContain("Operator question?");
    expect(html).toContain("starter-tea-table.webp");
    expect(html).toContain("Conceptual illustration");
    expect(html).toContain('href="#samples"');
    expect(html).toContain('href="/trials#top"');
  });
  it("does not overwrite a custom headline or uploaded hero", () => {
    const html = render({ content: { ...content, headline: "Custom campaign", hero_image_url: "/uploads/operator-hero.webp", hero_image_alt: "Operator image" } });
    expect(html).toContain("Custom campaign");
    expect(html).toContain("operator-hero.webp");
    expect(html).not.toContain("starter-tea-table.webp");
  });
  it("shows live sample prices, contents and unavailable states without making up imagery", () => {
    listPublic.mockReturnValue({ trials: [trial], error: false });
    const html = render();
    expect(html).toContain("₹345.67");
    expect(html).toContain("Catalogue tea");
    expect(html).toContain("Currently unavailable");
    expect(html).toContain('href="/trials/test-kit"');
    expect(html).not.toContain("Free delivery");
  });
  it("distinguishes empty catalogue from a safe loading error", () => {
    expect(render()).toContain("There are no published sample kits right now");
    listPublic.mockReturnValue({ trials: [], error: true });
    const html = render();
    expect(html).toContain("We couldn’t load sample kits");
    expect(html.includes("private raw database error")).toBe(false);
  });
  it("preserves paused quotation intake and Hindi supporting content", () => {
    expect(render({ settings: { ...settings, leads_enabled: false } })).toContain("Quotation intake paused");
    const html = render({ locale: "hi" });
    expect(html).toContain("अपना मार्जिन देखें");
    expect(html).toContain("सैंपल किट देखें");
    expect(html).toContain('lang="hi"');
  });
});
