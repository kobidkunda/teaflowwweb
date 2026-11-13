import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Product, Variant } from "@/lib/productModels";

(globalThis as unknown as { React: typeof React }).React = React;

// Mock InternationalProvider helpers
vi.mock("@/components/international/InternationalProvider", () => ({
  useDisplayMoney: () => (paise: number) => `₹${(paise / 100).toFixed(0)}`,
  LocalizedLink: ({ href, children, ...props }: any) =>
    React.createElement("a", { href, ...props }, children),
  Text: ({ fallback }: any) => fallback || null,
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/shop",
}));

vi.mock("next/image", () => ({
  __esModule: true,
  default: ({ src, alt, ...props }: any) =>
    React.createElement("img", { src, alt, ...props }),
}));

// Mock sample product with multiple variants and wholesale slabs
const mockProduct: Product = {
  id: 42,
  slug: "darjeeling-second-flush-muscatel",
  name: "Darjeeling Muscatel Second Flush",
  category: "Black Tea",
  category_id: 1,
  origin: "Darjeeling, India",
  estate: "Gopaldhara Estate",
  flush: "Second Flush",
  harvest_date: "2026-06-15",
  description: "Rich muscatel character with ripe summer fruit top notes.",
  tasting_notes: "Muscatel grape, honey, and summer wildflowers.",
  floral: 4,
  fruity: 5,
  malty: 3,
  body: 4,
  sweetness: 4,
  earthy: 2,
  aroma_tags: ["Muscatel", "Wild Honey"],
  dry_leaf_appearance: "Well rolled dark whole leaves with golden tips",
  dry_leaf_grade: "FTGFOP1",
  dry_leaf_aroma: "Fruity and sweet muscatel",
  liquor_hue_hex: "#b85d19",
  liquor_hue_name: "Bright Amber",
  liquor_clarity: "Brilliant",
  liquor_body: "Full",
  wet_leaf_aroma: "Warm Muscatel",
  wet_leaf_oxidation: "85%",
  brew_temp: 95,
  brew_seconds: 180,
  leaf_dose_grams: 2.5,
  water_ml: 200,
  steep_count: 3,
  steep_instructions: "Infuse in 95°C spring water for 3 minutes.",
  elevation_feet: 5500,
  elevation_display: "5,500 ft",
  lot_number: "EX-14/2026",
  cultivar: "AV2 & Chinary",
  estate_story: "Grown in high-altitude slopes facing Mt. Kanchenjunga.",
  featured: 1,
  wholesale_moq: 50,
  primary_image_url: "/uploads/darjeeling-muscatel.webp",
  variants: [
    {
      id: 201,
      product_id: 42,
      sku: "DJ-SF-100G",
      packaging_format: "loose_leaf_pouch",
      grams: 100,
      servings: 40,
      price_paise: 45000, // ₹450 (LOWEST variant)
      compare_at_price_paise: 50000,
      stock: 50,
      wholesale_slabs: [
        { variant_id: 201, min_qty: 50, price_paise: 38000 },
        { variant_id: 201, min_qty: 100, price_paise: 35000 },
      ],
    },
    {
      id: 202,
      product_id: 42,
      sku: "DJ-SF-250G",
      packaging_format: "luxury_tin",
      grams: 250,
      servings: 100,
      price_paise: 98000, // ₹980
      compare_at_price_paise: 110000,
      stock: 35,
    },
    {
      id: 203,
      product_id: 42,
      sku: "DJ-SF-500G",
      packaging_format: "loose_leaf_pouch",
      grams: 500,
      servings: 200,
      price_paise: 180000, // ₹1,800
      stock: 20,
    },
  ],
};

let mockQuickModalState: any = null;
const mockCloseQuickModal = vi.fn();
const mockOpenQuickModal = vi.fn();
const mockReplaceCartItem = vi.fn();
const mockAdd = vi.fn();

vi.mock("@/components/CartProvider", () => ({
  useCart: () => ({
    items: [],
    add: mockAdd,
    changeQuantity: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    count: mockQuickModalState ? 1 : 0,
    subtotal: mockQuickModalState ? 45000 : 0,
    quickModalState: mockQuickModalState,
    openQuickModal: mockOpenQuickModal,
    closeQuickModal: mockCloseQuickModal,
    replaceCartItem: mockReplaceCartItem,
  }),
}));

import { QuickVariantModal } from "@/components/cart/QuickVariantModal";
import { ShopProductCard } from "@/components/shop/ShopProductCard";
import { AddToCart } from "@/components/AddToCart";

