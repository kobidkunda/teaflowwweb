import { describe, it, expect, beforeAll } from "vitest";
import Database from "better-sqlite3";
import { execFileSync } from "node:child_process";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
// Isolated temp DB migrated fresh: services read DATABASE_PATH lazily via getDb().
const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "admin-test-")), "test.sqlite");
process.env.DATABASE_PATH = tmp;
process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef";
process.env.ADMIN_USERNAME = "root";
process.env.MCP_TOKEN = "test-mcp-token";
const { hashPassword } = await import("../../src/lib/password");
process.env.ADMIN_PASSWORD_HASH = hashPassword("test-root-password-123");
const { quoteCoupon } = await import("../../src/lib/coupons");
const { setDispatchStatus, getOrder, OrderTransitionError } = await import("../../src/lib/orders");
const { applyWebhook, recordPaymentIntent } = await import("../../src/lib/payments");
const { couponSchema, variantSchema, dispatchSchema, loginSchema, createUserSchema } = await import("../../src/lib/validation");
const { isAdminRequest } = await import("../../src/lib/adminAuth");
const { guard } = await import("../../src/lib/adminHttp");
const { POST: loginPOST } = await import("../../src/app/api/admin/login/route");
const { resetRateLimits } = await import("../../src/lib/rateLimit");
beforeAll(async () => {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: tmp },
    stdio: "ignore",
  });
  const db = new Database(tmp);
  db.exec([
    "INSERT INTO coupons (code, kind, value, min_subtotal_paise, is_active) VALUES ('WELCOME10','percent',10,0,1);",
    "INSERT INTO coupons (code, kind, value, min_subtotal_paise, is_active) VALUES ('FLAT50','flat',5000,10000,1);",
    "INSERT INTO coupons (code, kind, value, min_subtotal_paise, is_active) VALUES ('FLATBIG','flat',50000,0,1);",
    "INSERT INTO coupons (code, kind, value, min_subtotal_paise, is_active) VALUES ('DEAD','percent',10,0,0);",
    "INSERT INTO orders (id,idempotency_key,customer_name,customer_email,shipping_address,subtotal_paise,shipping_paise,total_paise) VALUES ('o-1','k-1','T','t@e.com','addr 12345 here',100000,9900,109900);",
  ].join("\n"));
  db.close();
  resetRateLimits();
});
async function rootCookie(): Promise<string> {
  const res = await loginPOST(
    new Request("http://x/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "root", password: "test-root-password-123" }),
    })
  );
  expect(res.status).toBe(200);
  const setCookie = res.headers.get("Set-Cookie") || "";
  return setCookie.split(";")[0];
}
describe("coupon quotes (server-side math)", () => {
  it("computes percent discount", () => {
    expect(quoteCoupon("WELCOME10", 100000)).toEqual({ valid: true, discountPaise: 10000 });
  });
  it("caps flat discount at subtotal", () => {
    expect(quoteCoupon("FLATBIG", 30000).discountPaise).toBe(30000);
    expect(quoteCoupon("FLATBIG", 100000).discountPaise).toBe(50000);
  });
  it("rejects below-minimum subtotal", () => {
    expect(quoteCoupon("FLAT50", 5000).valid).toBe(false);
  });
  it("rejects inactive and unknown codes", () => {
    expect(quoteCoupon("DEAD", 100000).valid).toBe(false);
    expect(quoteCoupon("NOPE", 100000).valid).toBe(false);
  });
});
describe("dispatch state machine", () => {
  it("moves unfulfilled → preparing", () => {
    expect(setDispatchStatus("o-1", "preparing").dispatch_status).toBe("preparing");
  });
  it("rejects illegal jumps", () => {
    expect(() => setDispatchStatus("o-1", "delivered")).toThrow(OrderTransitionError);
  });
  it("requires paid before shipped", () => {
    expect(() => setDispatchStatus("o-1", "shipped")).toThrow(/paid/);
  });
  it("reads the order back", () => {
    expect(getOrder("o-1")?.id).toBe("o-1");
  });
});
describe("payments stay records-only", () => {
  it("rejects webhooks without a gateway secret", () => {
    expect(applyWebhook({ gatewayPaymentId: "g1", status: "paid", signature: "00" }).ok).toBe(false);
  });
  it("records idempotent intents", () => {
    const key = "11111111-1111-4111-8111-111111111111";
    const first = recordPaymentIntent("o-1", 109900, key);
    const second = recordPaymentIntent("o-1", 109900, key);
    expect(first.deduped).toBe(false);
    expect(second.deduped).toBe(true);
    expect(second.payment.id).toBe(first.payment.id);
  });
});
describe("admin validation", () => {
  it("caps percent coupons at 50", () => {
    expect(couponSchema.safeParse({ code: "BIG99", kind: "percent", value: 99 }).success).toBe(false);
  });
  it("rejects lowercase SKUs", () => {
    expect(variantSchema.safeParse({ product_id: 1, sku: "abc", grams: 50, price_paise: 100, stock: 1 }).success).toBe(false);
  });
  it("rejects unknown dispatch targets", () => {
    expect(dispatchSchema.safeParse({ to: "teleport" }).success).toBe(false);
  });
  it("validates login and user schemas", () => {
    expect(loginSchema.safeParse({ username: "root", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ username: "NO SPACES", password: "x" }).success).toBe(false);
    expect(createUserSchema.safeParse({ username: "staff-1", password: "short" }).success).toBe(false);
    expect(createUserSchema.safeParse({ username: "staff-1", password: "long-enough-password-1" }).success).toBe(true);
  });
});
describe("session-cookie gate (env-root bootstrap via ADMIN_PASSWORD_HASH)", () => {
  it("logs in and lets the session cookie through the guard", async () => {
    const cookie = await rootCookie();
    expect(cookie).toMatch(/^admin_session=/);
    const req = new Request("http://x/api/admin/orders", { headers: { Cookie: cookie } });
    expect(isAdminRequest(req)).toBe(true);
    expect(guard(req)).toBeNull();
  });
  it("rejects requests without a cookie", () => {
    expect(isAdminRequest(new Request("http://x/"))).toBe(false);
  });
  it("no longer accepts the old Bearer header", () => {
    expect(
      isAdminRequest(new Request("http://x/", { headers: { Authorization: "Bearer test-admin-token" } }))
    ).toBe(false);
  });
  it("rejects a tampered cookie with a generic 401", async () => {
    const cookie = await rootCookie();
    const tampered = cookie.slice(0, -1) + (cookie.endsWith("0") ? "1" : "0");
    const res = guard(new Request("http://x/api/admin/orders", { headers: { Cookie: tampered } }));
    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
    expect(((await res!.json()) as { error: string }).error).toBe("Unauthorized.");
  });
  it("rejects wrong passwords with a generic 401", async () => {
    const res = await loginPOST(
      new Request("http://x/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "root", password: "wrong-password-123" }),
      })
    );
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: string }).error).toBe("Invalid username or password.");
  });
});
