import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { CRAFT_STAGES } from "@/components/leaf-to-cup/LeafToCupStory";
import { getCatalogSitemapEntries } from "@/lib/seo/sitemap";
import { constructMetadata } from "@/lib/seo/metadata";

describe("Leaf to Cup Scrollytelling Configuration & Assets", () => {
  it("contains exactly 7 sequential stages representing authentic orthodox tea crafting", () => {
    expect(CRAFT_STAGES).toHaveLength(7);
    const expectedNames = [
      "Plucking",
      "Withering",
      "Rolling",
      "Oxidation",
      "Drying",
      "Sorting",
      "Brewing",
    ];
    CRAFT_STAGES.forEach((stage, index) => {
      expect(stage.step).toBe(String(index + 1).padStart(2, "0"));
      expect(stage.name).toBe(expectedNames[index]);
      expect(stage.title).toBeTruthy();
      expect(stage.description).toBeTruthy();
      expect(stage.insight).toBeTruthy();
      expect(stage.topBadge).toBeTruthy();
      expect(stage.caption).toBeTruthy();
      expect(stage.alt).toBeTruthy();
      expect(stage.accentBg).toMatch(/^#[0-9a-fA-F]{6}$/);
    });
  });

  it("ensures all 7 high-resolution realistic stage images exist on disk", () => {
    CRAFT_STAGES.forEach((stage) => {
      const publicPath = path.join(process.cwd(), "public", stage.image.replace(/^\//, ""));
      expect(fs.existsSync(publicPath)).toBe(true);
      const stat = fs.statSync(publicPath);
      // Realistic high-res images should be substantial in size (> 100KB)
      expect(stat.size).toBeGreaterThan(100 * 1024);
    });
  });

  it("constructs proper SEO metadata and canonicals for /leaf-to-cup", () => {
    const meta = constructMetadata({
      title: "From Leaf to Cup — The Himalayan Orthodox Tea Journey",
      description: "Experience the 7 stages of artisanal orthodox black tea craftsmanship.",
      path: "/leaf-to-cup",
      ogImage: "/images/craft/stage-01-plucking.jpg",
    });

    expect(meta.title).toContain("From Leaf to Cup");
    expect(meta.description).toContain("artisanal orthodox black tea");
    expect(meta.alternates?.canonical).toContain("/leaf-to-cup");
    expect(meta.openGraph?.images).toBeDefined();
  });

  it("includes /leaf-to-cup in catalog sitemap entries", () => {
    const entries = getCatalogSitemapEntries();
    const leafEntry = entries.find((e) => e.url.endsWith("/leaf-to-cup"));
    expect(leafEntry).toBeDefined();
    expect(leafEntry?.priority).toBeGreaterThanOrEqual(0.8);
    expect(leafEntry?.changeFrequency).toBe("weekly");
  });
});
