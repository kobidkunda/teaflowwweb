import { describe, it, expect } from "vitest";
import { wrapRow, normalizeSql } from "@/lib/postgresDriver";

describe("PostgreSQL Driver SQL normalization and Row Proxy", () => {
  it("normalizes mixed-case aliases in SELECT statements with quotes", () => {
    const input = "SELECT v.id AS variantId, v.price_paise AS pricePaise FROM variants v";
    const normalized = normalizeSql(input);
    expect(normalized).toContain('AS "variantId"');
    expect(normalized).toContain('AS "pricePaise"');
  });

  it("does not quote SQL types or keywords like AS TEXT or AS INTEGER", () => {
    const input = "SELECT CAST(v.id AS TEXT) AS itemId, CAST(grams / 2 AS INTEGER) FROM variants v";
    const normalized = normalizeSql(input);
    expect(normalized).toContain("AS TEXT");
    expect(normalized).toContain("AS INTEGER");
    expect(normalized).toContain('AS "itemId"');
  });

  it("does not re-quote already quoted aliases", () => {
    const input = 'SELECT v.id AS "variantId" FROM variants v';
    const normalized = normalizeSql(input);
    expect(normalized).toContain('AS "variantId"');
    expect(normalized).not.toContain('AS ""variantId""');
  });

  it("wraps rows to allow case-insensitive and camelCase property access", () => {
    const pgRow = {
      variantid: 196,
      pricepaise: 3000,
      grams: 100,
      sku: "TFW-007-100G",
    };
    const wrapped = wrapRow(pgRow) as Record<string, any>;

    // Direct property access in original casing
    expect(wrapped.variantid).toBe(196);
    expect(wrapped.pricepaise).toBe(3000);

    // camelCase access
    expect(wrapped.variantId).toBe(196);
    expect(wrapped.pricePaise).toBe(3000);

    // 'in' operator check
    expect("variantId" in wrapped).toBe(true);
    expect("pricePaise" in wrapped).toBe(true);

    // Object destructuring
    const { variantId, pricePaise } = wrapped;
    expect(variantId).toBe(196);
    expect(pricePaise).toBe(3000);
  });
});
