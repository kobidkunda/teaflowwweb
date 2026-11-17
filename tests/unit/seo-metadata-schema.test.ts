import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { normalizePath, buildCanonicalUrl, stripTrackingParams } from "@/lib/seo/canonical";
import { constructMetadata } from "@/lib/seo/metadata";
import {
  getOrganizationSchema,
  getLocalBusinessSchema,
  getProductSchema,
  getTrialProductSchema,
  getPackagingProductSchema,
  getBreadcrumbSchema,
  getArticleSchema,
  getCollectionSchema,
} from "@/lib/seo/schema";
import { resolveProductCommercePolicy } from "@/lib/seo/productPolicy";
import { getCatalogSitemapEntries } from "@/lib/seo/sitemap";
import robots from "@/app/robots";
import type { Product, Variant } from "@/lib/productModels";

describe("Canonical URL Generation & Normalization", () => {
  it("normalizes path with lowercase and removes redundant trailing slashes", () => {
    expect(normalizePath("/")).toBe("/");
    expect(normalizePath("/TEA/Darjeeling-Spring/")).toBe("/tea/darjeeling-spring");
    expect(normalizePath("shop/")).toBe("/shop");
    expect(normalizePath("/learn//how-to-brew")).toBe("/learn/how-to-brew");
    expect(normalizePath("/tea/assam?utm_source=google")).toBe("/tea/assam");
  });

  it("builds absolute HTTPS canonical URLs and strips tracking parameters", () => {
    const canonical = buildCanonicalUrl("/tea/darjeeling-spring?utm_source=newsletter&utm_medium=email&gclid=12345");
    expect(canonical).toBe("https://himalayantea.com/tea/darjeeling-spring");
  });

  it("preserves allowed query parameters when specified", () => {
    const canonical = buildCanonicalUrl("/shop?category=black&utm_campaign=spring", ["category"]);
    expect(canonical).toBe("https://himalayantea.com/shop?category=black");
  });

  it("cleans tracking parameters from arbitrary URL strings", () => {
    const cleaned = stripTrackingParams("https://himalayantea.com/tea/assam?utm_source=meta&fbclid=xyz&variant=tin");
    expect(cleaned).toContain("variant=tin");
    expect(cleaned).not.toContain("utm_source");
    expect(cleaned).not.toContain("fbclid");
  });
});

describe("Metadata Generation Engine (constructMetadata)", () => {
  it("generates complete metadata object with absolute canonical and OpenGraph", () => {
    const meta = constructMetadata({
      title: "Darjeeling First Flush",
      description: "Artisanal spring flush orthodox tea.",
      path: "/tea/darjeeling-spring",
      ogImage: "/images/darjeeling.jpg",
    });

    expect(meta.title).toBe("Darjeeling First Flush · TeaFloww");
    expect(meta.description).toBe("Artisanal spring flush orthodox tea.");
    expect(meta.alternates?.canonical).toBe("https://himalayantea.com/tea/darjeeling-spring");
    expect(meta.openGraph?.title).toBe("Darjeeling First Flush");
    expect(meta.openGraph?.url).toBe("https://himalayantea.com/tea/darjeeling-spring");
    expect(meta.openGraph?.images).toBeDefined();
    expect(meta.twitter).toEqual(expect.objectContaining({ card: "summary_large_image" }));
    expect(meta.robots).toEqual(
      expect.objectContaining({
        index: true,
        follow: true,
      })
    );
  });

  it("applies noindex directives cleanly when requested", () => {
    const meta = constructMetadata({
      title: "Private Utility",
      path: "/private",
      noindex: true,
    });

    expect(meta.robots).toEqual(
      expect.objectContaining({
        index: false,
        follow: false,
      })
    );
  });
});

