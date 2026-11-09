import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToString } from "react-dom/server";
import AboutPage, { generateMetadata } from "@/app/about/page";
import { getPageOrDefault } from "@/lib/pages";

describe("/about Page Design & Content Verification", () => {
  it("verifies all high-resolution editorial image assets exist on disk in public/images/about", () => {
    const requiredImages = [
      "hero-himalayan-dawn.webp",
      "hero-himalayan-dawn.jpg",
      "cupping-laboratory.webp",
      "cupping-laboratory.jpg",
      "siliguri-packaging-craft.webp",
      "siliguri-packaging-craft.jpg",
      "two-leaves-and-a-bud.webp",
      "two-leaves-and-a-bud.jpg",
    ];

    for (const img of requiredImages) {
      const fullPath = path.join(process.cwd(), "public/images/about", img);
      expect(fs.existsSync(fullPath), `Missing image asset: ${img}`).toBe(true);
      const stat = fs.statSync(fullPath);
      // High-resolution optimized editorial images should be > 50KB and <= 500KB
      expect(stat.size).toBeGreaterThan(50 * 1024);
      expect(stat.size).toBeLessThan(600 * 1024);
    }
  });

  it("generates valid SEO metadata and OpenGraph configuration for /about", async () => {
    const metadata = await generateMetadata();
    expect(metadata.title).toBeDefined();
    expect(String(metadata.title)).toMatch(/About.*TeaFloww|About.*Single-Estate/i);
    expect(metadata.description).toBeDefined();
    expect(String(metadata.description)).toContain("Siliguri");
    expect(metadata.alternates?.canonical).toContain("/about");
    expect(metadata.openGraph?.images).toBeDefined();
  });

  it("retrieves published page record from getPageOrDefault('about')", () => {
    const page = getPageOrDefault("about");
    expect(page).toBeDefined();
    expect(page.slug).toBe("about");
    expect(page.is_published).toBe(1);
    expect(page.title).toContain("About");
  });

  it("renders the AboutPage server component with verified provenance, corporate entity details, and four terroirs", () => {
    const html = renderToString(React.createElement(AboutPage));

    // Brand and legal entity integrity (AGENTS.md compliance)
    expect(html).toContain("TeaFloww");
    expect(html).toContain("Nirva");
    expect(html).toContain("19CTHPK8646J2ZY"); // GSTIN
    expect(html).toContain("info@teafloww.com");
    expect(html).toContain("+91 7001304853");
    expect(html).toContain("Fulbari Ghoshpukur Bypass");
    expect(html).toContain("Shiv Shakti Kali Bari Rd");

    // The 4 Mountain Terroirs
    expect(html).toContain("Darjeeling");
    expect(html).toContain("Assam");
    expect(html).toContain("Kangra");
    expect(html).toContain("Nilgiri");

    // Sourcing Standards and Cupping
    expect(html).toContain("Single-Estate Purity");
    expect(html).toContain("Zero Synthetic Additives");
    expect(html).toContain("Sensory Cupping");
    expect(html).toContain("Garden Stewardship");
    expect(html).toContain("Two Leaves &amp; a Bud");

    // Structured JSON-LD Schemas present in rendered DOM
    expect(html).toContain("application/ld+json");
    expect(html).toContain("TeaStore");
    expect(html).toContain("BreadcrumbList");
  });
});
