import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SignatureBlendsCarousel } from "../../src/components/home/SignatureBlendsCarousel";
import type { Product } from "../../src/lib/products";

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

function createMockProduct(id: number, slug: string, name: string): Product {
  return {
    id,
    slug,
    name,
    category: "black",
    origin: "Darjeeling",
    estate: "Glenburn Estate",
    flush: "First Flush",
    harvest_date: "Spring 2024",
    description: "Crisp and delicate single-estate harvest.",
    tasting_notes: "Muscatel, citrus blossom, wildflower honey",
    floral: 4,
    fruity: 3,
    malty: 2,
    body: 3,
    sweetness: 4,
    earthy: 1,
    brew_temp: 85,
    brew_seconds: 180,
    featured: 1,
    elevation_display: "5,800 ft",
    variants: [
      {
        id: id * 10,
        product_id: id,
        sku: `${slug}-100g`,
        packaging_format: "luxury_tin",
        grams: 100,
        servings: 40,
        price_paise: 95000,
        stock: 25,
      },
    ],
  } as unknown as Product;
}

describe("SignatureBlendsCarousel — Auto-Swiped Carousel & View All Products CTA", () => {
  const mockProducts = [
    createMockProduct(1, "blend-one", "First Light Darjeeling"),
    createMockProduct(2, "blend-two", "Summer Gold Muscatel"),
    createMockProduct(3, "blend-three", "Silver Needle Reserve"),
    createMockProduct(4, "blend-four", "High Mountain Oolong"),
    createMockProduct(5, "blend-five", "Himalayan Spiced Chai"),
  ];

  it("renders all products in the swiper track without artificial overflow hiding", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SignatureBlendsCarousel, { products: mockProducts })
    );

    expect(markup).toContain('id="tf-signature-section"');
    expect(markup).toContain('id="signature-blends-track"');

    // All product cards are rendered in the carousel track
    for (const prod of mockProducts) {
      expect(markup).toContain(`data-testid="signature-card-${prod.slug}"`);
    }
  });

  it("renders accessible pause/play toggle and navigation chevrons for auto-swipe control", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SignatureBlendsCarousel, { products: mockProducts })
    );

    expect(markup).toContain("tf-carousel-pause-btn");
    expect(markup).toContain('aria-label="Pause auto-swipe"');
    expect(markup).toContain('aria-label="Previous tea blend"');
    expect(markup).toContain('aria-label="Next tea blend"');
  });

  it("renders prominent bottom 'View all products' action button linking to /shop", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SignatureBlendsCarousel, { products: mockProducts })
    );

    expect(markup).toContain("tf-signature-bottom-cta");
    expect(markup).toContain("tf-signature-view-all-btn");
    expect(markup).toContain('href="/shop"');
    expect(markup).toContain("View all products");
  });

  it("renders carousel pagination indicators for multi-product lists", () => {
    const markup = renderToStaticMarkup(
      React.createElement(SignatureBlendsCarousel, { products: mockProducts })
    );

    expect(markup).toContain("tf-carousel-dots-wrap");
    expect(markup).toContain('aria-label="Jump to slide 1: First Light Darjeeling"');
    expect(markup).toContain('aria-label="Jump to slide 5: Himalayan Spiced Chai"');
  });

  it("labels purchase controls and keeps unavailable variants disabled", () => {
    const product = createMockProduct(9, "assam-breakfast", "Assam Golden Breakfast");
    product.variants[0].stock = 0;
    const markup = renderToStaticMarkup(React.createElement(SignatureBlendsCarousel, { products: [product] }));
    expect(markup).toContain('aria-label="Add Assam Golden Breakfast to bag"');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain("Unavailable");
    expect(markup).not.toContain("POPULAR");
    expect(markup).not.toContain("BESTSELLER");
  });

  it("uses an honest missing-image state without substituting another tea", () => {
    const product = createMockProduct(10, "no-image", "Tea awaiting photography");
    const markup = renderToStaticMarkup(React.createElement(SignatureBlendsCarousel, { products: [product] }));
    expect(markup).toContain("Image unavailable");
    expect(markup).not.toContain("product-darjeeling-tin.jpg");
    expect(markup).not.toContain('<svg role="img"');
  });

  it("does not use scrollIntoView which causes unexpected vertical page jumping", async () => {
    const fs = await import("fs");
    const fileContent = fs.readFileSync(
      "src/components/home/SignatureBlendsCarousel.tsx",
      "utf8"
    );
    expect(fileContent).not.toContain(".scrollIntoView(");
    expect(fileContent).toContain(".scrollTo(");
  });
});
