import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { VariantPicker } from "../../src/components/VariantPicker";
import { StickyPurchaseBar } from "../../src/components/StickyPurchaseBar";
import { PDPInteractiveTabs } from "../../src/components/PDPInteractiveTabs";
import type { Product, Variant } from "../../src/lib/products";

// Sample mock product fixture matching seeded Teabox connoisseur dataset
const mockVariants: Variant[] = [
  {
    id: 101,
    product_id: 1,
    sku: "DJ-SP-POUCH-100G",
    packaging_format: "loose_leaf_pouch",
    grams: 100,
    servings: 50,
    price_paise: 129900,
    stock: 25,
  },
  {
    id: 102,
    product_id: 1,
    sku: "DJ-SP-POUCH-300G",
    packaging_format: "loose_leaf_pouch",
    grams: 300,
    servings: 150,
    price_paise: 349900,
    stock: 12,
  },
  {
    id: 103,
    product_id: 1,
    sku: "DJ-SP-POUCH-500G",
    packaging_format: "loose_leaf_pouch",
    grams: 500,
    servings: 250,
    price_paise: 549900,
    stock: 4, // Low stock (<= 5)
  },
  {
    id: 104,
    product_id: 1,
    sku: "DJ-SP-POUCH-1KG",
    packaging_format: "loose_leaf_pouch",
    grams: 1000,
    servings: 500,
    price_paise: 999900,
    stock: 10,
  },
  {
    id: 201,
    product_id: 1,
    sku: "DJ-SP-TIN-100G",
    packaging_format: "luxury_tin",
    grams: 100,
    servings: 50,
    price_paise: 149900,
    stock: 20,
  },
  {
    id: 202,
    product_id: 1,
    sku: "DJ-SP-TIN-300G",
    packaging_format: "luxury_tin",
    grams: 300,
    servings: 150,
    price_paise: 379900,
    stock: 8,
  },
  {
    id: 203,
    product_id: 1,
    sku: "DJ-SP-TIN-500G",
    packaging_format: "luxury_tin",
    grams: 500,
    servings: 250,
    price_paise: 589900,
    stock: 2, // Low stock (<= 5)
  },
  {
    id: 204,
    product_id: 1,
    sku: "DJ-SP-TIN-1KG",
    packaging_format: "luxury_tin",
    grams: 1000,
    servings: 500,
    price_paise: 1069900,
    stock: 0, // Sold out
  },
  {
    id: 301,
    product_id: 1,
    sku: "DJ-SP-BAGS-25",
    packaging_format: "pyramid_bags",
    grams: 50,
    servings: 25,
    price_paise: 79900,
    stock: 30,
  },
  {
    id: 302,
    product_id: 1,
    sku: "DJ-SP-BAGS-50",
    packaging_format: "pyramid_bags",
    grams: 100,
    servings: 50,
    price_paise: 144900,
    stock: 15,
  },
];