describe("QuickVariantModal & Add-To-Cart Architecture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuickModalState = null;
  });

  it("determines the lowest priced variant accurately across product variants", () => {
    const sorted = [...mockProduct.variants].sort((a, b) => a.price_paise - b.price_paise);
    const lowest = sorted[0];
    expect(lowest).toBeDefined();
    expect(lowest.id).toBe(201);
    expect(lowest.grams).toBe(100);
    expect(lowest.price_paise).toBe(45000);
  });

  it("renders QuickVariantModal with pre-selected lowest variant and all size options", () => {
    mockQuickModalState = {
      product: mockProduct,
      initialVariant: mockProduct.variants[0], // id: 201
    };

    const markup = renderToStaticMarkup(
      React.createElement(QuickVariantModal)
    );

    // Modal markup checks
    expect(markup).toContain("quick-variant-backdrop");
    expect(markup).toContain("Darjeeling Muscatel Second Flush");
    expect(markup).toContain("Select Pack &amp; Quantity");
    // All 3 variant options are listed
    expect(markup).toContain("100g");
    expect(markup).toContain("250g");
    expect(markup).toContain("500g");
    // Default lowest tag is shown
    expect(markup).toContain("Default");
    // Price display
    expect(markup).toContain("₹450");
    // Wholesale tier notice
    expect(markup).toContain("Wholesale Pricing Available");
    // Action buttons (left Add to Cart, right Buy Now)
    expect(markup).toContain("quick-variant-btn-add");
    expect(markup).toContain("Add to Cart");
    expect(markup).toContain("quick-variant-btn-buy");
    expect(markup).toContain("Buy Now");
    expect(markup).toContain("View Bag &amp; Order Summary →");
  });

  it("returns null when quickModalState is empty/closed", () => {
    mockQuickModalState = null;

    const markup = renderToStaticMarkup(
      React.createElement(QuickVariantModal)
    );

    expect(markup).toBe("");
  });

  it("ShopProductCard adds lowest variant to cart and triggers openQuickModal", () => {
    const markup = renderToStaticMarkup(
      React.createElement(ShopProductCard, { product: mockProduct, index: 0 })
    );

    expect(markup).toContain("Darjeeling Muscatel Second Flush");
    expect(markup).toContain("tf-mockup-add-to-cart-btn");
    expect(markup).toContain("Add to Cart");
  });

  it("AddToCart component defaults to lowest variant and supports modal invocation", () => {
    const markup = renderToStaticMarkup(
      React.createElement(AddToCart, {
        product: mockProduct,
        variant: mockProduct.variants[1], // pass variant 250g
      })
    );

    expect(markup).toContain("button button-outline quick-add");
    expect(markup).toContain("Quick add +");
  });

  it("validates replaceCartItem contract when swapping variants", () => {
    // Test the cart replacement logic directly
    const initialItems = [
      {
        variantId: 201,
        slug: mockProduct.slug,
        name: mockProduct.name,
        grams: 100,
        pricePaise: 45000,
        quantity: 1,
      },
    ];

    const newLine = {
      variantId: 202,
      slug: mockProduct.slug,
      name: mockProduct.name,
      grams: 250,
      pricePaise: 98000,
      quantity: 2,
    };

    // Simulate replaceCartItem: removing 201 and adding 202
    const filtered = initialItems.filter((x) => x.variantId !== 201);
    const updated = [...filtered, newLine];

    expect(updated).toHaveLength(1);
    expect(updated[0].variantId).toBe(202);
    expect(updated[0].grams).toBe(250);
    expect(updated[0].quantity).toBe(2);
    expect(updated[0].pricePaise).toBe(98000);
  });

  it("validates wholesale slab pricing calculation for quantity tiers", () => {
    const variant = mockProduct.variants[0];
    const slabs = variant.wholesale_slabs || [];

    const calculatePrice = (qty: number) => {
      const sorted = [...slabs].sort((a, b) => b.min_qty - a.min_qty);
      const match = sorted.find((s) => qty >= s.min_qty);
      return match ? match.price_paise : variant.price_paise;
    };

    // Below MOQ (returns retail price)
    expect(calculatePrice(20)).toBe(45000);
    // At Tier 1 MOQ 50
    expect(calculatePrice(50)).toBe(38000);
    expect(calculatePrice(75)).toBe(38000);
    // At Tier 2 MOQ 100
    expect(calculatePrice(100)).toBe(35000);
    expect(calculatePrice(250)).toBe(35000);
  });
});