describe("Schema.org JSON-LD Structured Data", () => {
  it("generates Organization schema with verified legal entity and contact", () => {
    const org = getOrganizationSchema();
    expect(org["@context"]).toBe("https://schema.org");
    expect(org["@type"]).toEqual(["Organization", "OnlineStore"]);
    expect(["Himalayan Tea House", "TeaFloww"]).toContain(org.name);
    expect(org.url).toBe("https://himalayantea.com");
    expect(org.address.addressLocality).toBe("Siliguri");
    expect(org.address.addressCountry).toBe("IN");
    expect(org.contactPoint[0].telephone).toMatch(/(\+91-353-2570112|\+91\s*7001304853|\+91-7001304853)/);
  });

  it("generates LocalBusiness schema for Siliguri tasting room and sourcing hub", () => {
    const local = getLocalBusinessSchema();
    expect(local["@context"]).toBe("https://schema.org");
    expect(local["@type"]).toEqual(["Store", "LocalBusiness"]);
    expect(local.name).toContain("Siliguri Tasting Room");
    expect(local.geo.latitude).toBeCloseTo(26.7271, 3);
    expect(local.geo.longitude).toBeCloseTo(88.3953, 3);
    expect(local.openingHoursSpecification.length).toBeGreaterThan(0);
  });

  it("generates Product schema with genuine Offers, prices in INR, and merchant return policy", () => {
    const mockProduct: Product = {
      id: 1,
      slug: "darjeeling-spring",
      name: "Darjeeling Spring Clonal First Flush",
      category: "Black",
      category_id: 1,
      origin: "Darjeeling, India",
      estate: "Risheehat",
      flush: "First Flush",
      harvest_date: "Spring 2026",
      description: "Delicate and floral single-estate tea.",
      tasting_notes: "Floral, muscatel",
      floral: 5,
      fruity: 3,
      malty: 2,
      body: 3,
      sweetness: 4,
      earthy: 1,
      aroma_tags: ["Muscatel", "Wild Orchid"],
      dry_leaf_appearance: "Twisted FTGFOP1",
      dry_leaf_grade: "FTGFOP1",
      dry_leaf_aroma: "Sweet floral",
      liquor_hue_hex: "#d49a3d",
      liquor_hue_name: "Bright Amber",
      liquor_clarity: "Brilliant",
      liquor_body: "Medium",
      wet_leaf_aroma: "Orchid bouquet",
      wet_leaf_oxidation: "Light 40%",
      brew_temp: 90,
      brew_seconds: 180,
      leaf_dose_grams: 2.5,
      water_ml: 200,
      steep_count: 3,
      steep_instructions: "Infuse for 3 mins in spring water",
      elevation_feet: 5500,
      elevation_display: "5,500 ft",
      lot_number: "RH-EX-01/26",
      cultivar: "AV2 Clonal",
      estate_story: "Grown along misty eastern Himalayan ridges.",
      featured: 1,
      variants: [],
    };

    const mockVariants: Variant[] = [
      {
        id: 101,
        product_id: 1,
        sku: "DJ-SP-100G",
        packaging_format: "luxury_tin",
        grams: 100,
        servings: 50,
        price_paise: 95000, // ₹950.00
        stock: 25,
      },
    ];

    const schema = getProductSchema(mockProduct, mockVariants);

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("Product");
    expect(schema.name).toBe("Darjeeling Spring Clonal First Flush");
    expect(["Himalayan Tea House", "TeaFloww"]).toContain(schema.brand.name);

    expect("offers" in schema).toBe(true);
    if ("offers" in schema && schema.offers) {
      const offer = Array.isArray(schema.offers) ? schema.offers[0] : schema.offers;
      expect(offer["@type"]).toBe("Offer");
      expect(offer.price).toBe("950.00");
      expect(offer.priceCurrency).toBe("INR");
      expect(offer.availability).toBe("https://schema.org/InStock");
      expect(offer.hasMerchantReturnPolicy.merchantReturnDays).toBe(14);
      // ₹950.00 qualifies for free shipping above the ₹599 threshold
      expect(offer.shippingDetails.shippingRate.value).toBe("0.00");
    }

    // Strict Anti-Fabrication & Deprecation Fences:
    // 1. MUST NOT contain deprecated FAQ schema
    expect(JSON.stringify(schema)).not.toContain("FAQPage");
    // 2. MUST NOT fabricate fake aggregate star ratings or fake reviews
    expect(schema).not.toHaveProperty("aggregateRating");
    expect(schema).not.toHaveProperty("review");
    // 3. MUST NOT invent fake GTIN barcodes
    expect(schema).not.toHaveProperty("gtin13");
  });

  it("generates ProductGroup schema for multi-variant products with price range, per-variant shipping, overrides, and conditional ratings", () => {
    const mockProduct: Product = {
      id: 99,
      slug: "assam-reserve",
      name: "Assam Reserve Orthodox",
      category: "Black",
      category_id: 1,
      origin: "Assam, India",
      estate: "Halmari",
      flush: "Second Flush",
      harvest_date: "Summer 2026",
      description: "Rich malty orthodox tea.",
      tasting_notes: "Malt, honey",
      floral: 2,
      fruity: 3,
      malty: 5,
      body: 5,
      sweetness: 4,
      earthy: 2,
      aroma_tags: ["Malt"],
      dry_leaf_appearance: "Tippy whole leaf",
      dry_leaf_grade: "TGFOP1",
      dry_leaf_aroma: "Sweet malt",
      liquor_hue_hex: "#a04010",
      liquor_hue_name: "Deep Copper",
      liquor_clarity: "Bright",
      liquor_body: "Full",
      wet_leaf_aroma: "Baked honey",
      wet_leaf_oxidation: "Full",
      brew_temp: 95,
      brew_seconds: 210,
      leaf_dose_grams: 2.5,
      water_ml: 200,
      steep_count: 3,
      steep_instructions: "Infuse 3.5 mins",
      elevation_feet: 400,
      elevation_display: "400 ft",
      lot_number: "HM-26",
      cultivar: "Assam",
      estate_story: "Upper Assam heritage garden.",
      featured: 1,
      shipping_fee_paise_override: 15000, // ₹150.00
      handling_days_min_override: 1,
      handling_days_max_override: 2,
      transit_days_min_override: 2,
      transit_days_max_override: 7, // total 3–9 days
      return_window_days_override: 7,
      variants: [],
    };

    const mockVariants: Variant[] = [
      {
        id: 201,
        product_id: 99,
        sku: "AS-100G",
        packaging_format: "loose_leaf_pouch",
        grams: 100,
        servings: 50,
        price_paise: 37500, // ₹375.00
        stock: 15,
      },
      {
        id: 202,
        product_id: 99,
        sku: "AS-500G",
        packaging_format: "luxury_tin",
        grams: 500,
        servings: 250,
        price_paise: 135300, // ₹1,353.00
        stock: 8,
      },
    ];

    const policy = resolveProductCommercePolicy({
      overrides: mockProduct,
      reviewSummary: { ratingValue: 4.3, reviewCount: 61 },
    });

    const group = getProductSchema(mockProduct, mockVariants, [], { policy });
    expect(group["@type"]).toBe("ProductGroup");
    if ("hasVariant" in group) {
      expect(group.hasVariant).toHaveLength(2);
      expect(group.hasVariant[0].offers.price).toBe("375.00");
      expect(group.hasVariant[0].offers.shippingDetails.shippingRate.value).toBe("150.00");
      expect(group.hasVariant[0].offers.shippingDetails.deliveryTime.handlingTime.minValue).toBe(1);
      expect(group.hasVariant[0].offers.shippingDetails.deliveryTime.transitTime.maxValue).toBe(7);
      expect(group.hasVariant[0].offers.hasMerchantReturnPolicy.merchantReturnDays).toBe(7);
      expect(group.hasVariant[1].offers.price).toBe("1353.00");
    }
    expect((group as Record<string, unknown>).aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: "4.3",
      reviewCount: 61,
      bestRating: 5,
      worstRating: 1,
    });
  });

  it("generates Trial Kit and Private Label Packaging schemas with shipping & return policies", () => {
    const trialSchema = getTrialProductSchema({
      id: "trial-1",
      slug: "tea-stall-discovery-kit",
      title: "TeaFloww Four-Tea Discovery Kit",
      tagline: "4 x 50g",
      description: "Four Assam & Dooars tea blends.",
      status: "published",
      pack_format: "4x50g_sachets",
      net_weight_g: 200,
      price_paise: 18900,
      compare_at_price_paise: null,
      sku: "KIT-200G",
      in_stock: true,
      hero_image: { url: "/images/tea.jpg", alt_text: "Trial kit" },
      components: [],
      claims: [],
      meta: { title: null, description: null },
      policy_overrides: {
        handling_days_min_override: 1,
        handling_days_max_override: 2,
        transit_days_min_override: 2,
        transit_days_max_override: 7,
        return_window_days_override: 3,
      },
    });
    expect(trialSchema["@type"]).toBe("Product");
    expect(trialSchema.offers.price).toBe("189.00");
    expect(trialSchema.offers.availability).toBe("https://schema.org/InStock");
    expect(trialSchema.offers.hasMerchantReturnPolicy.merchantReturnDays).toBe(3);
    expect(trialSchema.offers.shippingDetails.deliveryTime.transitTime.maxValue).toBe(7);
    expect(trialSchema).not.toHaveProperty("aggregateRating");

    const packSchema = getPackagingProductSchema({
      id: "pack-1",
      family_id: "fam-1",
      name: "Stand-Up Pouch",
      slug: "stand-up-pouch-matte-black-250g",
      sku: "PL-PC-250-MBK",
      title: "Stand-Up Pouch Matte Black 250g",
      category: "Pouch",
      family: "Pouch",
      capacity_description: "250g",
      net_capacity_grams: 250,
      net_weight_capacity_grams: 250,
      dimensions_mm: { width: 160, height: 230, depth: 80 },
      label_safe_area_mm: { width: 120, height: 150 },
      material: "Kraft Barrier",
      finish: "Matte",
      closure_type: "Zipper",
      barrier_properties: ["Moisture"],
      moq_units: 500,
      order_multiple: 50,
      lead_time_days: 14,
      image_url: "/images/pouch.jpg",
      hero_image_url: "/images/pouch.jpg",
      image_illustrative: false,
      dieline_url: null,
      dieline_available: false,
      supported_print_methods: ["digital"],
      compatible_print_method_codes: ["digital"],
      status: "published",
      starting_price: {
        currency: "INR",
        unit_price_paise: 1200,
        formatted_unit_price: "₹12.00",
        min_quantity: 500,
        tier_label: "From 500 units",
      },
    });
    expect(packSchema["@type"]).toBe("Product");
    expect(packSchema.offers.price).toBe("12.00");
    expect(packSchema.offers.shippingDetails.deliveryTime.handlingTime.minValue).toBeGreaterThanOrEqual(14);
    expect(packSchema.offers.hasMerchantReturnPolicy).toBeDefined();
  });

  it("generates BreadcrumbList and Article schemas", () => {
    const breadcrumbs = getBreadcrumbSchema([
      { name: "Home", url: "/" },
      { name: "Teas", url: "/shop" },
      { name: "Darjeeling", url: "/tea/darjeeling-spring" },
    ]);
    expect(breadcrumbs["@type"]).toBe("BreadcrumbList");
    expect(breadcrumbs.itemListElement).toHaveLength(3);
    expect(breadcrumbs.itemListElement[0].position).toBe(1);
    expect(breadcrumbs.itemListElement[2].item).toBe("https://himalayantea.com/tea/darjeeling-spring");

    const article = getArticleSchema({
      slug: "how-to-brew-assam-tea",
      title: "How to Brew Assam Orthodox Tea",
      content: "Brewing guide content...",
      author_name: "Tashi Bhutia",
      published_at: "2026-03-15T08:00:00Z",
    });
    expect(article["@type"]).toBe("Article");
    expect(article.headline).toBe("How to Brew Assam Orthodox Tea");
    expect(article.author.name).toBe("Tashi Bhutia");
    expect(["Himalayan Tea House", "TeaFloww"]).toContain(article.publisher.name);
  });
});

