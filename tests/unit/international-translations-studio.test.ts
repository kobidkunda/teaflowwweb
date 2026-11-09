import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";

const TEST_DB = path.join(tmpdir(), `test-trans-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

describe("Translation Studio, Validation & Content Safety", () => {
  let db: any;

  beforeAll(async () => {
    execFileSync(process.execPath, ["scripts/migrate.mjs"], {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_PATH: TEST_DB },
      stdio: "ignore",
    });

    const { getDb } = await import("@/lib/db");
    db = getDb();
  });

  afterAll(() => {
    try { rmSync(TEST_DB, { force: true }); } catch {}
  });

  it("extractTexts extracts approved editorial fields and ignores sensitive or non-approved fields", async () => {
    const { extractTexts } = await import("@/lib/international/translations");

    const sampleProduct = {
      id: 42,
      name: "Darjeeling First Flush",
      title: "Spring Delight",
      description: "Harvested from Gopaldhara estate at 6,500ft.",
      tasting_notes: "Muscatel grapes, sweet floral finish",
      price_paise: 95000, // Should NOT be extracted (sensitive/pricing)
      stock: 50, // Should NOT be extracted
      internal_notes: "Private vendor note", // Should NOT be extracted
      seo_title: "Buy Darjeeling Spring First Flush | TeaFloww",
    };

    const extracted = extractTexts(sampleProduct);

    expect(extracted["name"]).toBe("Darjeeling First Flush");
    expect(extracted["title"]).toBe("Spring Delight");
    expect(extracted["description"]).toBe("Harvested from Gopaldhara estate at 6,500ft.");
    expect(extracted["tasting_notes"]).toBe("Muscatel grapes, sweet floral finish");
    expect(extracted["seo_title"]).toBe("Buy Darjeeling Spring First Flush | TeaFloww");

    // Sensitive commerce fields excluded
    expect(extracted["price_paise"]).toBeUndefined();
    expect(extracted["stock"]).toBeUndefined();
    expect(extracted["internal_notes"]).toBeUndefined();
  });

  it("validateTexts strictly validates matching keys with source", async () => {
    const { validateTexts } = await import("@/lib/international/translations");

    const source = {
      headline: "Authentic Himalayan Teas",
      subheading: "Direct from single estates",
    };

    // Missing key
    expect(() =>
      validateTexts(source, {
        headline: "प्रामाणिक हिमालयी चाय",
      })
    ).toThrow("Translation fields do not match the source.");

    // Extra key
    expect(() =>
      validateTexts(source, {
        headline: "प्रामाणिक हिमालयी चाय",
        subheading: "सीधे सिंगल एस्टेट से",
        extra: "अतिरिक्त",
      })
    ).toThrow("Translation fields do not match the source.");
  });

  it("validateTexts rejects translations containing HTML tags or scripts", async () => {
    const { validateTexts } = await import("@/lib/international/translations");

    const source = {
      description: "Pure tea from the Himalayas.",
    };

    // Attempted XSS injection
    expect(() =>
      validateTexts(source, {
        description: "Pure tea <script>alert('xss')</script> from the Himalayas.",
      })
    ).toThrow("Translation contains unsupported markup.");

    expect(() =>
      validateTexts(source, {
        description: "Pure tea <b>bold</b> from the Himalayas.",
      })
    ).toThrow("Translation contains unsupported markup.");
  });

  it("validateTexts preserves protected tokens, numbers, URLs, placeholders, and brand names", async () => {
    const { validateTexts } = await import("@/lib/international/translations");

    const source = {
      body: "Experience TeaFloww at https://teafloww.com with 100% single-estate tea in {{pack_size}} from Nirva and SKU TFW-DARJ-01.",
    };

    // Model translates text while preserving protected tokens exactly:
    const validTarget = {
      body: "{{pack_size}} में 100% सिंगल-एस्टेट चाय का अनुभव TeaFloww पर https://teafloww.com पर करें, Nirva और SKU TFW-DARJ-01 से।",
    };
    expect(validateTexts(source, validTarget)).toEqual(validTarget);

    // If model changes brand name
    expect(() =>
      validateTexts(source, {
        body: "Experience GenericTea at https://teafloww.com with 100% single-estate tea in {{pack_size}} from Nirva and SKU TFW-DARJ-01.",
      })
    ).toThrow("Translation changed protected values or placeholders.");

    // If model drops URL
    expect(() =>
      validateTexts(source, {
        body: "Experience TeaFloww at website with 100% single-estate tea in {{pack_size}} from Nirva and SKU TFW-DARJ-01.",
      })
    ).toThrow("Translation changed protected values or placeholders.");

    // If model alters numbers
    expect(() =>
      validateTexts(source, {
        body: "Experience TeaFloww at https://teafloww.com with 50% single-estate tea in {{pack_size}} from Nirva and SKU TFW-DARJ-01.",
      })
    ).toThrow("Translation changed protected values or placeholders.");
  });

  it("tracks source hashes and detects stale translations when English changes", async () => {
    const { editTranslation, publishedTexts, queueTranslation, studio, sourceFor } = await import(
      "@/lib/international/translations"
    );

    // Queue and publish interface translations for Hindi
    queueTranslation("interface", "hi");
    const item = studio("hi").find((r) => r.resource === "interface")!;
    expect(item).toBeDefined();

    const source = sourceFor("interface");
    const translatedUi = {
      ...source,
      deliver: "डिलीवर करें",
      currency: "मुद्रा",
    };

    editTranslation(item.translation!.id, translatedUi, "publish");

    // Published texts are live
    const live = publishedTexts("interface", "hi");
    expect(live?.deliver).toBe("डिलीवर करें");

    // Simulate English source change (published_hash no longer matches hash(sourceFor(resource)))
    db.prepare("UPDATE commerce_translations SET published_hash='old_hash', source_hash='old_hash' WHERE resource='interface' AND locale='hi'").run();

    // publishedTexts safely returns null (falling back to English) when source hash has changed (stale)
    const staleCheck = publishedTexts("interface", "hi");
    expect(staleCheck).toBeNull();
  });

  it("preserves manual human edits and increments revision", async () => {
    const { queueTranslation, editTranslation, studio, sourceFor } = await import(
      "@/lib/international/translations"
    );

    queueTranslation("interface", "fr");
    const item = studio("fr").find((r) => r.resource === "interface")!;

    const revisionBefore = item.translation!.revision;
    const source = sourceFor("interface");

    editTranslation(item.translation!.id, source, "draft");

    const itemAfter = studio("fr").find((r) => r.resource === "interface")!;
    expect(itemAfter.translation!.revision).toBe(revisionBefore + 1);

    // Translation history table recorded the previous revision
    const historyCount = (
      db.prepare("SELECT COUNT(*) AS count FROM commerce_translation_history WHERE translation_id=?").get(
        item.translation!.id
      ) as any
    ).count;
    expect(historyCount).toBeGreaterThanOrEqual(1);
  });
});
