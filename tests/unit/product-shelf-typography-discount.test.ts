import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { SignatureBlendsCarousel } from "../../src/components/home/SignatureBlendsCarousel";
import { ShopProductCard } from "../../src/components/shop/ShopProductCard";
import { ProductCard } from "../../src/components/ProductCard";
import type { Product } from "../../src/lib/products";
import fs from "node:fs";
import path from "node:path";

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

function createTestProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 1,
    slug: "darjeeling-spring",
    name: "Darjeeling Spring Clonal First Flush",
    category: "Black",
    category_id: 1,
    origin: "Darjeeling, West Bengal",
    estate: "Risheehat Tea Estate",
    flush: "First Flush",
    harvest_date: "Spring 2024",
    description: "Delicate spring harvest with exquisite Muscatel floral sweetness.",
    tasting_notes: "Wildflower honey, Muscatel grape, green peach, spring pine",
    floral: 5,
    fruity: 4,
    malty: 2,
    body: 3,
    sweetness: 4,
    earthy: 1,
    aroma_tags: ["Muscatel", "Floral", "Honey"],
    dry_leaf_appearance: "Well-twisted silvery buds",
    dry_leaf_grade: "FTGFOP1",
    dry_leaf_aroma: "Fragrant wildflower",
    liquor_hue_hex: "#d4a373",
    liquor_hue_name: "Bright Amber Gold",
    liquor_clarity: "Brilliant crystal",
    liquor_body: "Medium brisk",
    wet_leaf_aroma: "Sweet green peach",
    wet_leaf_oxidation: "Light 30%",
    brew_temp: 85,
    brew_seconds: 180,
    elevation_feet: 5800,
    elevation_display: "4,500 – 6,800 ft (1,370 – 2,070 m)",
    lot_number: "EX-01",
    cultivar: "AV2 Clonal",
    estate_story: "Grown at high Himalayan slopes.",
    featured: 1,
    variants: [
      {
        id: 101,
        product_id: 1,
        sku: "DJ-SP-100",
        packaging_format: "loose_leaf_pouch",
        grams: 100,
        servings: 50,
        price_paise: 19900, // ₹199
        compare_at_price_paise: 24900, // ₹249 (20% OFF discount option)
        stock: 30,
      },
    ],
    ...overrides,
  } as Product;
}