const mockProduct: Product = {
  tea_moments: { headline: "Make it your moment.", introduction: "A quiet cup.", occasion: "Afternoon", serving_suggestion: "", food_pairing: "", image_url: "", image_alt: "" },
  id: 1,
  slug: "darjeeling-spring-first-flush",
  name: "Darjeeling Spring Clonal First Flush",
  category: "Black",
  category_id: 1,
  origin: "Darjeeling, West Bengal, India",
  estate: "Risheehat Tea Estate",
  flush: "First Flush",
  harvest_date: "March–April 2026",
  description: "Tender terminal shoots harvested in the misty upper ridges of Kurseong East valley.",
  tasting_notes: "Wildflower honey, Muscatel grape, green peach, spring pine",
  floral: 5,
  fruity: 4,
  malty: 1,
  body: 2,
  sweetness: 4,
  earthy: 1,
  aroma_tags: ["Muscatel", "Wild Honey", "Spring Peach", "Alpine Orchid", "Dewy Pine"],
  dry_leaf_appearance: "Well-twisted wiry olive-green whole leaves with a generous bloom of downy silver tips",
  dry_leaf_grade: "FTGFOP1",
  dry_leaf_aroma: "Crisp alpine air, crushed orchid blossoms, and freshly mown mountain meadow",
  liquor_hue_hex: "#e29d42",
  liquor_hue_name: "Sunlit Amber Gold",
  liquor_clarity: "Brilliant crystalline translucence with radiant golden halo",
  liquor_body: "Light to medium-bodied with champagne-like effervescence",
  wet_leaf_aroma: "Sweet poached stone fruit, dewy marigolds, and pine blossom",
  wet_leaf_oxidation: "Light ~15–20% oxidation; vivid jade-olive leaf matrix",
  brew_temp: 85,
  brew_seconds: 180,
  leaf_dose_grams: 2.5,
  water_ml: 200,
  steep_count: 3,
  steep_instructions: "Heat fresh filtered spring water to 85°C. Steep 2.5g in 200ml for 3 minutes.",
  elevation_feet: 5800,
  elevation_display: "4,500 – 6,800 ft (1,370 – 2,070 m)",
  lot_number: "DJ/EX-02/2026",
  cultivar: "Camellia sinensis var. sinensis (AV2 Clonal Selection)",
  estate_story: "Perched upon mist-cloaked Himalayan ridges, celebrating century-old orthodox tea bushes.",
  featured: 1,
  variants: mockVariants,
};

// Ensure React is on globalThis for any untyped JSX runtimes
(globalThis as unknown as { React: typeof React }).React = React;

const mockCartAdd = vi.fn();

vi.mock("../../src/components/CartProvider", () => ({
  useCart: () => ({
    items: [],
    add: mockCartAdd,
    changeQuantity: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn(),
    count: 0,
    subtotal: 0,
  }),
  CartProvider: ({ children }: { children: React.ReactNode }) => children,
}));

function renderWithCart(component: React.ReactElement) {
  return renderToStaticMarkup(component);
}

describe("Suite 1: VariantPicker Packaging Format & Pack Size Selection", () => {
  it("renders format selector with all available packaging options", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, { product: mockProduct })
    );

    expect(html).toContain("Packaging Format");
    expect(html).toContain("Loose Leaf Pouch");
    expect(html).toContain("Luxury Tin");
    expect(html).toContain("Pyramid Tea Bags");
    expect(html).toContain('data-format="loose_leaf_pouch"');
    expect(html).toContain('data-format="luxury_tin"');
    expect(html).toContain('data-format="pyramid_bags"');
  });

  it("marks active format pill with aria-pressed='true' and selected CSS class", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "luxury_tin",
      })
    );

    // luxury_tin button must be pressed and selected
    expect(html).toMatch(
      /<button[^>]*data-format="luxury_tin"[^>]*class="[^"]*selected active[^"]*"[^>]*aria-pressed="true"/
    );
    // loose_leaf_pouch must be false
    expect(html).toMatch(
      /<button[^>]*data-format="loose_leaf_pouch"[^>]*aria-pressed="false"/
    );
  });

  it("renders pack sizes for the active packaging format", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "loose_leaf_pouch",
      })
    );

    expect(html).toContain("100g");
    expect(html).toContain("300g");
    expect(html).toContain("500g");
    expect(html).toContain("1kg");
    expect(html).toContain('data-grams="100"');
    expect(html).toContain('data-grams="300"');
    expect(html).toContain('data-grams="500"');
    expect(html).toContain('data-grams="1000"');
  });

  it("renders tea bag count indicators for pyramid bags format", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "pyramid_bags",
      })
    );

    expect(html).toContain("25 Bags (50g)");
    expect(html).toContain("50 Bags (100g)");
    expect(html).toContain("~25 cups");
    expect(html).toContain("~50 cups");
  });

  it("renders active size option with aria-pressed='true' and active CSS class", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "loose_leaf_pouch",
        initialGrams: 300,
      })
    );

    expect(html).toMatch(
      /<button[^>]*data-grams="300"[^>]*class="[^"]*selected active[^"]*"[^>]*aria-pressed="true"/
    );
  });
});

