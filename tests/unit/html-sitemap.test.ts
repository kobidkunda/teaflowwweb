import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { getPublicSitemapData } from "@/lib/seo/htmlSitemap";
import { getCatalogSitemapEntries } from "@/lib/seo/sitemap";
import { Footer } from "@/components/Footer";
import { getSiteNavigation } from "@/lib/contentBlocks";
import SitemapPage, { generateMetadata } from "@/app/sitemap/page";
import { SitemapExplorer } from "@/components/sitemap/SitemapExplorer";
import { getSiteUrl } from "@/lib/seo/site";

describe("HTML Public Sitemap & Footer Integration", () => {
  describe("getPublicSitemapData domain logic", () => {
    it("returns structured sitemap data with valid total count and sections", () => {
      const data = getPublicSitemapData();

      expect(data).toBeDefined();
      expect(data.totalCount).toBeGreaterThan(0);
      expect(Array.isArray(data.sections)).toBe(true);
      expect(data.sections.length).toBeGreaterThanOrEqual(4);
      expect(data.generatedAt).toBeDefined();
    });

    it("verifies that EVERY URL in the sitemap is strictly a public storefront URL", () => {
      const data = getPublicSitemapData();

      const forbiddenPrefixes = [
        "/admin",
        "/api",
        "/account",
        "/checkout",
        "/login",
        "/order",
        "/purchase",
      ];

      for (const section of data.sections) {
        expect(section.id).toBeDefined();
        expect(section.title).toBeDefined();
        expect(section.description).toBeDefined();
        expect(section.items.length).toBe(section.count);

        for (const item of section.items) {
          expect(item.title).toBeTruthy();
          expect(item.url).toMatch(/^\/[a-zA-Z0-9_\-\.\/]*$/);

          // STRICT CHECK: Never expose private or internal admin/session URLs
          for (const forbidden of forbiddenPrefixes) {
            expect(item.url.startsWith(forbidden)).toBe(false);
          }

          // Must have valid title and url
          expect(item.url.length).toBeGreaterThan(0);
        }
      }
    });

    it("includes core storefront hubs in the sitemap", () => {
      const data = getPublicSitemapData();
      const storefrontSection = data.sections.find((s) => s.id === "storefront");
      expect(storefrontSection).toBeDefined();

      const urls = storefrontSection!.items.map((i) => i.url);
      expect(urls).toContain("/");
      expect(urls).toContain("/shop");
      expect(urls).toContain("/wholesale");
      expect(urls).toContain("/trials");
      expect(urls).toContain("/blend-lab");
      expect(urls).toContain("/blend-lab/start");
      expect(urls).toContain("/private-label");
      expect(urls).toContain("/private-label/packaging");
      expect(urls).toContain("/tea-finder");
      expect(urls).toContain("/compare");
      expect(urls).toContain("/brochure");
      expect(urls).toContain("/feeds");
    });

    it("includes craft, brewing education, and comparison guides", () => {
      const data = getPublicSitemapData();
      const craftSection = data.sections.find((s) => s.id === "craft-education");
      expect(craftSection).toBeDefined();

      const urls = craftSection!.items.map((i) => i.url);
      expect(urls).toContain("/blog");
      expect(urls).toContain("/learn");
      expect(urls).toContain("/leaf-to-cup");
      expect(urls).toContain("/ways-to-make-ctc-tea");
      expect(urls).toContain("/locations/siliguri");
      expect(urls).toContain("/about");
      expect(urls).toContain("/brand");
      expect(urls).toContain("/compare/assam-vs-darjeeling-tea");
      expect(urls).toContain("/compare/orthodox-vs-green-tea");
      expect(urls).toContain("/compare/first-flush-vs-second-flush");
    });

    it("includes customer care, trust, and legal policies", () => {
      const data = getPublicSitemapData();
      const policySection = data.sections.find((s) => s.id === "customer-care");
      expect(policySection).toBeDefined();

      const urls = policySection!.items.map((i) => i.url);
      expect(urls).toContain("/contact");
      expect(urls).toContain("/track");
      expect(urls).toContain("/payment-methods");
      expect(urls).toContain("/shipping");
      expect(urls).toContain("/returns");
      expect(urls).toContain("/privacy");
      expect(urls).toContain("/terms");
    });

    it("includes machine-readable indexes and feeds", () => {
      const data = getPublicSitemapData();
      const machineSection = data.sections.find((s) => s.id === "machine-indexes");
      expect(machineSection).toBeDefined();

      const urls = machineSection!.items.map((i) => i.url);
      expect(urls).toContain("/sitemap.xml");
      expect(urls).toContain("/llms.txt");
      expect(urls).toContain("/llms-full.txt");
      expect(urls).toContain("/ai-catalog.json");
    });
  });

  describe("SitemapPage Server Component & SEO Metadata", () => {
    it("generates correct metadata with canonical /sitemap", async () => {
      const metadata = await generateMetadata();
      expect(metadata.title).toMatch(/Site Directory|HTML Sitemap/);
      expect(metadata.description).toBeDefined();
      expect(metadata.alternates?.canonical).toContain("/sitemap");
    });

    it("renders SitemapPage with accessible headings and breadcrumbs schema", () => {
      const markup = renderToStaticMarkup(React.createElement(SitemapPage));

      // Contains breadcrumb JSON-LD
      expect(markup).toContain('"@type":"BreadcrumbList"');
      expect(markup).toContain('/sitemap');

      // Main headings
      expect(markup).toContain("Site Directory &amp; Sitemap");
      expect(markup).toContain("Public Navigation Index");

      // Verify explorer rendered
      expect(markup).toContain("tf-sitemap-explorer");
      expect(markup).toContain('role="search"');
      expect(markup).toContain('aria-label="Search all public pages and teas"');

      // Verify links exist in markup
      expect(markup).toContain('href="/shop"');
      expect(markup).toContain('href="/wholesale"');
      expect(markup).toContain('href="/sitemap.xml"');
    });
  });

  describe("SitemapExplorer Client Component", () => {
    it("renders search input, filter pills, and section cards", () => {
      const data = getPublicSitemapData();
      const markup = renderToStaticMarkup(
        React.createElement(SitemapExplorer, { initialData: data })
      );

      // Search box
      expect(markup).toContain('placeholder="Filter pages, teas, flushes, brewing guides, policies..."');

      // Machine links
      expect(markup).toContain("XML Sitemap");
      expect(markup).toContain("llms.txt");
      expect(markup).toContain("Feeds");
      expect(markup).toContain("Brochure (PDF)");

      // Filter pills
      expect(markup).toContain("All Sections");
      expect(markup).toContain("Only Public Pages");
    });
  });

  describe("Footer Integration", () => {
    it("renders link to /sitemap in DISCOVERY_LINKS and bottom legal bar", () => {
      const markup = renderToStaticMarkup(React.createElement(Footer));

      // Contains link to /sitemap
      expect(markup).toContain('href="/sitemap"');
      expect(markup).toContain("Site Directory &amp; Sitemap");
      expect(markup).toContain("Sitemap");
    });

    it("verifies defaultFooterLinks in contentBlocks includes /sitemap", () => {
      const nav = getSiteNavigation();
      const sitemapLink = nav.footer_links.find((l) => l.href === "/sitemap");
      expect(sitemapLink).toBeDefined();
      expect(sitemapLink?.href).toBe("/sitemap");
    });
  });

  describe("XML Sitemap Integration", () => {
    it("verifies /sitemap is included in getCatalogSitemapEntries()", () => {
      const entries = getCatalogSitemapEntries();
      const siteUrl = getSiteUrl();
      const sitemapEntry = entries.find((e) => e.url === `${siteUrl}/sitemap`);

      expect(sitemapEntry).toBeDefined();
      expect(sitemapEntry?.priority).toBe(0.7);
      expect(sitemapEntry?.changeFrequency).toBe("weekly");
    });
  });
});
