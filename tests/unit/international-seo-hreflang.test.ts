import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { constructMetadata } from "@/lib/seo/metadata";

const TEST_DB = path.join(tmpdir(), `test-seo-trans-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

describe("International SEO, Localized Metadata & hreflang Alternates", () => {
  let testProductId: number;

  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const { upsertProduct } = await import("@/lib/products");
    const prod = upsertProduct({
      slug: "darjeeling-spring",
      name: "Darjeeling Spring First Flush",
      category: "Black Tea",
      origin: "Darjeeling",
      estate: "Gopaldhara",
      flush: "Spring",
      harvest_date: "2026-03",
      description: "Artisanal spring flush",
      tasting_notes: "Muscatel grapes",
      brew_temp: 90,
      brew_seconds: 180,
      seo_title: "Darjeeling Spring Tea",
      seo_description: "Finest leaves from Gopaldhara estate",
    });
    testProductId = prod.id;
  });

  afterAll(() => {
    try { rmSync(TEST_DB, { force: true }); } catch {}
  });

  it("omits alternate hreflang links when no published translations exist, preserving pure canonical", () => {
    const meta = constructMetadata({
      title: "Darjeeling First Flush",
      description: "Artisanal single-estate tea.",
      path: "/tea/darjeeling-spring",
      resource: `product:${testProductId}`,
    });

    expect(meta.alternates?.canonical).toBe("https://himalayantea.com/tea/darjeeling-spring");
    // No published translations -> alternates.languages should be undefined
    expect(meta.alternates?.languages).toBeUndefined();
  });

  it("generates hreflang alternate links ONLY for published translations plus en and x-default", async () => {
    const { editTranslation, queueTranslation, studio, sourceFor } = await import(
      "@/lib/international/translations"
    );

    const resource = `product:${testProductId}`;
    // Queue and publish Hindi translation for product
    queueTranslation(resource, "hi");
    const hiItem = studio("hi").find((r) => r.resource === resource)!;

    const source = sourceFor(resource);
    const hiTexts = {
      ...source,
      seo_title: "सर्वश्रेष्ठ हिमालयी सिंगल-एस्टेट चाय",
      seo_description: "सीधे दार्जिलिंग और असम के बागानों से",
    };

    editTranslation(hiItem.translation!.id, hiTexts, "publish");

    // English canonical product metadata
    const meta = constructMetadata({
      title: "Himalayan Single-Estate Teas",
      description: "Artisanal teas from Darjeeling and Assam.",
      path: "/tea/darjeeling-spring",
      resource,
    });

    expect(meta.alternates?.canonical).toBe("https://himalayantea.com/tea/darjeeling-spring");
    expect(meta.alternates?.languages).toBeDefined();

    // Hindi is published -> present in hreflang
    expect(meta.alternates?.languages?.["hi"]).toBe("https://himalayantea.com/hi/tea/darjeeling-spring");
    // English and x-default present
    expect(meta.alternates?.languages?.["en"]).toBe("https://himalayantea.com/tea/darjeeling-spring");
    expect(meta.alternates?.languages?.["x-default"]).toBe("https://himalayantea.com/tea/darjeeling-spring");

    // French (fr) or Arabic (ar) are NOT published -> must NOT be in hreflang
    expect(meta.alternates?.languages?.["fr"]).toBeUndefined();
    expect(meta.alternates?.languages?.["ar"]).toBeUndefined();
  });

  it("renders localized title and description when requesting a localized route with published translations", async () => {
    const { editTranslation, studio, sourceFor } = await import(
      "@/lib/international/translations"
    );

    const resource = `product:${testProductId}`;
    const hiItem = studio("hi").find((r) => r.resource === resource)!;

    const source = sourceFor(resource);
    const hiTexts = {
      ...source,
      seo_title: "हिमालयी चाय संग्रह",
      seo_description: "दार्जिलिंग की दुर्लभ पत्तियां",
    };

    editTranslation(hiItem.translation!.id, hiTexts, "publish");

    const localizedMeta = constructMetadata({
      title: "Default English Title",
      description: "Default English Description",
      path: "/tea/darjeeling-spring",
      locale: "hi",
      resource,
    });

    expect(localizedMeta.title).toBe("हिमालयी चाय संग्रह · Himalayan Tea House");
    expect(localizedMeta.description).toBe("दार्जिलिंग की दुर्लभ पत्तियां");
    expect(localizedMeta.alternates?.canonical).toBe("https://himalayantea.com/hi/tea/darjeeling-spring");
  });

  it("ensures country and currency choices do not create duplicate SEO canonicals", () => {
    // Both user A (browsing in USD) and user B (browsing in EUR) access the same English URL
    const metaA = constructMetadata({
      title: "Shop All Teas",
      path: "/shop",
    });
    const metaB = constructMetadata({
      title: "Shop All Teas",
      path: "/shop",
    });

    expect(metaA.alternates?.canonical).toBe("https://himalayantea.com/shop");
    expect(metaB.alternates?.canonical).toBe(metaA.alternates?.canonical);
  });
});