describe("Suite 2: Synchronous Dynamic Pricing & Per-Cup Indicator", () => {
  it("renders primary price in INR currency format with rupee symbol", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "loose_leaf_pouch",
        initialGrams: 100,
      })
    );

    // 100g pouch is ₹1,299 (129,900 paise)
    expect(html).toContain('class="price-main"');
    expect(html).toMatch(/₹\s*1,299/);
  });

  it("calculates exact per-cup unit cost and displays serving estimation", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "loose_leaf_pouch",
        initialGrams: 100,
      })
    );

    // 129900 paise / 50 servings = 2598 paise = ₹26 per cup
    expect(html).toContain('class="price-note"');
    expect(html).toMatch(/100g\s*·\s*Approximately\s*50\s*cups\s*·\s*₹\s*26\s*per\s*cup/);
  });

  it("1kg bulk pack calculates approximately 500 cups without an unsupported savings claim", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "loose_leaf_pouch",
        initialGrams: 1000,
      })
    );

    // 999900 paise / 500 servings = 2000 paise = ₹20 per cup
    expect(html).toMatch(/1kg\s*·\s*Approximately\s*500\s*cups\s*·\s*₹\s*20\s*per\s*cup/);
    expect(html).not.toContain("Volume Savings");
  });

  it("omits hardcoded shipping and sourcing promises", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, { product: mockProduct })
    );

    expect(html).not.toContain("Direct garden harvest guarantee");
    expect(html).not.toContain("Dispatched within 24h");
    expect(html).not.toContain("Biodegradable mesh bags");
  });

  it("applies font-variant-numeric: tabular-nums for zero layout shift", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, { product: mockProduct })
    );

    expect(html).toContain("tabular-nums");
  });
});

describe("Suite 3: Stock-Aware States & Cart Integration in VariantPicker", () => {
  it("displays positive In Stock badge for stock > 5", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "loose_leaf_pouch",
        initialGrams: 100, // stock: 25
      })
    );

    expect(html).toContain("in-stock");
    expect(html).toContain("In Stock");
    expect(html).not.toContain("Dispatched within 24h");
  });

  it("displays availability without urgency when inventory <= 5", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "loose_leaf_pouch",
        initialGrams: 500, // stock: 4
      })
    );

    expect(html).toContain("in-stock");
    expect(html).not.toContain("Only 4 left");
  });

  it("displays Sold Out badge and disables buttons when stock is 0", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "luxury_tin",
        initialGrams: 1000, // stock: 0
      })
    );

    expect(html).toContain("out-of-stock");
    expect(html).toContain("Sold Out");

    // Primary CTA button must be disabled
    expect(html).toMatch(
      /<button[^>]*class="[^"]*add-main[^"]*"[^>]*disabled=""[^>]*aria-disabled="true"/
    );
  });

  it("enables Add to Bag CTA button for in-stock variants with price preview", () => {
    const html = renderWithCart(
      React.createElement(VariantPicker, {
        product: mockProduct,
        initialFormat: "loose_leaf_pouch",
        initialGrams: 100,
      })
    );

    expect(html).toMatch(/Add to Bag — ₹\s*1,299/);
    expect(html).not.toMatch(/<button[^>]*class="[^"]*add-main[^"]*"[^>]*\sdisabled[=>\s]/);
  });
});

