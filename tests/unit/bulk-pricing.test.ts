import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { POST as productsPOST } from "@/app/api/admin/products/route";
import { GET as templateGET } from "@/app/api/admin/bulk-pricing/template/route";
import { POST as previewPOST } from "@/app/api/admin/bulk-pricing/preview/route";
import { POST as applyPOST } from "@/app/api/admin/bulk-pricing/apply/route";
import {
  parseCsv,
  buildBulkPricingCsv,
  previewBulkPricingFromRows,
  getBulkPricingDataset,
  type BulkPricingDatasetRow,
  type BulkChange,
} from "@/lib/bulkPricing";
import { getVariant as getVariantFromProducts } from "@/lib/products";

const FIXTURE: BulkPricingDatasetRow[] = [
  {
    variant_id: 1,
    sku: "TEST-A-100G",
    product_name: "Test, Estate \"Reserve\"",
    product_slug: "test-reserve",
    grams: 100,
    packaging_format: "loose_leaf_pouch",
    price_paise: 19900,
    compare_at_price_paise: 24900,
    stock: 20,
  },
  {
    variant_id: 2,
    sku: "TEST-B-50G",
    product_name: "Plain Leaf",
    product_slug: "plain-leaf",
    grams: 50,
    packaging_format: "luxury_tin",
    price_paise: 9900,
    compare_at_price_paise: null,
    stock: 5,
  },
];

const HEADER =
  "variant_id,sku,product_name,product_slug,grams,packaging_format,price_inr,mrp_inr,discount_percent,stock,gst_rate_percent,gst_amount_inr";

function row(cells: (string | number)[]): string {
  return cells.join(",");
}