describe("Product Shelf Typography & Discount Pricing (Storefront Listings)", () => {
  it("renders SignatureBlendsCarousel with catalogue notes and compare-at pricing without a promotional badge", () => {
    const product = createTestProduct();
    const markup = renderToStaticMarkup(
      React.createElement(SignatureBlendsCarousel, { products: [product] })
    );

    // Title & Tasting notes
    expect(markup).toContain("tf-card-title");
    expect(markup).toContain("Darjeeling Spring Clonal First Flush");
    expect(markup).toContain("tf-card-tasting-notes");
    expect(markup).toContain("Wildflower honey, Muscatel grape, green peach, spring pine");

    // Terroir line
    expect(markup).toContain("tf-rating-count");
    expect(markup).toContain("Risheehat Tea Estate");

    // Price and Discount Option
    expect(markup).toContain("tf-card-price");
    expect(markup).toContain("₹199");
    expect(markup).toContain("tf-card-original-price");
    expect(markup).toContain("₹249");
    expect(markup).not.toContain("tf-card-discount-badge");
    expect(markup).not.toContain("20% OFF");
  });

  it("renders ShopProductCard with 2-line title, description, and promotional discount", () => {
    const product = createTestProduct();
    const markup = renderToStaticMarkup(
      React.createElement(ShopProductCard, { product, index: 0 })
    );

    expect(markup).toContain("tf-mockup-card-title");
    expect(markup).toContain("Darjeeling Spring Clonal First Flush");
    expect(markup).toContain("tf-mockup-desc");
    expect(markup).toContain("tf-mockup-provenance-line");

    // Price and Discount Option
    expect(markup).toContain("tf-mockup-price");
    expect(markup).toContain("₹199");
    expect(markup).toContain("tf-mockup-original-price");
    expect(markup).toContain("₹249");
    expect(markup).toContain("tf-mockup-discount-badge");
    expect(markup).toContain("20% OFF");
  });

  it("renders ProductCard with 2-line title, notes, and promotional discount", () => {
    const product = createTestProduct();
    const markup = renderToStaticMarkup(
      React.createElement(ProductCard, { product })
    );

    expect(markup).toContain("product-title");
    expect(markup).toContain("Darjeeling Spring Clonal First Flush");
    expect(markup).toContain("tasting-notes");

    // Price and Discount Option
    expect(markup).toContain("₹199");
    expect(markup).toContain("product-original-price");
    expect(markup).toContain("₹249");
    expect(markup).toContain("product-discount-pill");
    expect(markup).toContain("20% OFF");
  });

  it("omits discount badge when product has no compare-at price", () => {
    const product = createTestProduct({
      variants: [
        {
          id: 102,
          product_id: 1,
          sku: "DJ-REG-100",
          packaging_format: "loose_leaf_pouch",
          grams: 100,
          servings: 50,
          price_paise: 19900,
          compare_at_price_paise: null,
          stock: 30,
        },
      ],
    });

    const markup = renderToStaticMarkup(
      React.createElement(SignatureBlendsCarousel, { products: [product] })
    );

    expect(markup).toContain("₹199");
    expect(markup).not.toContain("tf-card-original-price");
    expect(markup).not.toContain("tf-card-discount-badge");
  });

  it("verifies globals.css enforces 2-line clamping, min-heights, and text balance", () => {
    const cssPath = path.resolve(process.cwd(), "src/app/globals.css");
    const cssContent = fs.readFileSync(cssPath, "utf-8");

    // .tf-card-title (Signature carousel)
    expect(cssContent).toMatch(/\.tf-card-title\s*\{[^}]*-webkit-line-clamp:\s*2/);
    expect(cssContent).toMatch(/\.tf-card-title\s*\{[^}]*min-height:\s*calc\(1\.35em\s*\*\s*2\)/);
    expect(cssContent).toMatch(/\.tf-card-title\s*\{[^}]*text-wrap:\s*balance/);

    // .tf-card-tasting-notes (Signature carousel)
    expect(cssContent).toMatch(/\.tf-card-tasting-notes\s*\{[^}]*-webkit-line-clamp:\s*2/);
    expect(cssContent).toMatch(/\.tf-card-tasting-notes\s*\{[^}]*min-height:\s*calc\(1\.4em\s*\*\s*2\)/);

    // .tf-rating-count (Signature carousel terroir line)
    expect(cssContent).toMatch(/\.tf-rating-count\s*\{[^}]*-webkit-line-clamp:\s*2/);
    expect(cssContent).toMatch(/\.tf-rating-count\s*\{[^}]*min-height:\s*calc\(1\.35em\s*\*\s*2\)/);

    // .tf-mockup-card-title (Shop explorer)
    expect(cssContent).toMatch(/\.tf-mockup-card-title\s*\{[^}]*-webkit-line-clamp:\s*2/);
    expect(cssContent).toMatch(/\.tf-mockup-card-title\s*\{[^}]*min-height:\s*calc\(1\.3em\s*\*\s*2\)/);

    // .tf-mockup-desc (Shop explorer)
    expect(cssContent).toMatch(/\.tf-mockup-desc\s*\{[^}]*-webkit-line-clamp:\s*2/);
    expect(cssContent).toMatch(/\.tf-mockup-desc\s*\{[^}]*min-height:\s*calc\(1\.45em\s*\*\s*2\)/);

    // Discount badges and strike-through original prices
    expect(cssContent).toContain(".tf-card-original-price");
    expect(cssContent).toContain(".tf-card-discount-badge");
    expect(cssContent).toContain(".tf-mockup-original-price");
    expect(cssContent).toContain(".tf-mockup-discount-badge");
    expect(cssContent).toContain(".product-original-price");
    expect(cssContent).toContain(".product-discount-pill");
  });
});