describe("Crawlability Infrastructure: Robots & Sitemaps", () => {
  it("exports valid robots rules excluding private routes and linking sitemap.xml", () => {
    const config = robots();
    const rules = Array.isArray(config.rules) ? config.rules[0] : config.rules;
    expect(rules.allow).toBe("/");
    expect(rules.disallow).toContain("/admin/");
    expect(rules.disallow).toContain("/checkout/");
    expect(rules.disallow).toContain("/cart/");
    expect(config.sitemap).toBe("https://himalayantea.com/sitemap.xml");
  });

  it("generates dynamic sitemap entries including products, collections, guides, and trust routes", () => {
    const entries = getCatalogSitemapEntries();
    expect(entries.length).toBeGreaterThan(10);

    const urls = entries.map((e) => e.url);
    expect(urls).toContain("https://himalayantea.com");
    expect(urls).toContain("https://himalayantea.com/shop");
    expect(urls).toContain("https://himalayantea.com/blog");
    expect(urls).toContain("https://himalayantea.com/compare");
    expect(urls).toContain("https://himalayantea.com/about");
    expect(urls).toContain("https://himalayantea.com/locations/siliguri");
    expect(urls).toContain("https://himalayantea.com/shipping");

    // All entries must have valid lastModified and priority
    for (const entry of entries) {
      expect(entry.url).toMatch(/^https:\/\/himalayantea\.com/);
      expect(entry.lastModified).toBeDefined();
      expect(entry.priority).toBeGreaterThanOrEqual(0.1);
    }
  });
});

describe("Handoff Documentation Deliverables Completeness (All 10 Files)", () => {
  const rootDir = process.cwd();
  const requiredFiles = [
    "SEO_STRATEGY.md",
    "URL_INVENTORY.csv",
    "TECHNICAL_SEO.md",
    "SCHEMA_MAP.md",
    "CONTENT_PLAN.md",
    "LOCAL_SEO.md",
    "ECOMMERCE_SEARCH.md",
    "TRACKING_PLAN.md",
    "QA_RESULTS.md",
    "RUNBOOK.md",
  ];

  for (const filename of requiredFiles) {
    it(`verifies presence and substantial content of ${filename}`, () => {
      const filePath = path.join(rootDir, filename);
      expect(fs.existsSync(filePath), `Missing required deliverable: ${filename}`).toBe(true);

      const content = fs.readFileSync(filePath, "utf-8").trim();
      expect(content.length, `${filename} must not be empty`).toBeGreaterThan(100);

      // Verify no unresolved placeholder marks
      expect(content).not.toContain("TODO_INSERT_HERE");
      expect(content).not.toContain("PLACEHOLDER_TEXT");
    });
  }
});
