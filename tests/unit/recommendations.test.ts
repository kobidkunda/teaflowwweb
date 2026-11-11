import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getProductBySlug } from "@/lib/products";
import { getRecommendationsForProduct, RecommendationItem } from "@/lib/recommendations";
import { PDPRecommendations } from "@/components/PDPRecommendations";
import ProductPage from "@/app/tea/[slug]/page";

// Mock InternationalProvider and CartProvider for static rendering tests
vi.mock("@/components/international/InternationalProvider", () => ({
  useDisplayMoney: () => (paise: number) => `₹${Math.round(paise / 100)}`,
  LocalizedLink: ({ href, children, ...rest }: any) =>
    React.createElement("a", { href, ...rest }, children),
  Text: ({ fallback }: any) => React.createElement(React.Fragment, null, fallback),
}));

vi.mock("@/components/CartProvider", () => ({
  useCart: () => ({
    add: vi.fn(),
    items: [],
  }),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
  }),
}));

describe("getRecommendationsForProduct Domain Service", () => {
  it("returns similar milk chais and discovery sample pack for everyday-strong-milk-chai", () => {
    const product = getProductBySlug("everyday-strong-milk-chai");
    expect(product).not.toBeNull();
    if (!product) return;

    const recommendations = getRecommendationsForProduct(product);
    expect(recommendations.length).toBeGreaterThan(0);

    // Verify samples are included
    const sampleItems = recommendations.filter((r) => r.type === "sample");
    expect(sampleItems.length).toBeGreaterThan(0);
    const primarySample = sampleItems[0];
    expect(primarySample.badge).toContain("SAMPLE");
    expect(primarySample.href).toMatch(/\/(trials|tea)\//);
    expect(primarySample.cartPayload).toBeDefined();

    // Verify sample components list
    if (primarySample.sampleComponents) {
      expect(primarySample.sampleComponents.length).toBeGreaterThan(0);
    }

    // Verify similar items are included
    const productItems = recommendations.filter((r) => r.type === "product");
    expect(productItems.length).toBeGreaterThan(0);
    const similarSlugs = productItems.map((p) => p.slug);

    // Should include other Everyday Milk Chai items
    expect(
      similarSlugs.some((s) =>
        ["elaichi-milk-chai", "ginger-milk-chai", "balanced-masala-milk-chai"].includes(s)
      )
    ).toBe(true);

    // Current product should NOT be in its own recommendations
    expect(similarSlugs).not.toContain("everyday-strong-milk-chai");

    // Real cartPayload variantId or trialId
    for (const item of recommendations) {
      if (item.type === "product") {
        expect(item.cartPayload?.variantId).toBeGreaterThan(0);
        expect(item.cartPayload?.pricePaise).toBeGreaterThan(0);
      } else {
        expect(item.cartPayload?.trialId || item.cartPayload?.variantId).toBeTruthy();
        expect(item.cartPayload?.pricePaise).toBeGreaterThan(0);
      }
    }
  });

  it("handles orthodox teas like darjeeling-spring gracefully", () => {
    const product = getProductBySlug("darjeeling-spring");
    expect(product).not.toBeNull();
    if (!product) return;

    const recommendations = getRecommendationsForProduct(product);
    expect(recommendations.length).toBeGreaterThan(0);

    // Should not recommend itself
    const slugs = recommendations.map((r) => r.slug);
    expect(slugs).not.toContain("darjeeling-spring");
  });
});

describe("PDPRecommendations Storefront Component", () => {
  const mockItems: RecommendationItem[] = [
    {
      id: "trial-4-x-25-gm",
      type: "sample",
      slug: "4-x-25-gm",
      name: "Teafloww Four-Tea Discovery Trial Pack | 4 × 25 g",
      category: "Tasting Sample Kit",
      badge: "SAMPLE PACK",
      tagline: "Find your favourite chai",
      tastingNotes: "Compare Rozana Kadak with cardamom, masala, and ginger chai.",
      sampleComponents: [
        { name: "Rozana Kadak — Daily Stall Tea", weightG: 25 },
        { name: "Elaichi Tea — Cardamom Chai", weightG: 25 },
        { name: "Masala Tea — Spiced Chai Blend", weightG: 25 },
        { name: "Ginger Tea — Adrak Chai", weightG: 25 },
      ],
      weightDisplay: "4 × 25g (100g total)",
      pricePaise: 20000,
      imageUrl: "/images/trials/discovery-shelf-kit.webp",
      href: "/trials/4-x-25-gm",
      inStock: true,
      cartPayload: {
        variantId: 0,
        trialId: "trial-uuid-1",
        slug: "4-x-25-gm",
        name: "Teafloww Four-Tea Discovery Trial Pack",
        grams: 100,
        pricePaise: 20000,
      },
    },
    {
      id: "prod-48",
      type: "product",
      slug: "elaichi-milk-chai",
      name: "Elaichi Milk Chai",
      category: "Everyday Milk Chai",
      badge: "SIMILAR RECIPE",
      origin: "Assam Valley & Idukki, Kerala, India",
      flush: "Second Flush",
      tastingNotes: "Sweet piney green cardamom, refreshing floral camphor, rich baked malt.",
      weightDisplay: "100g pouch",
      pricePaise: 19900,
      imageUrl: null,
      href: "/tea/elaichi-milk-chai",
      inStock: true,
      cartPayload: {
        variantId: 1690,
        sku: "TFW-006-100G",
        slug: "elaichi-milk-chai",
        name: "Elaichi Milk Chai",
        grams: 100,
        pricePaise: 19900,
      },
    },
    {
      id: "prod-49",
      type: "product",
      slug: "ginger-milk-chai",
      name: "Ginger Milk Chai",
      category: "Everyday Milk Chai",
      badge: "SIMILAR RECIPE",
      origin: "Dooars & Kalimpong Foothills, India",
      flush: "Monsoon Flush",
      tastingNotes: "Fiery zesty ginger root, bold malty backbone.",
      weightDisplay: "100g pouch",
      pricePaise: 19900,
      imageUrl: null,
      href: "/tea/ginger-milk-chai",
      inStock: true,
      cartPayload: {
        variantId: 1694,
        sku: "TFW-007-100G",
        slug: "ginger-milk-chai",
        name: "Ginger Milk Chai",
        grams: 100,
        pricePaise: 19900,
      },
    },
  ];

  it("renders recommendations section with both similar teas and sample packs", () => {
    const html = renderToStaticMarkup(
      React.createElement(PDPRecommendations, {
        items: mockItems,
        currentCategory: "Everyday Milk Chai",
        currentTeaName: "Everyday Strong Milk Chai",
      })
    );

    // Section title & narrative
    expect(html).toContain("Similar Milk Chais &amp; Discovery Samples");
    expect(html).toContain("Includes Tasting Samples");

    // Check presence of both types
    expect(html).toContain("SAMPLE PACK");
    expect(html).toContain("Teafloww Four-Tea Discovery Trial Pack");
    expect(html).toContain("Rozana Kadak");
    expect(html).toContain("Elaichi Tea");

    expect(html).toContain("SIMILAR RECIPE");
    expect(html).toContain("Elaichi Milk Chai");
    expect(html).toContain("Ginger Milk Chai");
    expect(html).toContain("₹199");
    expect(html).toContain("₹200");

    // Filter tabs
    expect(html).toContain("All Suggestions");
    expect(html).toContain("Similar Teas");
    expect(html).toContain("Tasting Samples");

    // Respects truthfulness (no fake review stars)
    expect(html).not.toContain("★");
    expect(html).not.toContain("reviews)");
  });

  it("returns null when items array is empty", () => {
    const html = renderToStaticMarkup(
      React.createElement(PDPRecommendations, { items: [] })
    );
    expect(html).toBe("");
  });
});

describe("PDP Integration for /tea/everyday-strong-milk-chai", () => {
  it("renders the product page including similar items and samples", async () => {
    const pageElement = await ProductPage({
      params: Promise.resolve({ slug: "everyday-strong-milk-chai" }),
    });
    expect(pageElement).toBeDefined();

    const html = renderToStaticMarkup(pageElement);
    expect(html).toContain("Everyday Strong Milk Chai");
    expect(html).toContain("pdp-recommendations");

    // Must show similar items
    expect(html).toContain("Elaichi Milk Chai");

    // Must show sample suggestion
    expect(html).toContain("SAMPLE PACK");
    expect(html).toContain("/trials/");
  });
});
