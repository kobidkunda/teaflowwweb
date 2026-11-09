import { describe, it, expect } from "vitest";
import { SECURITY_HEADERS } from "@/lib/security";
import nextConfig from "../../next.config";
import { getCatalogSitemapEntries } from "@/lib/seo/sitemap";
import { getBlogPost } from "@/lib/blogs";

describe("Blog Routes and CSP Integration", () => {
  describe("Content Security Policy (CSP)", () => {
    it("allows Google Tag Manager script domain in script-src", () => {
      const csp = SECURITY_HEADERS["Content-Security-Policy"];
      expect(csp).toBeDefined();
      expect(csp).toContain("https://www.googletagmanager.com");
      expect(csp).toContain("https://connect.facebook.net");
    });

    it("allows Google Tag Manager and Analytics domains in connect-src", () => {
      const csp = SECURITY_HEADERS["Content-Security-Policy"];
      expect(csp).toMatch(/connect-src[^;]*https:\/\/www\.google-analytics\.com/);
      expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.google-analytics\.com/);
      expect(csp).toMatch(/connect-src[^;]*https:\/\/\*\.googletagmanager\.com/);
      expect(csp).toMatch(/connect-src[^;]*https:\/\/connect\.facebook\.net/);
      expect(csp).toMatch(/connect-src[^;]*https:\/\/www\.facebook\.com/);
    });

    it("allows Google Tag Manager in frame-src", () => {
      const csp = SECURITY_HEADERS["Content-Security-Policy"];
      expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.googletagmanager\.com/);
    });

    it("allows YouTube and YouTube-nocookie in frame-src for video story embeds", () => {
      const csp = SECURITY_HEADERS["Content-Security-Policy"];
      expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.youtube\.com/);
      expect(csp).toMatch(/frame-src[^;]*https:\/\/www\.youtube-nocookie\.com/);
    });
  });

  describe("Next.js Redirects", () => {
    it("redirects legacy /learn and /learn/:slug to /blog and /blog/:slug", async () => {
      if (typeof nextConfig.redirects !== "function") {
        throw new Error("nextConfig.redirects must be defined as an async function");
      }
      const redirects = await nextConfig.redirects();
      expect(redirects).toBeDefined();

      const learnRedirect = redirects.find((r) => r.source === "/learn");
      expect(learnRedirect).toBeDefined();
      expect(learnRedirect?.destination).toBe("/blog");
      expect(learnRedirect?.permanent).toBe(true);

      const learnSlugRedirect = redirects.find((r) => r.source === "/learn/:slug");
      expect(learnSlugRedirect).toBeDefined();
      expect(learnSlugRedirect?.destination).toBe("/blog/:slug");
      expect(learnSlugRedirect?.permanent).toBe(true);
    });
  });

  describe("Sitemap & Blog Metadata", () => {
    it("includes /blog and published article slugs in sitemap", () => {
      const sitemap = getCatalogSitemapEntries();
      const urls = sitemap.map((entry) => entry.url);

      expect(urls).toContain("https://himalayantea.com/blog");
      // Must not contain the redirecting /learn URL
      expect(urls).not.toContain("https://himalayantea.com/learn");

      // Verify that known blog posts exist and can be fetched
      const sample = getBlogPost("gondhoraj-lebu-cha-guide");
      if (sample && sample.status === "published") {
        expect(urls).toContain("https://himalayantea.com/blog/gondhoraj-lebu-cha-guide");
      }
    });

    it("fetches articles required by storefront navigation and footer", () => {
      const requiredSlugs = [
        "gondhoraj-lebu-cha-guide",
        "about-teafloww",
        "frequently-asked-tea-questions",
      ];

      for (const slug of requiredSlugs) {
        const article = getBlogPost(slug);
        expect(article).not.toBeNull();
        expect(article?.slug).toBe(slug);
        expect(article?.status).toBe("published");
        expect(article?.title.length).toBeGreaterThan(0);
        expect(article?.content.length).toBeGreaterThan(0);
      }
    });
  });
});
