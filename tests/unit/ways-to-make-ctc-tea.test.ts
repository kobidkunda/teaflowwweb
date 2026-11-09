import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import WaysToMakeCtcTeaPage, { generateMetadata } from "@/app/ways-to-make-ctc-tea/page";
import { CTC_BREW_METHODS } from "@/components/ctc-brew/data";
import { getCatalogSitemapEntries } from "@/lib/seo/sitemap";
import { CartProvider } from "@/components/CartProvider";

describe("/ways-to-make-ctc-tea Page & Craft Visuals Verification", () => {
  it("verifies all 7 high-resolution CTC method images exist in public/images/ctc-brew/", () => {
    const requiredImages = [
      "method-01-kadak-chai.jpg",
      "method-02-masala-chai.jpg",
      "method-03-kulhad-chai.jpg",
      "method-04-sulaimani-tea.jpg",
      "method-05-adrak-tulsi-chai.jpg",
      "method-06-iced-ctc-latte.jpg",
      "method-07-himalayan-butter-chai.jpg",
    ];

    expect(CTC_BREW_METHODS).toHaveLength(7);

    for (const img of requiredImages) {
      const fullPath = path.join(process.cwd(), "public/images/ctc-brew", img);
      expect(fs.existsSync(fullPath), `Missing image asset: ${img}`).toBe(true);
      const stat = fs.statSync(fullPath);
      // High-resolution realistic photography should be > 200KB and < 2MB
      expect(stat.size).toBeGreaterThan(200 * 1024);
      expect(stat.size).toBeLessThan(2 * 1024 * 1024);
    }
  });

  it("generates valid SEO metadata with canonical path and OpenGraph image", async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toBeDefined();
    expect(String(metadata.title)).toMatch(/Ways to Make CTC Tea|CTC.*Brewing/i);
    expect(metadata.description).toBeDefined();
    expect(metadata.alternates?.canonical).toContain("/ways-to-make-ctc-tea");
    expect(metadata.openGraph?.images).toBeDefined();
  });

  it("verifies sitemap includes /ways-to-make-ctc-tea", () => {
    const sitemap = getCatalogSitemapEntries();
    const entry = sitemap.find((e) => e.url.endsWith("/ways-to-make-ctc-tea"));
    expect(entry).toBeDefined();
    expect(entry?.priority).toBe(0.85);
  });

  it("renders the WaysToMakeCtcTeaPage with structured data, 7 methods, calculator, and science sections", () => {
    const html = renderToString(
      React.createElement(CartProvider, null, React.createElement(WaysToMakeCtcTeaPage))
    );

    // Structured JSON-LD schemas
    expect(html).toContain("application/ld+json");
    expect(html).toContain("HowTo");
    expect(html).toContain("BreadcrumbList");

    // All 7 Methods represented
    expect(html).toContain("Classic Kadak Milk Chai");
    expect(html).toContain("Royal Masala Chai");
    expect(html).toContain("Kolkata Street Kulhad Chai");
    expect(html).toContain("Pahari Sulaimani / Black Citrus CTC");
    expect(html).toContain("Adrak-Tulsi Morning Tonic");
    expect(html).toContain("Creamy Iced CTC Chai Latte");
    expect(html).toContain("Himalayan Salt &amp; Butter Mountain Brew");

    // Science and fundamentals
    expect(html).toContain("The Science Behind CTC Granules");
    expect(html).toContain("Crush, Tear, Curl");
    expect(html).toContain("Water First, Milk Second");
    expect(html).toContain("The Aeration Lift Pour");
    expect(html).toContain("Orthodox Whole Leaf vs. CTC Granules");

    // Interactive Calculator
    expect(html).toContain("Interactive Ratio Customizer");
    expect(html).toContain("Craft Your Exact Cup Profile");

    // FAQ Section
    expect(html).toContain("Frequently Asked Brewing Questions");
    expect(html).toContain("zingipain");

    // Cross-link to Orthodox Leaf-to-Cup
    expect(html).toContain("Experience the 7-Stage Leaf-to-Cup Journey");
    expect(html).toContain("/leaf-to-cup");
  });
});
