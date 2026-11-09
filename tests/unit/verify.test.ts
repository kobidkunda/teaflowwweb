import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { rmSync } from "node:fs";

// End-to-end route verification (t5): HTTP-level auth + server-side pricing.
// Isolated temp DB migrated fresh; never touches ./data/store.sqlite.
const TEST_DB = path.join(tmpdir(), `verify-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
process.env.SESSION_SECRET = "verify-session-secret-0123456789abcdef";
process.env.ADMIN_USERNAME = "root";
process.env.ADMIN_PASSWORD = "verify-root-password-123";
process.env.MCP_TOKEN = "verify-mcp-token";

const { GET: adminGET, POST: adminPOST } = await import(
  "../../src/app/api/admin/products/route"
);
const { POST: adminLoginPOST } = await import(
  "../../src/app/api/admin/login/route"
);
const { POST: checkoutPOST } = await import(
  "../../src/app/api/checkout/route"
);
const { GET: mcpGET, POST: mcpPOST } = await import(
  "../../src/app/mcp/route"
);
const { dispatchToolCall } = await import("../../src/lib/mcp");

let variantId = 0;
let sessionCookie = "";

const adminHeaders = (cookie?: string): Record<string, string> =>
  cookie ? { Cookie: cookie } : {};
const mcpUrl = (token?: string) =>
  `http://x/mcp${token === undefined ? "" : `?token=${token}`}`;
const rpc = (body: unknown, token?: string) =>
  new Request(mcpUrl(token), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeAll(async () => {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });
  const product = dispatchToolCall("admin.upsertProduct", {
    slug: "verify-tea",
    name: "Verify Tea",
    category: "Black",
    origin: "Verify origin",
    estate: "Verify estate",
    flush: "Spring",
    harvest_date: "2026 harvest",
    description: "Verification tea.",
    tasting_notes: "Malty",
    brew_temp: 90,
    brew_seconds: 180,
  }) as { id: number };
  const variant = dispatchToolCall("admin.upsertVariant", {
    product_id: product.id,
    sku: "VERIFY-T-100",
    grams: 100,
    price_paise: 100000,
    stock: 10,
  }) as { id: number };
  variantId = variant.id;
  dispatchToolCall("admin.upsertCoupon", {
    code: "VERIFY10",
    kind: "percent",
    value: 10,
  });
  const login = await adminLoginPOST(
    new Request("http://x/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "root", password: "verify-root-password-123" }),
    })
  );
  if (login.status !== 200) throw new Error("root bootstrap login failed in test setup");
  sessionCookie = (login.headers.get("Set-Cookie") || "").split(";")[0];
});

afterAll(() => {
  for (const suffix of ["", "-shm", "-wal", "-journal"]) {
    try {
      rmSync(TEST_DB + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }
});

describe("admin CRUD auth (route-level session gate)", () => {
  it("returns 401 without a cookie", async () => {
    const res = await adminGET(new Request("http://x/api/admin/products"));
    expect(res.status).toBe(401);
  });
  it("returns 401 with a bad cookie", async () => {
    const res = await adminGET(
      new Request("http://x/api/admin/products", {
        headers: adminHeaders("admin_session=" + "ab".repeat(32) + "." + "cd".repeat(32)),
      })
    );
    expect(res.status).toBe(401);
  });
  it("returns 200 with the session cookie", async () => {
    const res = await adminGET(
      new Request("http://x/api/admin/products", {
        headers: adminHeaders(sessionCookie),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { products: unknown[] };
    expect(Array.isArray(body.products)).toBe(true);
  });
  it("rejects unauthenticated writes (POST 401)", async () => {
    const res = await adminPOST(
      new Request("http://x/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: "nope" }),
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("coupon pricing is server-side (client math ignored)", () => {
  const orderBody = (couponCode?: string, key?: string) =>
    new Request("http://x/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Verify Customer",
        email: "verify@example.com",
        address: "123 Verification Street, Demo City",
        idempotencyKey:
          key ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        ...(couponCode === undefined ? {} : { couponCode }),
        items: [{ variantId, quantity: 1 }],
      }),
    });

  it("prices VERIFY10 on the server: 100000 - 10000 + 9900 shipping", async () => {
    const res = await checkoutPOST(orderBody("verify10"));
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      totalPaise: number;
      discountPaise: number;
    };
    expect(body.discountPaise).toBe(10000);
    expect(body.totalPaise).toBe(99900);
  });
  it("rejects a bogus code instead of trusting client math", async () => {
    const res = await checkoutPOST(
      orderBody("BOGUS99", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb")
    );
    expect(res.status).toBe(409);
  });
  it("full price without a code", async () => {
    const res = await checkoutPOST(
      orderBody(undefined, "cccccccc-cccc-4ccc-8ccc-cccccccccccc")
    );
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      totalPaise: number;
      discountPaise: number;
    };
    expect(body.discountPaise).toBe(0);
    expect(body.totalPaise).toBe(109900);
  });
});

describe("MCP route: 401 on bad token, tools on good token", () => {
  const list = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
    params: {},
  };
  it("returns 401 without a token", async () => {
    const res = await mcpPOST(rpc(list));
    expect(res.status).toBe(401);
  });
  it("returns 401 with a bad token", async () => {
    const res = await mcpPOST(rpc(list, "bad-token"));
    expect(res.status).toBe(401);
  });
  it("rejects header-only tokens (query param only)", async () => {
    const res = await mcpPOST(
      new Request("http://x/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer verify-mcp-token",
        },
        body: JSON.stringify(list),
      })
    );
    expect(res.status).toBe(401);
  });
  it("lists tools with the good token", async () => {
    const res = await mcpPOST(rpc(list, "verify-mcp-token"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { tools: { name: string }[] };
    };
    expect(body.result.tools.length).toBeGreaterThanOrEqual(22);
  });
  it("executes an authorized manage call (admin.upsertCategory)", async () => {
    const res = await mcpPOST(
      rpc(
        {
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "admin.upsertCategory",
            arguments: {
              slug: "verify-green",
              name: "Verify Green",
              idempotencyKey: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            },
          },
        },
        "verify-mcp-token"
      )
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      result: { content: { text: string }[] };
    };
    expect(body.result.content[0].text).toContain("verify-green");
  });
  it("GET without a token is also 401", async () => {
    const res = await mcpGET(new Request("http://x/mcp"));
    expect(res.status).toBe(401);
  });
});