describe("Suite 4: StickyPurchaseBar Responsive Layout & Synchronization", () => {
  it("renders product title, active variant price, format name, and size", () => {
    const html = renderWithCart(
      React.createElement(StickyPurchaseBar, {
        product: mockProduct,
        activeVariant: mockVariants[0],
        forceVisible: true,
      })
    );

    expect(html).toContain("Darjeeling Spring Clonal First Flush");
    expect(html).toContain("Loose Leaf · 100g");
    expect(html).toMatch(/₹\s*1,299/);
    expect(html).toContain("/ cup");
    expect(html).toContain("Add to Bag");
  });

  it("applies fixed bottom positioning with safe area insets and high z-index", () => {
    const html = renderWithCart(
      React.createElement(StickyPurchaseBar, {
        product: mockProduct,
        activeVariant: mockVariants[0],
        forceVisible: true,
      })
    );

    expect(html).toContain("sticky-purchase-bar");
    expect(html).toContain("fixed bottom-0");
    expect(html).toContain("z-40");
    expect(html).toContain("safe-area-inset-bottom");
  });

  it("disables Add to Bag CTA on sticky bar when variant is sold out", () => {
    const soldOutVariant = mockVariants.find((v) => v.stock === 0)!;
    const html = renderWithCart(
      React.createElement(StickyPurchaseBar, {
        product: mockProduct,
        activeVariant: soldOutVariant,
        forceVisible: true,
      })
    );

    expect(html).toContain("Sold Out");
    expect(html).toMatch(
      /<button[^>]*disabled=""[^>]*aria-disabled="true"[^>]*>Sold Out<\/button>/
    );
  });

  it("hides sticky bar with opacity 0 and translateY(100%) when not visible", () => {
    const html = renderWithCart(
      React.createElement(StickyPurchaseBar, {
        product: mockProduct,
        activeVariant: mockVariants[0],
        forceVisible: false,
      })
    );

    expect(html).toContain("opacity:0");
    expect(html).toContain("visibility:hidden");
    expect(html).toContain("translateY(100%)");
  });
});

