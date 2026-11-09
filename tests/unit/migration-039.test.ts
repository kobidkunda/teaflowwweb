import { describe, it, expect } from "vitest";
import { getDb } from "@/lib/db";
import { publicMarkets, packageConfig } from "@/lib/international/store";
import { packageSchema } from "@/lib/international/models";

describe("Database Migration 039 — India Market Activation & Package Configuration", () => {
  it("has valid package configuration in commerce_config with origin and maxGrams", () => {
    const db = getDb();
    const pkgRow = db.prepare("SELECT document FROM commerce_config WHERE key = 'package'").get() as { document: string } | undefined;
    expect(pkgRow).toBeDefined();
    const pkg = JSON.parse(pkgRow!.document);
    expect(pkg.origin).toBe("IN");
    expect(pkg.maxGrams).toBeGreaterThan(0);

    const parsed = packageConfig();
    expect(parsed).not.toBeNull();
    expect(parsed?.origin).toBe("IN");
    expect(packageSchema.safeParse(pkg).success).toBe(true);
  });

  it("activates and approves India (IN) market for customer checkout", async () => {
    process.env.ORDER_ACCESS_SECRET = "test-secret-12345";
    process.env.SHIPROCKET_EMAIL = "test@teafloww.com";
    process.env.SHIPROCKET_PASSWORD = "test_password";

    const db = getDb();
    const inRow = db.prepare("SELECT document FROM commerce_markets WHERE code = 'IN'").get() as { document: string } | undefined;
    expect(inRow).toBeDefined();
    const doc = JSON.parse(inRow!.document);
    expect(doc.covered).toBe(true);
    expect(doc.enabled).toBe(true);
    expect(doc.taxApproved).toBe(true);
    expect(doc.currency).toBe("INR");

    const markets = publicMarkets();
    const india = markets.find((m) => m.code === "IN");
    expect(india).toBeDefined();
    expect(india?.available).toBe(true);
  });
});