describe("bulk pricing CSV primitives", () => {
  it("parses quoted commas, doubled quotes, CRLF and BOM", () => {
    const csv =
      `\uFEFFvariant_id,sku,product_name,price_inr,stock\r\n1,"TEST-A-100G","Test, Estate ""Reserve""",199,20\r\n2,TEST-B-50G,Plain,99.50,5\r\n`;
    expect(parseCsv(csv)).toEqual([
      ["variant_id", "sku", "product_name", "price_inr", "stock"],
      ["1", "TEST-A-100G", 'Test, Estate "Reserve"', "199", "20"],
      ["2", "TEST-B-50G", "Plain", "99.50", "5"],
    ]);
  });

  it("skips blank lines and tolerates a missing final newline", () => {
    expect(parseCsv("a,b\n1,2\n\n3,4")).toEqual([
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("builds a template with header, escaping and discount math", () => {
    const csv = buildBulkPricingCsv(FIXTURE, 5);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe(HEADER);
    // Comma + quotes in the product name are RFC 4180 escaped.
    expect(lines[1]).toContain('"Test, Estate ""Reserve"""');
    // discount_percent: (249-199)/249 = 20%; gst breakout present.
    expect(lines[1].split(",")).toContain("20");
    expect(lines[2].split(",")[7]).toBe(""); // empty MRP clears discount
    expect(csv.endsWith("\r\n")).toBe(true);
  });
});

describe("bulk pricing preview validation", () => {
  it("accepts valid price, MRP-clear and stock edits; flags unchanged rows", () => {
    const csv = [
      HEADER,
      row([1, "TEST-A-100G", "Test", "test-reserve", 100, "loose_leaf_pouch", 179, 249, 28, 20, 5, 8.52]),
      row([2, "TEST-B-50G", "Plain", "plain-leaf", 50, "luxury_tin", 99, "", 0, 5, 5, 4.71]),
    ].join("\n");
    const p = previewBulkPricingFromRows(FIXTURE, csv, 5);
    expect(p.errorCount).toBe(0);
    expect(p.changeCount).toBe(1);
    expect(p.unchangedCount).toBe(1);
    expect(p.changes[0].variant_id).toBe(1);
    expect(p.changes[0].fields).toEqual(["price_inr"]);
    expect(p.changes[0].newPricePaise).toBe(17900);
  });

  it("clears MRP when mrp_inr is empty and warns about badge removal", () => {
    const csv = [HEADER, row([1, "TEST-A-100G", "x", "y", 100, "loose_leaf_pouch", 199, "", 0, 20, 5, 9.48])].join("\n");
    const p = previewBulkPricingFromRows(FIXTURE, csv, 5);
    expect(p.errorCount).toBe(0);
    expect(p.changes[0].newMrpPaise).toBeNull();
    expect(p.changes[0].warnings.some((w) => w.includes("discount badge"))).toBe(true);
  });

  it("leaves MRP untouched when the mrp_inr column is absent", () => {
    const csv = ["variant_id,sku,price_inr,stock", row([1, "TEST-A-100G", 199, 20])].join("\n");
    const p = previewBulkPricingFromRows(FIXTURE, csv, 5);
    expect(p.errorCount).toBe(0);
    expect(p.changeCount).toBe(0);
    expect(p.unchangedCount).toBe(1);
  });

  it("accepts ₹ symbols, commas and Rs. prefixes in money fields", () => {
    const csv = [HEADER, row([1, '"TEST-A-100G"', "x", "y", 100, "loose_leaf_pouch", '"₹1,179.50"', 249, 0, 20, 5, 0])].join("\n");
    // MRP 249 < price 1179.50 → MRP error expected; rebuild with consistent MRP
    const fixed = [HEADER, row([1, "TEST-A-100G", "x", "y", 100, "loose_leaf_pouch", '"₹1,179.50"', '"Rs. 1,499"', 0, 20, 5, 0])].join("\n");
    expect(parseCsv(csv)[1][6]).toBe("₹1,179.50");
    const p = previewBulkPricingFromRows(FIXTURE, fixed, 5);
    expect(p.errorCount).toBe(0);
    expect(p.changes[0].newPricePaise).toBe(117950);
    expect(p.changes[0].newMrpPaise).toBe(149900);
  });

  it("rejects unknown ids, SKU mismatches, duplicates and bad ids", () => {
    const csv = [
      HEADER,
      row([999, "NOPE-1", "x", "y", 100, "loose_leaf_pouch", 199, "", 0, 1, 5, 0]),
      row([1, "WRONG-SKU", "x", "y", 100, "loose_leaf_pouch", 199, "", 0, 1, 5, 0]),
      row([1, "TEST-A-100G", "x", "y", 100, "loose_leaf_pouch", 199, "", 0, 1, 5, 0]),
      row([1, "TEST-A-100G", "x", "y", 100, "loose_leaf_pouch", 199, "", 0, 1, 5, 0]),
      row(["abc", "TEST-A-100G", "x", "y", 100, "loose_leaf_pouch", 199, "", 0, 1, 5, 0]),
    ].join("\n");
    const p = previewBulkPricingFromRows(FIXTURE, csv, 5);
    expect(p.errorCount).toBe(4);
    expect(p.errors.map((e) => e.field)).toEqual(["variant_id", "sku", "variant_id", "variant_id"]);
    // The third row is well-formed (MRP cleared + stock changed) so it previews as a change.
    expect(p.changeCount).toBe(1);
    expect(p.changes[0].variant_id).toBe(1);
  });

  it("rejects bad prices, MRP below price, and bad stock per field", () => {
    const cases: Array<{ price: string; mrp: string; stock: string; field: string }> = [
      { price: "-5", mrp: "", stock: "1", field: "price_inr" },
      { price: "19.999", mrp: "", stock: "1", field: "price_inr" },
      { price: "0", mrp: "", stock: "1", field: "price_inr" },
      { price: "199", mrp: "100", stock: "1", field: "mrp_inr" },
      { price: "199", mrp: "abc", stock: "1", field: "mrp_inr" },
      { price: "199", mrp: "", stock: "2.5", field: "stock" },
      { price: "199", mrp: "", stock: "-1", field: "stock" },
      { price: "199", mrp: "", stock: "", field: "stock" },
    ];
    for (const c of cases) {
      const csv = [HEADER, row([2, "TEST-B-50G", "x", "y", 50, "luxury_tin", c.price, c.mrp, 0, c.stock, 5, 0])].join("\n");
      const p = previewBulkPricingFromRows(FIXTURE, csv, 5);
      expect(p.errorCount).toBe(1);
      expect(p.errors[0].field).toBe(c.field);
      expect(p.errors[0].row).toBe(2);
    }
  });

  it("flags steep moves: price crash, deep discount, stock-out", () => {
    const csv = [HEADER, row([1, "TEST-A-100G", "x", "y", 100, "loose_leaf_pouch", 99, 499, 80, 0, 5, 0])].join("\n");
    const p = previewBulkPricingFromRows(FIXTURE, csv, 5);
    expect(p.errorCount).toBe(0);
    const w = p.changes[0].warnings.join(" ");
    expect(w).toContain("drops 50%");
    expect(w).toContain("Deep discount of 80%");
    expect(w).toContain("out of stock");
  });

  it("reports missing headers, empty files and header-only files", () => {
    const noHeader = previewBulkPricingFromRows(FIXTURE, "sku,price_inr\nTEST-A-100G,199\n", 5);
    expect(noHeader.errorCount).toBeGreaterThan(0);
    expect(noHeader.errors.some((e) => e.field === "variant_id")).toBe(true);

    expect(previewBulkPricingFromRows(FIXTURE, "   \n", 5).errorCount).toBe(1);
    expect(previewBulkPricingFromRows(FIXTURE, `${HEADER}\n`, 5).errors[0].field).toBe("file");
  });

  it("tolerates reordered, upper-case and extra columns", () => {
    const csv = ["SKU,STOCK,VARIANT_ID,PRICE_INR,notes", "TEST-B-50G,7,2,109.50,hello"].join("\n");
    const p = previewBulkPricingFromRows(FIXTURE, csv, 5);
    expect(p.errorCount).toBe(0);
    expect(p.changeCount).toBe(1);
    expect(p.changes[0].newPricePaise).toBe(10950);
    expect(p.changes[0].newStock).toBe(7);
  });
});

describe("bulk pricing API routes", () => {
  let env: TestEnv;
  let authCookie: string;
  let variantA = 0;
  let variantB = 0;

  beforeAll(async () => {
    env = setupAdminTestEnv();
    authCookie = getAuthCookie(env.db, "root");

    const payload = {
      slug: "bulk-pricing-test-lot",
      name: "Bulk Pricing Test Lot",
      origin: "Darjeeling, India",
      estate: "Test Estate",
      flush: "First Flush",
      harvest_date: "March 2026",
      description: "Seed lot for bulk pricing CSV tests.",
      tasting_notes: "Bright, floral.",
      brew_temp: 90,
      brew_seconds: 180,
      variants: [
        { sku: "BULK-A-100G", packaging_format: "loose_leaf_pouch", grams: 100, price_paise: 19900, stock: 20, servings: 40 },
        { sku: "BULK-B-50G", packaging_format: "luxury_tin", grams: 50, price_paise: 9900, stock: 5, servings: 20 },
      ],
    };
    const req = new Request("http://localhost/api/admin/products", {
      method: "POST",
      headers: { Cookie: authCookie, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const res = await productsPOST(req);
    expect(res.status).toBe(201);

    const dataset = getBulkPricingDataset();
    const a = dataset.find((r) => r.sku === "BULK-A-100G");
    const b = dataset.find((r) => r.sku === "BULK-B-50G");
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    variantA = a!.variant_id;
    variantB = b!.variant_id;
  }, 60000);

  afterAll(() => {
    env.cleanup();
  });

  it("requires auth for the template download", async () => {
    const res = await templateGET(new Request("http://localhost/api/admin/bulk-pricing/template"));
    expect(res.status).toBe(401);
  });

  it("downloads a template containing the seeded SKUs", async () => {
    const res = await templateGET(
      new Request("http://localhost/api/admin/bulk-pricing/template", { headers: { Cookie: authCookie } })
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    const text = await res.text();
    expect(text).toContain("variant_id,sku,product_name");
    expect(text).toContain("BULK-A-100G");
    expect(text).toContain("BULK-B-50G");
  });

  it("rejects preview without auth and without a file", async () => {
    const noAuth = await previewPOST(new Request("http://localhost/api/admin/bulk-pricing/preview", { method: "POST" }));
    expect(noAuth.status).toBe(401);

    const noFile = await previewPOST(
      new Request("http://localhost/api/admin/bulk-pricing/preview", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(noFile.status).toBe(400);
  });

  it("previews real changes end to end, then applies them live", async () => {
    const live = getBulkPricingDataset();
    const a = live.find((r) => r.sku === "BULK-A-100G")!;
    expect(a.price_paise).toBe(19900);

    const csv = [
      HEADER,
      `${variantA},BULK-A-100G,"Bulk Pricing Test Lot",bulk-pricing-test-lot,100,loose_leaf_pouch,219,249,12,18,5,10.43`,
      `${variantB},BULK-B-50G,"Bulk Pricing Test Lot",bulk-pricing-test-lot,50,luxury_tin,99,,0,5,5,4.71`,
    ].join("\n");

    const prevRes = await previewPOST(
      new Request("http://localhost/api/admin/bulk-pricing/preview", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      })
    );
    expect(prevRes.status).toBe(200);
    const prevData = (await prevRes.json()) as { preview: { errorCount: number; changeCount: number; changes: BulkChange[] } };
    expect(prevData.preview.errorCount).toBe(0);
    expect(prevData.preview.changeCount).toBe(1);
    expect(prevData.preview.changes[0].newPricePaise).toBe(21900);

    // Live value untouched by preview.
    expect(getVariantFromProducts(variantA)!.price_paise).toBe(19900);

    const key = crypto.randomUUID();
    const applyRes = await applyPOST(
      new Request("http://localhost/api/admin/bulk-pricing/apply", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [{ variant_id: variantA, price_paise: 21900, compare_at_price_paise: 24900, stock: 18 }],
          idempotencyKey: key,
        }),
      })
    );
    expect(applyRes.status).toBe(201);
    expect(getVariantFromProducts(variantA)!.price_paise).toBe(21900);
    expect(getVariantFromProducts(variantA)!.compare_at_price_paise).toBe(24900);
    expect(getVariantFromProducts(variantA)!.stock).toBe(18);

    // Replay with the same key is deduped, not re-applied.
    const replay = await applyPOST(
      new Request("http://localhost/api/admin/bulk-pricing/apply", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [{ variant_id: variantA, price_paise: 21900, compare_at_price_paise: 24900, stock: 18 }],
          idempotencyKey: key,
        }),
      })
    );
    expect(replay.status).toBe(200);
    expect(((await replay.json()) as { deduped: boolean }).deduped).toBe(true);
  });

  it("refuses invalid apply payloads and unknown variants without partial writes", async () => {
    const before = getVariantFromProducts(variantB)!;

    const badMrp = await applyPOST(
      new Request("http://localhost/api/admin/bulk-pricing/apply", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ rows: [{ variant_id: variantB, price_paise: 20000, compare_at_price_paise: 10000, stock: 5 }] }),
      })
    );
    expect(badMrp.status).toBe(400);

    const unknown = await applyPOST(
      new Request("http://localhost/api/admin/bulk-pricing/apply", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [
            { variant_id: variantB, price_paise: 9900, compare_at_price_paise: null, stock: 5 },
            { variant_id: 987654321, price_paise: 100, compare_at_price_paise: null, stock: 1 },
          ],
        }),
      })
    );
    expect(unknown.status).toBe(409);
    // All-or-nothing: the valid row in the same batch was not applied either.
    const after = getVariantFromProducts(variantB)!;
    expect(after.price_paise).toBe(before.price_paise);
    expect(after.stock).toBe(before.stock);
  });

  it("verifies multipart file uploads (the admin UI path)", async () => {
    const live = getBulkPricingDataset();
    const a = live.find((r) => r.sku === "BULK-A-100G")!;
    const csv = [
      HEADER,
      `${a.variant_id},BULK-A-100G,"Bulk Pricing Test Lot",bulk-pricing-test-lot,100,loose_leaf_pouch,${(a.price_paise / 100).toString()},,,${a.stock},5,0`,
    ].join("\n");
    const form = new FormData();
    form.append("file", new File([csv], "prices.csv", { type: "text/csv" }));
    const res = await previewPOST(
      new Request("http://localhost/api/admin/bulk-pricing/preview", {
        method: "POST",
        headers: { Cookie: authCookie },
        body: form,
      })
    );
    expect(res.status).toBe(200);
    const data = (await res.json()) as { preview: { errorCount: number } };
    expect(data.preview.errorCount).toBe(0);
  });

  it("round-trips template → preview with zero spurious changes", async () => {
    const tplRes = await templateGET(
      new Request("http://localhost/api/admin/bulk-pricing/template", { headers: { Cookie: authCookie } })
    );
    const csv = await tplRes.text();
    const prevRes = await previewPOST(
      new Request("http://localhost/api/admin/bulk-pricing/preview", {
        method: "POST",
        headers: { Cookie: authCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ csv }),
      })
    );
    const data = (await prevRes.json()) as { preview: { errorCount: number; changeCount: number } };
    expect(data.preview.errorCount).toBe(0);
    expect(data.preview.changeCount).toBe(0);
  });
});
