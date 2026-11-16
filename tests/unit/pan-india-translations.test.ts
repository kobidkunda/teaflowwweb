import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { LANGUAGES, localeSchema } from "@/lib/international/models";
import {
  PAN_INDIA_ITEMS,
  getLocaleDictionary,
  type SupportedLocale,
} from "@/lib/international/panIndiaDictionary";
import {
  publishedTexts,
  enabledLanguages,
  validateTexts,
} from "@/lib/international/translations";

const TEST_DB = path.join(tmpdir(), `test-pan-india-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

describe("Pan-India Multilingual Storefront System", () => {
  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });
    execFileSync(process.execPath, ["scripts/seed-pan-india-translations.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const { getDb } = await import("@/lib/db");
    getDb();
  });

  afterAll(() => {
    try { rmSync(TEST_DB, { force: true }); } catch {}
  });
  it("includes all requested Pan-India languages in models and localeSchema", () => {
    const requiredCodes = ["en", "hi", "bn", "pa", "mr", "gu", "ta", "te"];
    for (const code of requiredCodes) {
      expect(LANGUAGES.some((l) => l.code === code)).toBe(true);
      expect(localeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("provides comprehensive translations in PAN_INDIA_ITEMS for each Pan-India language", () => {
    const locales: SupportedLocale[] = ["hi", "bn", "pa", "mr", "gu", "ta", "te"];
    expect(PAN_INDIA_ITEMS.length).toBeGreaterThanOrEqual(30);

    for (const locale of locales) {
      const dict = getLocaleDictionary(locale);
      expect(Object.keys(dict).length).toBeGreaterThan(0);

      // Verify essential phrases exist in each language
      expect(dict["nav_shop"]).toBeTruthy();
      expect(dict["bag"]).toBeTruthy();
      expect(dict["checkout"]).toBeTruthy();
      expect(dict["subtotal"]).toBeTruthy();
      expect(dict["add_to_cart"]).toBeTruthy();
    }
  });

  it("correctly translates Pan-India languages via publishedTexts('interface', locale)", () => {
    // English should return null (storefront default)
    expect(publishedTexts("interface", "en")).toBeNull();

    // Hindi
    const hiTexts = publishedTexts("interface", "hi");
    expect(hiTexts).not.toBeNull();
    expect(hiTexts?.["nav_shop"]).toBe("चाय खरीदें");
    expect(hiTexts?.["bag"]).toBe("शॉपिंग बैग");
    expect(hiTexts?.["add_to_cart"]).toBe("बैग में जोड़ें");

    // Bengali (Siliguri Origin)
    const bnTexts = publishedTexts("interface", "bn");
    expect(bnTexts).not.toBeNull();
    expect(bnTexts?.["nav_shop"]).toBe("চা কিনুন");
    expect(bnTexts?.["bag"]).toBe("শপিং ব্যাগ");

    // Punjabi (Gurmukhi)
    const paTexts = publishedTexts("interface", "pa");
    expect(paTexts).not.toBeNull();
    expect(paTexts?.["nav_shop"]).toBe("ਚਾਹ ਖਰੀਦੋ");
    expect(paTexts?.["bag"]).toBe("ਖਰੀਦਦਾਰੀ ਬੈਗ");

    // Marathi
    const mrTexts = publishedTexts("interface", "mr");
    expect(mrTexts).not.toBeNull();
    expect(mrTexts?.["nav_shop"]).toBe("चहा खरेदी करा");

    // Gujarati
    const guTexts = publishedTexts("interface", "gu");
    expect(guTexts).not.toBeNull();
    expect(guTexts?.["nav_shop"]).toBe("ચા ખરીદો");

    // Tamil
    const taTexts = publishedTexts("interface", "ta");
    expect(taTexts).not.toBeNull();
    expect(taTexts?.["nav_shop"]).toBe("தேநீர் வாங்கவும்");

    // Telugu
    const teTexts = publishedTexts("interface", "te");
    expect(teTexts).not.toBeNull();
    expect(teTexts?.["nav_shop"]).toBe("టీ కొనండి");
  });

  it("enables all Pan-India languages in enabledLanguages()", () => {
    const enabled = enabledLanguages().map((l) => l.code);
    expect(enabled).toContain("en");
    expect(enabled).toContain("hi");
    expect(enabled).toContain("bn");
    expect(enabled).toContain("pa");
    expect(enabled).toContain("mr");
    expect(enabled).toContain("gu");
    expect(enabled).toContain("ta");
    expect(enabled).toContain("te");
  });

  it("supports partial translation dictionaries in validateTexts without throwing", () => {
    const source = {
      nav_shop: "Shop Tea",
      nav_leaf: "Leaf to Cup",
      bag: "Bag",
    };

    // Partial output with only 1 translated key
    const partialOutput = {
      nav_shop: "चाय खरीदें",
    };

    // When allowPartial is true, it should validate successfully
    const validated = validateTexts(source, partialOutput, true);
    expect(validated.nav_shop).toBe("चाय खरीदें");
  });

  it("rejects malicious markup in translations", () => {
    const source = { test: "Hello" };
    expect(() => {
      validateTexts(source, { test: "<script>alert(1)</script>" }, true);
    }).toThrowError(/unsupported markup/);
  });
});
