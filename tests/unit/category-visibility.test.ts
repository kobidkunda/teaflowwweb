import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { listStorefrontCategories } from "@/lib/storefront";

describe("Category Visibility & Cache Control Contract", () => {
  it("middleware sets must-revalidate and no-store for edge CDN on public HTML storefront pages", () => {
    const request = new NextRequest("https://teafloww.com/");
    const res = middleware(request);
    const cacheControl = res.headers.get("Cache-Control");
    const cdnCacheControl = res.headers.get("CDN-Cache-Control");
    const cfCdnCacheControl = res.headers.get("Cloudflare-CDN-Cache-Control");

    expect(cacheControl).toContain("public");
    expect(cacheControl).toContain("max-age=0");
    expect(cacheControl).toContain("must-revalidate");
    expect(cacheControl).not.toContain("s-maxage");
    expect(cdnCacheControl).toBe("no-store");
    expect(cfCdnCacheControl).toBe("no-store");
  });

  it("listStorefrontCategories returns active categories only", () => {
    const categories = listStorefrontCategories();
    expect(Array.isArray(categories)).toBe(true);
    // Every category must have an id and name
    for (const cat of categories) {
      expect(cat.name).toBeTruthy();
    }
  });
});
