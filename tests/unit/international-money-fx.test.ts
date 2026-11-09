import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { currencyDigits, formatMoney, convertPaise } from "@/lib/international/money";
import { rateFor, Fx } from "@/lib/international/fx";
import { CommerceError } from "@/lib/international/models";

const TEST_DB = path.join(tmpdir(), `test-fx-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;

describe("International Money & FX Conversion", () => {
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

  beforeEach(() => {
    if (db) {
      db.prepare("DELETE FROM commerce_fx").run();
    }
  });

  describe("currencyDigits", () => {
    it("returns 0 for zero-decimal currencies like JPY", () => {
      expect(currencyDigits("JPY")).toBe(0);
    });

    it("returns 2 for standard currencies like USD, EUR, GBP, INR", () => {
      expect(currencyDigits("USD")).toBe(2);
      expect(currencyDigits("EUR")).toBe(2);
      expect(currencyDigits("GBP")).toBe(2);
      expect(currencyDigits("INR")).toBe(2);
    });

    it("returns 3 for three-decimal currencies like KWD and BHD", () => {
      expect(currencyDigits("KWD")).toBe(3);
      expect(currencyDigits("BHD")).toBe(3);
    });
  });

  describe("formatMoney", () => {
    it("formats minor units accurately according to currency digits and locale", () => {
      // 10000 paise (100 INR)
      expect(formatMoney(10000, "INR", "en-IN")).toContain("100");
      // 1550 cents ($15.50)
      expect(formatMoney(1550, "USD", "en-US")).toContain("15.50");
      // 2500 JPY (zero decimal places: 2500 JPY)
      expect(formatMoney(2500, "JPY", "ja-JP")).toContain("2,500");
      // 3500 fils (3.500 KWD)
      expect(formatMoney(3500, "KWD", "en")).toContain("3.500");
    });
  });

  describe("convertPaise exact rational arithmetic", () => {
    it("converts INR paise to USD minor cents without floating-point inaccuracy", () => {
      // 10,000 paise = 100 INR. Rate 0.012 USD/INR = $1.20 = 120 cents
      const cents = convertPaise(10000, "0.012", "USD");
      expect(cents).toBe(120);
    });

    it("converts INR paise to zero-decimal JPY minor units", () => {
      // 10,000 paise = 100 INR. Rate 1.825 JPY/INR = 182.5 JPY -> rounded to 183 JPY
      const yen = convertPaise(10000, "1.825", "JPY");
      expect(yen).toBe(183);
    });

    it("converts INR paise to three-decimal KWD minor units", () => {
      // 10,000 paise = 100 INR. Rate 0.00371 KWD/INR = 0.371 KWD = 371 fils
      const fils = convertPaise(10000, "0.00371", "KWD");
      expect(fils).toBe(371);
    });

    it("applies admin basis-points markup correctly", () => {
      // 10,000 paise = 100 INR. Base rate 0.012 -> 120 cents.
      // With 500 bps (5% markup): 120 * 1.05 = 126 cents
      const centsWithMarkup = convertPaise(10000, "0.012", "USD", 500);
      expect(centsWithMarkup).toBe(126);
    });

    it("applies custom rounding steps cleanly", () => {
      // Step 5: rounds to nearest multiple of 5
      const centsStep5 = convertPaise(10000, "0.01234", "USD", 0, 5);
      expect(centsStep5 % 5).toBe(0);
    });

    it("rejects invalid inputs defensively", () => {
      expect(() => convertPaise(-100, "0.012", "USD")).toThrow(CommerceError);
      expect(() => convertPaise(100, "invalid-rate", "USD")).toThrow(CommerceError);
      expect(() => convertPaise(100, "0.012", "USD", 0, 0)).toThrow(CommerceError);
      expect(() => convertPaise(100, "0.012", "USD", 0, -1)).toThrow(CommerceError);
      expect(() => convertPaise(Number.MAX_SAFE_INTEGER + 1, "0.012", "USD")).toThrow(CommerceError);
    });
  });

  describe("rateFor and freshness enforcement", () => {
    it("always returns rate 1 for INR without requiring FX snapshot", () => {
      const res = rateFor("INR", true);
      expect(res.rate).toBe("1");
      expect(res.id).toBeNull();
      expect(res.stale).toBe(false);
    });

    it("uses fresh rates when current time is before provider next update", async () => {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      const now = Date.now();
      const fxData: Fx = {
        id: "fx-test-1",
        rates: { USD: "0.012", EUR: "0.011" },
        updated: now - 3600000,
        next: now + 3600000, // Valid for next 1 hour
      };
      db.prepare("INSERT INTO commerce_fx (id, document, updated_ms, next_ms) VALUES (?, ?, ?, ?)").run(
        fxData.id,
        JSON.stringify(fxData),
        fxData.updated,
        fxData.next
      );

      const res = rateFor("USD", false);
      expect(res.rate).toBe("0.012");
      expect(res.stale).toBe(false);

      const payRes = rateFor("USD", true);
      expect(payRes.rate).toBe("0.012");
      expect(payRes.stale).toBe(false);
    });

    it("allows overdue rates for browsing estimates up to 48 hours, but flags stale=true", async () => {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      const now = Date.now();
      const fxData: Fx = {
        id: "fx-test-overdue",
        rates: { USD: "0.012" },
        updated: now - 10 * 3600000,
        next: now - 2 * 3600000, // Expired 2 hours ago (< 48 hours)
      };
      db.prepare("INSERT INTO commerce_fx (id, document, updated_ms, next_ms) VALUES (?, ?, ?, ?)").run(
        fxData.id,
        JSON.stringify(fxData),
        fxData.updated,
        fxData.next
      );

      // Browsing succeeds with stale=true
      const browseRes = rateFor("USD", false);
      expect(browseRes.rate).toBe("0.012");
      expect(browseRes.stale).toBe(true);

      // Payment strictly requires fresh rates (throws error)
      expect(() => rateFor("USD", true)).toThrow(CommerceError);
    });

    it("rejects browsing and payment when rates are older than 48 hours overdue", async () => {
      const { getDb } = await import("@/lib/db");
      const db = getDb();
      const now = Date.now();
      const fxData: Fx = {
        id: "fx-test-ancient",
        rates: { USD: "0.012" },
        updated: now - 60 * 3600000,
        next: now - 50 * 3600000, // Expired 50 hours ago (> 48h)
      };
      db.prepare("INSERT INTO commerce_fx (id, document, updated_ms, next_ms) VALUES (?, ?, ?, ?)").run(
        fxData.id,
        JSON.stringify(fxData),
        fxData.updated,
        fxData.next
      );

      expect(() => rateFor("USD", false)).toThrow(CommerceError);
      expect(() => rateFor("USD", true)).toThrow(CommerceError);
    });
  });
});
