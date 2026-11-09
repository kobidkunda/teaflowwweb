import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { PublicTrackingConfig } from "@/lib/trackingSettings";

vi.mock("next/script", () => ({
  default: ({ strategy, ...props }: Record<string, unknown>) =>
    React.createElement("script", { ...props, "data-strategy": strategy }),
}));
import { AnalyticsHeadScripts } from "@/components/analytics/AnalyticsScripts";
import { GET as getCatalog } from "@/app/ai-catalog.json/route";
import { GET as getLegacyCatalog } from "@/app/.well-known/ai-catalog.json/route";
import { GET as getArdCatalog } from "@/app/.well-known/ard.json/route";

const config: PublicTrackingConfig = {
  gtmEnabled: true, gtmContainerId: "GTM-EXAMPLE", ga4Enabled: true,
  ga4MeasurementId: "G-EXAMPLE", metaPixelEnabled: false, metaPixelId: "",
  customHeadScript: "", customBodyScript: "",
};
const render = (overrides: Partial<PublicTrackingConfig> = {}) =>
  renderToStaticMarkup(React.createElement(AnalyticsHeadScripts, { config: { ...config, ...overrides } }));

describe("Google tracking ownership and late loading", () => {
  it("loads only the GTM owner when both Google integrations are enabled", () => {
    const html = render();
    expect(html).toContain("gtm.js?id=");
    expect(html).not.toContain("gtag/js");
    expect(html).toContain('data-strategy="lazyOnload"');
  });
  it("retains standalone GA4 when GTM is disabled or has no container", () => {
    for (const overrides of [{ gtmEnabled: false }, { gtmContainerId: "" }]) {
      expect(render(overrides)).toContain("gtag/js?id=G-EXAMPLE");
      expect(render(overrides)).not.toContain("gtm.js?id=");
    }
  });
  it("loads once after load without requestIdleCallback and preserves queued commerce", () => {
    const source = render().match(/<script[^>]*id="google-tag-manager"[^>]*>([\s\S]*?)<\/script>/)?.[1];
    expect(source).toBeTruthy();
    const queued = { event: "add_to_cart", ecommerce: { value: 199 } };
    const dataLayer = [queued];
    const inserted: Array<{ src?: string }> = [];
    const context = vm.createContext({
      window: { dataLayer },
      document: {
        createElement: () => ({}),
        getElementsByTagName: () => [{ parentNode: { insertBefore: (script: { src?: string }) => inserted.push(script) } }],
      },
    });
    vm.runInContext(source!, context);
    vm.runInContext(source!, context);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].src).toBe("https://www.googletagmanager.com/gtm.js?id=GTM-EXAMPLE");
    expect(dataLayer[0]).toBe(queued);
    expect(dataLayer).toHaveLength(2);
  });
});

// Required catalog shape from the ARD primary schema, checked without a
// network dependency. Lighthouse additionally validates the served response.
const entry = z.object({
  identifier: z.string().regex(/^urn:air:[a-zA-Z0-9.-]+(:[a-zA-Z0-9._-]+)+$/),
  displayName: z.string(), type: z.string(), url: z.url(), description: z.string().optional(),
  representativeQueries: z.array(z.string()).min(2).max(5),
}).strict();
const manifest = z.object({
  specVersion: z.literal("1.0"),
  host: z.object({ displayName: z.string(), documentationUrl: z.url().optional() }).strict(),
  entries: z.array(entry),
}).strict();

describe("agent catalog", () => {
  it("serves the same valid catalog from every discovery URL with security headers", async () => {
    const canonical = await getCatalog().json();
    for (const handler of [getCatalog, getLegacyCatalog, getArdCatalog]) {
      const response = handler();
      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("application/json");
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(manifest.parse(await response.json())).toEqual(canonical);
    }
  });
  it("publishes a versioned manifest with typed, uniquely identified resources", () => {
    const catalog = manifest.parse(JSON.parse(readFileSync("src/lib/seo/aiCatalog.json", "utf8")));
    expect(catalog.entries.length).toBeGreaterThan(0);
    expect(new Set(catalog.entries.map((item) => item.identifier)).size).toBe(catalog.entries.length);
    expect(catalog.entries.find((item) => item.type === "application/openapi+json")?.url)
      .toBe("https://teafloww.com/api/mcp/openapi");
  });
  it("rejects the former incompatible manifest", () => {
    expect(manifest.safeParse({ name: "TeaFloww", endpoints: [] }).success).toBe(false);
  });
});
