import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// The translator encodes honesty rules: proposed/trial/R&D content must never
// reach customer-facing fields. These tests pin those rules to the script.
describe("product package translator honesty contract", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pkg-translate-"));
  const inPath = path.join(dir, "in.json");
  const outPath = path.join(dir, "out.json");

  function translate(input: unknown) {
    fs.writeFileSync(inPath, JSON.stringify(input));
    execFileSync(process.execPath, ["scripts/translate-product-package.mjs", inPath, outPath], {
      cwd: process.cwd(),
      stdio: "pipe",
    });
    return JSON.parse(fs.readFileSync(outPath, "utf8")) as { products: Array<Record<string, unknown>> };
  }

  it("maps verified/requested facts and withholds proposed, trial and R&D content", () => {
    const out = translate({
      products: [
        {
          slug: "trial-tea",
          title: "Trial Tea",
          category_id: 75,
          publication_status_requested: "draft",
          featured_requested: false,
          ingredients_public: null,
          ingredients_RnD_only: [{ ingredient: "Secret X", percentage_draft: 3 }],
          editorial_markdown_draft: "Customer-ready story.",
          short_description: "A short line with no admin field.",
          tasting_notes_summary_proposed: "Intended flavour, not measured.",
          aroma_tags_proposed: ["guess"],
          sensory_ratings_verified: { floral: null },
          steeping_trial_only: { brew_temperature_C: 93, steep_time_seconds: 210 },
          provenance_verified: { origin_region: null },
          seo: { title: "Trial Tea | TeaFloww", description: "Shop trial tea." },
          variants_requested: [
            { sku: "T-100G", grams: 100, format: "loose_leaf_pouch", price_paise: 19900, compare_at_price_paise: null, stock: 0 },
          ],
        },
      ],
    });
    const p = out.products[0];
    // Included facts
    expect(p.name).toBe("Trial Tea");
    expect(p.category_id).toBe(75);
    expect(p.status).toBe("draft");
    expect(p.description).toBe("Customer-ready story.");
    expect(p.seo_title).toBe("Trial Tea | TeaFloww");
    expect(p.variants).toHaveLength(1);
    // Withheld content must not leak into ANY customer field
    const dumped = JSON.stringify(p);
    expect(dumped).not.toContain("Secret X");
    expect(dumped).not.toContain("Intended flavour");
    expect(dumped).not.toContain("guess");
    expect(dumped).not.toContain("short line");
    expect(p).not.toHaveProperty("tasting_notes");
    expect(p).not.toHaveProperty("aroma_tags");
    expect(p).not.toHaveProperty("brew_temp");
    expect(p).not.toHaveProperty("ingredients");
    expect(p).not.toHaveProperty("images");
  });

  it("maps MRP aliases and rupee prices on variants", () => {
    const out = translate({
      products: [
        {
          slug: "mrp-tea",
          title: "MRP Tea",
          variants_requested: [
            { sku: "M-100G", grams: 100, format: "luxury_tin", price_inr: 199, mrp_inr: 249, stock: 5 },
          ],
        },
      ],
    });
    expect(out.products[0].variants).toEqual([
      { sku: "M-100G", grams: 100, packaging_format: "luxury_tin", price_inr: 199, mrp_inr: 249, stock: 5 },
    ]);
  });
});