describe("Suite 5: PDPInteractiveTabs Accessibility & ARIA Specifications", () => {
  it("desktop view renders accessible role='tablist' container with 4 tabs", () => {
    const html = renderWithCart(
      React.createElement(PDPInteractiveTabs, { product: mockProduct })
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('role="tab"');
    expect(html).toContain("All Overview");
    expect(html).toContain("Sensory Cupping");
    expect(html).toContain("Steeping Guide");
    expect(html).toContain("Tea Moments");
  });

  it("assigns roving tabIndex=0 to active tab and tabIndex=-1 to inactive tabs", () => {
    const html = renderWithCart(
      React.createElement(PDPInteractiveTabs, {
        product: mockProduct,
        initialTab: "steeping",
      })
    );

    // Steeping tab must be selected with tabIndex 0
    expect(html).toMatch(
      /<button[^>]*id="tab-steeping"[^>]*aria-selected="true"[^>]*tabindex="0"/
    );
    // Other tabs must have tabIndex -1
    expect(html).toMatch(
      /<button[^>]*id="tab-cupping"[^>]*aria-selected="false"[^>]*tabindex="-1"/
    );
    expect(html).toMatch(
      /<button[^>]*id="tab-moments"[^>]*aria-selected="false"[^>]*tabindex="-1"/
    );
  });

  it("associates tabs with corresponding tab panels via aria-controls and aria-labelledby", () => {
    const html = renderWithCart(
      React.createElement(PDPInteractiveTabs, { product: mockProduct })
    );

    expect(html).toContain('aria-controls="panel-all"');
    expect(html).toContain('aria-controls="panel-cupping"');
    expect(html).toContain('aria-controls="panel-steeping"');
    expect(html).toContain('aria-controls="panel-moments"');

    expect(html).toContain('role="tabpanel" id="panel-all" aria-labelledby="tab-all"');
    expect(html).toContain('role="tabpanel" id="panel-cupping" aria-labelledby="tab-cupping"');
    expect(html).toContain('role="tabpanel" id="panel-steeping" aria-labelledby="tab-steeping"');
    expect(html).toContain('role="tabpanel" id="panel-moments" aria-labelledby="tab-moments"');
  });

  it("mobile view provides collapsible accordion triggers with aria-expanded", () => {
    const html = renderWithCart(
      React.createElement(PDPInteractiveTabs, { product: mockProduct })
    );

    expect(html).toContain("accordion-trigger");
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain("Sensory &amp; Cupping Profile");
    expect(html).toContain("Interactive Steeping Guide");
    expect(html).toContain("Tea Moments");
  });

  it("hosts CuppingProfile, SteepingGuide, and TeaMoments components", () => {
    const html = renderWithCart(
      React.createElement(PDPInteractiveTabs, {
        product: mockProduct,
        initialTab: "all",
      })
    );

    // Cupping Profile contents
    expect(html).toContain("Cupping &amp; Sensory Profile");
    expect(html).toContain("Stage 01");
    expect(html).toContain("Dry Leaf");
    expect(html).toContain("FTGFOP1");
    expect(html).toContain("Sunlit Amber Gold");

    // Steeping Guide contents
    expect(html).toContain("Interactive Steeping Guide");
    expect(html).toContain("Cup Servings Multiplier");
    expect(html).toContain("2.5g");
    expect(html).toContain("200ml");
    expect(html).toContain("85°C");

    // Terroir Dossier contents
    expect(html).toContain("Tea Moments");
    expect(html).toContain("A quiet cup.");
    expect(html).not.toContain("Altitude &amp; Elevation");
    expect(html).not.toContain("DJ/EX-02/2026");
  });
});

describe("Editorial PDP empty catalogue and sourcing safety", () => {
  it("shows an honest empty state when the admin has not supplied variants", () => {
    const html = renderWithCart(React.createElement(VariantPicker, {
      product: { ...mockProduct, variants: [] },
    }));
    expect(html).toContain("No variants available for this tea.");
    expect(html).not.toContain("Add to Bag");
  });

  it("formats bulk sizes as 1kg, 5kg, 10kg, 25kg, 35kg with truthful cup yields", () => {
    const bulkVariants: Variant[] = [
      { id: 1, product_id: 1, sku: "TFW-100G", packaging_format: "loose_leaf_pouch", grams: 100, price_paise: 3000, stock: 10, servings: 50 },
      { id: 2, product_id: 1, sku: "TFW-250G", packaging_format: "loose_leaf_pouch", grams: 250, price_paise: 7000, stock: 10, servings: 125 },
      { id: 3, product_id: 1, sku: "TFW-500G", packaging_format: "loose_leaf_pouch", grams: 500, price_paise: 14500, stock: 10, servings: 250 },
      { id: 4, product_id: 1, sku: "TFW-1KG", packaging_format: "loose_leaf_pouch", grams: 1000, price_paise: 28000, stock: 10, servings: 500 },
      { id: 5, product_id: 1, sku: "TFW-5KG", packaging_format: "loose_leaf_pouch", grams: 5000, price_paise: 140000, stock: 10, servings: 50 }, // default 50 in DB should be corrected
      { id: 6, product_id: 1, sku: "TFW-10KG", packaging_format: "loose_leaf_pouch", grams: 10000, price_paise: 280000, stock: 10, servings: 50 },
      { id: 7, product_id: 1, sku: "TFW-25KG", packaging_format: "loose_leaf_pouch", grams: 25000, price_paise: 700000, stock: 10, servings: 50 },
      { id: 8, product_id: 1, sku: "TFW-35KG", packaging_format: "loose_leaf_pouch", grams: 35000, price_paise: 980000, stock: 10, servings: 50 },
    ];

    const html = renderWithCart(React.createElement(VariantPicker, {
      product: { ...mockProduct, leaf_dose_grams: 2, variants: bulkVariants },
    }));

    // Check size titles
    expect(html).toContain("100g");
    expect(html).toContain("250g");
    expect(html).toContain("500g");
    expect(html).toContain("1kg");
    expect(html).toContain("5kg");
    expect(html).toContain("10kg");
    expect(html).toContain("25kg");
    expect(html).toContain("35kg");

    // Check cups are truthfully calculated
    expect(html).toContain("~50 cups");
    expect(html).toContain("~125 cups");
    expect(html).toContain("~250 cups");
    expect(html).toContain("~500 cups");
    expect(html).toContain("~2,500 cups");
    expect(html).toContain("~5,000 cups");
    expect(html).toContain("~12,500 cups");
    expect(html).toContain("~17,500 cups");
  });

  it("keeps demo checkout disclosure and an accessible purchase status", () => {
    const html = renderWithCart(React.createElement(VariantPicker, { product: mockProduct }));
    expect(html).toContain("No real payment is collected");
    expect(html).toContain('role="status"');
    expect(html).not.toContain("Direct garden harvest");
    expect(html).not.toContain("Biodegradable");
  });
});
