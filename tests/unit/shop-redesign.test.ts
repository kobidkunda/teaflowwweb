import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { listProducts } from "@/lib/products";
import { listStorefrontCategories } from "@/lib/storefront";
import { ShopProductCard } from "@/components/shop/ShopProductCard";
import { ShopDossierView } from "@/components/shop/ShopDossierView";
import { ShopQuickViewModal } from "@/components/shop/ShopQuickViewModal";
import { ShopEmptyState } from "@/components/shop/ShopEmptyState";
import { HomeHero } from "@/components/home/HomeHero";

(globalThis as unknown as { React: typeof React }).React = React;

vi.mock("@/components/CartProvider", () => ({
  useCart: () => ({
    items: [],
    add: vi.fn(),
    changeQuantity: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    count: 0,
    subtotal: 0,
  }),
  CartProvider: ({ children }: { children: React.ReactNode }) => children,
}));

describe("Shop Redesign — Contemporary Himalayan Connoisseurship", () => {
  const allProducts = listProducts();
  const categories = listStorefrontCategories();

  it("loads the full catalogue of single-estate Himalayan teas", () => {
    expect(allProducts.length).toBeGreaterThanOrEqual(11);
    const darjeeling = allProducts.find((p) => p.slug === "darjeeling-spring");
    expect(darjeeling).toBeDefined();
    expect(darjeeling?.name).toContain("Darjeeling Spring Clonal");
    expect(darjeeling?.origin).toContain("Darjeeling");
    expect(darjeeling?.brew_temp).toBe(85);
    expect(darjeeling?.floral).toBeGreaterThanOrEqual(4);
  });

  it("supports category filtering by slug and by display name", () => {
    const blackTeas = allProducts.filter((p) => p.category.toLowerCase() === "black");
    expect(blackTeas.length).toBeGreaterThanOrEqual(4);

    const greenTeas = allProducts.filter((p) => p.category.toLowerCase() === "green");
    expect(greenTeas.length).toBeGreaterThanOrEqual(2);

    const oolongTeas = allProducts.filter((p) => p.category.toLowerCase() === "oolong");
    expect(oolongTeas.length).toBeGreaterThanOrEqual(1);
    expect(oolongTeas[0].slug).toBe("giddapahar-oolong");
  });

  it("filters by terroir regions accurately", () => {
    const darjeelingLots = allProducts.filter(
      (p) =>
        p.origin.toLowerCase().includes("darjeeling") ||
        p.estate.toLowerCase().includes("darjeeling")
    );
    expect(darjeelingLots.length).toBeGreaterThanOrEqual(3);

    const assamLots = allProducts.filter((p) => p.origin.toLowerCase().includes("assam"));
    expect(assamLots.length).toBeGreaterThanOrEqual(2);

    const kangraLots = allProducts.filter((p) => p.origin.toLowerCase().includes("kangra"));
    expect(kangraLots.length).toBeGreaterThanOrEqual(1);

    const nilgiriLots = allProducts.filter((p) => p.origin.toLowerCase().includes("nilgiri"));
    expect(nilgiriLots.length).toBeGreaterThanOrEqual(1);
  });

  it("filters by sensory flavor profile thresholds (score >= 3)", () => {
    const floralTeas = allProducts.filter((p) => (p.floral ?? 0) >= 3);
    expect(floralTeas.length).toBeGreaterThan(0);
    expect(floralTeas.some((p) => p.slug === "darjeeling-spring")).toBe(true);

    const maltyTeas = allProducts.filter((p) => (p.malty ?? 0) >= 3);
    expect(maltyTeas.length).toBeGreaterThan(0);
    expect(maltyTeas.some((p) => p.slug === "assam-golden-breakfast")).toBe(true);
  });

  it("filters by elevation tiers correctly", () => {
    const alpineTeas = allProducts.filter((p) => (p.elevation_feet ?? 0) >= 4500);
    expect(alpineTeas.length).toBeGreaterThan(0);
    expect(alpineTeas.every((p) => p.elevation_feet >= 4500)).toBe(true);

    const valleyTeas = allProducts.filter((p) => (p.elevation_feet ?? 0) < 1000);
    expect(valleyTeas.length).toBeGreaterThan(0);
    expect(valleyTeas.some((p) => p.slug.includes("assam"))).toBe(true);
  });

  it("filters by Curator's Reserve lots", () => {
    const reserveLots = allProducts.filter((p) => p.featured === 1);
    expect(reserveLots.length).toBeGreaterThan(0);
    expect(reserveLots.every((p) => p.featured === 1)).toBe(true);
  });

  it("sorts by price asc and desc correctly", () => {
    const asc = [...allProducts].sort(
      (a, b) => (a.variants[0]?.price_paise ?? 0) - (b.variants[0]?.price_paise ?? 0)
    );
    expect(asc[0].variants[0].price_paise).toBeLessThanOrEqual(
      asc[asc.length - 1].variants[0].price_paise
    );

    const desc = [...allProducts].sort(
      (a, b) => (b.variants[0]?.price_paise ?? 0) - (a.variants[0]?.price_paise ?? 0)
    );
    expect(desc[0].variants[0].price_paise).toBeGreaterThanOrEqual(
      desc[desc.length - 1].variants[0].price_paise
    );
  });

  it("renders ShopProductCard with Modern Web Guidance image priorities & container queries", () => {
    const product = allProducts[0];
    const htmlLcp = renderToStaticMarkup(
      React.createElement(ShopProductCard, { product, index: 0 })
    );
    // Index 0 must have fetchpriority high and container-type wrapper
    expect(htmlLcp).toContain('class="shop-card-wrapper"');
    expect(htmlLcp).toContain('data-testid="shop-card-' + product.slug + '"');
    expect(htmlLcp).toContain(product.name);
    expect(htmlLcp.toLowerCase()).toContain('fetchpriority="high"');

    const htmlLazy = renderToStaticMarkup(
      React.createElement(ShopProductCard, { product, index: 3 })
    );
    expect(htmlLazy).toContain('loading="lazy"');
  });

  it("renders ShopDossierView comparative tasting table with accessible meters", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShopDossierView, { products: allProducts.slice(0, 3) })
    );
    expect(html).toContain('role="region"');
    expect(html).toContain("Single-Estate Harvest");
    expect(html).toContain("Cupping Intensity");
    expect(html).toContain('role="meter"');
    expect(html).toContain(allProducts[0].name);
  });

  it("renders ShopQuickViewModal with accessible dialog attributes and cupping radar", () => {
    const product = allProducts.find((p) => p.slug === "darjeeling-spring")!;
    const html = renderToStaticMarkup(
      React.createElement(ShopQuickViewModal, { product, onClose: () => {} })
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain('aria-labelledby="quick-view-title"');
    expect(html).toContain("Sensory Cupping Radar");
    expect(html).toContain("Floral");
    expect(html).toContain(product.name);
    expect(html).toContain("Full Passport");
  });

  it("renders ShopEmptyState with accessible polite alert and suggestion triggers", () => {
    const html = renderToStaticMarkup(
      React.createElement(ShopEmptyState, { onReset: () => {}, onSelectSuggestion: () => {} })
    );
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("No exact harvest match.");
    expect(html).toContain("Reset all filters");
    expect(html).toContain("Darjeeling First Flush");
  });

  it("renders HomeHero with default collection title and LCP priority image", () => {
    const html = renderToStaticMarkup(React.createElement(HomeHero, {}));
    expect(html).toContain("Single-Estate Flushes &amp; Mountain Terroirs.");
    expect(html).toContain("THE TEAFLOWW COLLECTION");
    expect(html).toContain("Authentic Single Estates");
    expect(html).toContain("High-Altitude Gardens");
    expect(html).toContain("From<br/>Our Gardens<br/>to Your Cup");
    expect(html.toLowerCase()).toContain('fetchpriority="high"');
  });

  it("renders HomeHero dynamically adapted for category=black", () => {
    const html = renderToStaticMarkup(React.createElement(HomeHero, { category: "black" }));
    expect(html).toContain("Single-Estate Black Flushes &amp; Mountain Terroirs.");
    expect(html).toContain("THE TEAFLOWW COLLECTION · BLACK TEAS");
    expect(html).toContain("Bold, malty orthodox flushes from Upper Assam");
  });

  it("renders HomeHero dynamically adapted for category=green", () => {
    const html = renderToStaticMarkup(React.createElement(HomeHero, { category: "green" }));
    expect(html).toContain("Single-Estate Green Flushes &amp; High Terroirs.");
    expect(html).toContain("THE TEAFLOWW COLLECTION · GREEN TEAS");
  });
});
