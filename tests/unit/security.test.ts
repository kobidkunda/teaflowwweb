import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { rmSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";

// Adversarial hardening tests (t2): bad tokens, over-limit bursts, error
// shape, header contract, PII redaction, client token storage, dev fences.
// Isolated temp DB migrated fresh; never touches ./data/store.sqlite.
const TEST_DB = path.join(tmpdir(), `security-test-${process.pid}.sqlite`);
process.env.DATABASE_PATH = TEST_DB;
process.env.SESSION_SECRET = "sec-session-secret-0123456789abcdef";
process.env.ADMIN_USERNAME = "root";
process.env.ADMIN_PASSWORD = "sec-root-password-123";
process.env.MCP_TOKEN = "sec-mcp-token-xyz789";

const { POST: checkoutPOST } = await import(
  "../../src/app/api/checkout/route"
);
const { GET: lookupGET } = await import(
  "../../src/app/api/orders/lookup/route"
);
const { GET: adminOrdersGET } = await import(
  "../../src/app/api/admin/orders/route"
);
const { POST: mcpPOST, GET: mcpGET } = await import(
  "../../src/app/mcp/route"
);
const { POST: adminLoginPOST } = await import(
  "../../src/app/api/admin/login/route"
);
const { guard, conflict } = await import("../../src/lib/adminHttp");
const {
  checkRateLimit,
  resetRateLimits,
  rateLimitResponse,
  RATE_LIMITS,
} = await import("../../src/lib/rateLimit");
const { SECURITY_HEADERS, applySecurityHeaders } = await import(
  "../../src/lib/security"
);
const { dispatchToolCall } = await import("../../src/lib/mcp");

let variantId = 0;

const adminHeaders = (cookie: string): Record<string, string> =>
  cookie ? { Cookie: cookie } : {};
const withIp = (
  headers: Record<string, string>,
  ip: string
): Record<string, string> => ({ ...headers, "X-Forwarded-For": ip });

// Root session cookie, minted once via the login route (env-root bootstrap).
let sessionCookie = "";

let checkoutSeed = 0;
const checkoutBody = (email: string, ip: string) =>
  new Request("http://x/api/checkout", {
    method: "POST",
    headers: withIp({ "Content-Type": "application/json" }, ip),
    body: JSON.stringify({
      name: "Security Customer",
      email,
      address: "9 Adversarial Lane, Probe City",
      idempotencyKey: randomUUID(),
      items: [{ variantId, quantity: 1 }],
    }),
  });

beforeAll(async () => {
  execFileSync(process.execPath, ["scripts/migrate.mjs"], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_PATH: TEST_DB },
    stdio: "ignore",
  });
  const product = dispatchToolCall("admin.upsertProduct", {
    slug: "sec-tea",
    name: "Sec Tea",
    category: "Black",
    origin: "Sec origin",
    estate: "Sec estate",
    flush: "Spring",
    harvest_date: "2026 harvest",
    description: "Security test tea.",
    tasting_notes: "Bold",
    brew_temp: 90,
    brew_seconds: 180,
  }) as { id: number };
  const variant = dispatchToolCall("admin.upsertVariant", {
    product_id: product.id,
    sku: "SEC-T-100",
    grams: 100,
    price_paise: 50000,
    stock: 1000,
  }) as { id: number };
  variantId = variant.id;
  const login = await adminLoginPOST(
    new Request("http://x/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "root", password: "sec-root-password-123" }),
    })
  );
  if (login.status !== 200) throw new Error("root bootstrap login failed in test setup");
  sessionCookie = (login.headers.get("Set-Cookie") || "").split(";")[0];
});

beforeEach(() => {
  resetRateLimits();
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

describe("admin session-cookie gate (adversarial)", () => {
  it("lets a valid session cookie through the guard", () => {
    const good = withIp(adminHeaders(sessionCookie), "10.0.0.1");
    expect(guard(new Request("http://x/api/admin/orders", { headers: good }))).toBeNull();
  });
  it("rejects the old Bearer header (cut over to cookies)", async () => {
    const res = (await guard(
      new Request("http://x/api/admin/orders", {
        headers: withIp({ Authorization: "Bearer sec-admin-token-abc123" }, "10.0.0.3"),
      })
    ))!;
    expect(res.status).toBe(401);
  });
  it("rejects a wrong password with a generic 401", async () => {
    const res = await adminLoginPOST(
      new Request("http://x/api/admin/login", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, "10.0.0.4"),
        body: JSON.stringify({ username: "root", password: "wrong-password-123" }),
      })
    );
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Invalid username or password.");
  });
  for (const [label, headers] of [
    ["missing cookie", {}],
    ["tampered signature", { Cookie: sessionCookie.slice(0, -1) + (sessionCookie.endsWith("0") ? "1" : "0") }],
    ["malformed value (no signature)", { Cookie: "admin_session=deadbeef" }],
    ["unknown session", { Cookie: "admin_session=" + "ab".repeat(32) + "." + "cd".repeat(32) }],
    ["empty cookie", { Cookie: "admin_session=" }],
  ] as [string, Record<string, string>][]) {
    it(`returns 401 for ${label}`, async () => {
      const res = await guard(
        new Request("http://x/api/admin/orders", {
          headers: withIp(headers, "10.0.0.2"),
        })
      );
      expect(res).not.toBeNull();
      expect(res!.status).toBe(401);
      const text = await res!.text();
      expect(text).not.toContain("sec-session-secret");
    });
  }
  it("401 body is generic (no hint, no secret echo)", async () => {
    const res = (await guard(
      new Request("http://x/api/admin/orders")
    ))!;
    expect(res.status).toBe(401);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Unauthorized.");
  });
});

describe("MCP query-param-only gate (adversarial)", () => {
  const rpc = (body: unknown, token?: string, extraHeaders: Record<string, string> = {}) =>
    new Request(
      `http://x/mcp${token === undefined ? "" : `?token=${encodeURIComponent(token)}`}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", ...extraHeaders },
        body: JSON.stringify(body),
      }
    );
  const list = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };
  it("rejects a token smuggled in the Authorization header", async () => {
    const res = await mcpPOST(
      rpc(list, undefined, { Authorization: "Bearer sec-mcp-token-xyz789" })
    );
    expect(res.status).toBe(401);
  });
  it("rejects a token smuggled in the JSON-RPC body", async () => {
    const res = await mcpPOST(
      rpc({ ...list, params: { token: "sec-mcp-token-xyz789" } })
    );
    expect(res.status).toBe(401);
  });
  it("rejects a wrong token of the same length", async () => {
    const res = await mcpPOST(rpc(list, "sec-mcp-token-xyz780"));
    expect(res.status).toBe(401);
  });
  it("401 body is JSON-RPC shaped and never echoes the token", async () => {
    const res = await mcpPOST(rpc(list, "nope"));
    expect(res.status).toBe(401);
    const text = await res.text();
    expect(text).not.toContain("sec-mcp-token-xyz789");
    expect(JSON.parse(text)).toMatchObject({
      jsonrpc: "2.0",
      error: { code: -32001 },
    });
  });
  it("GET without a token is 401, not a method hint", async () => {
    const res = await mcpGET(new Request("http://x/mcp"));
    expect(res.status).toBe(401);
  });
});

describe("rate limiting (burst shedding)", () => {
  it("fixed window: allows N, then denies until reset", () => {
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit("unit:k", 5, 60_000, 1000 + i).allowed).toBe(true);
    }
    expect(checkRateLimit("unit:k", 5, 60_000, 1006).allowed).toBe(false);
    expect(checkRateLimit("unit:k", 5, 60_000, 61_001).allowed).toBe(true);
    resetRateLimits();
    expect(checkRateLimit("unit:k", 5, 60_000, 61_002).allowed).toBe(true);
  });
  it("checkout bursts past budget get 429 with Retry-After", async () => {
    const ip = "203.0.113.7";
    let lastStatus = 0;
    let last: Response | null = null;
    for (let i = 0; i < RATE_LIMITS.checkout + 1; i++) {
      last = await checkoutPOST(checkoutBody(`burst${i}@example.com`, ip));
      lastStatus = last.status;
      if (i < RATE_LIMITS.checkout) expect(lastStatus).toBe(201);
    }
    expect(lastStatus).toBe(429);
    expect(last!.headers.get("Retry-After")).toMatch(/^\d+$/);
    const body = (await last!.json()) as { error: string };
    expect(body.error).toMatch(/too many requests/i);
  });
  it("admin guard sheds after budget without touching auth logic", async () => {
    const ip = "198.51.100.9";
    const headers = withIp(adminHeaders(sessionCookie), ip);
    for (let i = 0; i < RATE_LIMITS.admin; i++) {
      expect(guard(new Request("http://x/api/admin/orders", { headers }))).toBeNull();
    }
    const shed = (await guard(
      new Request("http://x/api/admin/orders", { headers })
    ))!;
    expect(shed.status).toBe(429);
    expect(shed.headers.get("Retry-After")).toMatch(/^\d+$/);
  });
  it("MCP endpoint sheds after budget", async () => {
    const ip = "192.0.2.11";
    let lastStatus = 0;
    for (let i = 0; i < RATE_LIMITS.mcp + 1; i++) {
      const res = await mcpGET(
        new Request("http://x/mcp?token=sec-mcp-token-xyz789", {
          headers: { "X-Forwarded-For": ip },
        })
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
  it("rateLimitResponse carries budget headers on shed", () => {
    const req = new Request("http://x/", {
      headers: { "X-Forwarded-For": "203.0.113.99" },
    });
    let shed: Response | null = null;
    for (let i = 0; i < 4; i++) shed = rateLimitResponse(req, "unit:h", 3);
    expect(shed!.status).toBe(429);
    expect(shed!.headers.get("X-RateLimit-Remaining")).toBe("0");
  });
});

describe("generic error shapes (no raw DB text)", () => {
  it("masks constraint/table internals behind a generic message", async () => {
    for (const raw of [
      "UNIQUE constraint failed: products.slug",
      "SQLITE_CONSTRAINT: FOREIGN KEY constraint failed",
      "SQLite database missing. Run npm run db:setup first.",
      "no such table: variants",
    ]) {
      const res = conflict(raw);
      expect(res.status).toBe(409);
      const body = (await res.json()) as { error: string };
      expect(body.error).toBe("Unable to complete the request.");
      expect(body.error).not.toMatch(/sqlite|constraint|table|database/i);
    }
  });
  it("passes controlled domain messages through unchanged", async () => {
    const res = conflict("Category not found.");
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("Category not found.");
  });
  it("checkout validation failures stay generic (400)", async () => {
    const res = await checkoutPOST(
      new Request("http://x/api/checkout", {
        method: "POST",
        headers: withIp({ "Content-Type": "application/json" }, "203.0.113.8"),
        body: JSON.stringify({ bogus: true }),
      })
    );
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).not.toMatch(/sqlite|stack|constraint|database/i);
  });
});

describe("security headers contract", () => {
  it("declares the baseline header set", () => {
    expect(SECURITY_HEADERS["X-Content-Type-Options"]).toBe("nosniff");
    expect(SECURITY_HEADERS["X-Frame-Options"]).toBe("DENY");
    expect(SECURITY_HEADERS["Referrer-Policy"]).toBe(
      "strict-origin-when-cross-origin"
    );
    expect(SECURITY_HEADERS["Strict-Transport-Security"]).toMatch(/max-age=/);
    expect(SECURITY_HEADERS["Content-Security-Policy"]).toMatch(
      /frame-ancestors 'none'/
    );
    expect(SECURITY_HEADERS["Permissions-Policy"]).toMatch(/camera=\(\)/);
  });
  it("stamps every header onto a response", async () => {
    const { NextResponse } = await import("next/server");
    const res = applySecurityHeaders(NextResponse.json({ ok: true }));
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res.headers.get(name)).toBe(value);
    }
  });
  it("middleware applies the same contract to every path", () => {
    const file = path.join(process.cwd(), "src", "middleware.ts");
    expect(existsSync(file)).toBe(true);
    const source = readFileSync(file, "utf8");
    expect(source).toContain("SECURITY_HEADERS");
    expect(source).toContain("/:path*");
  });
});

describe("PII minimization", () => {
  it("public lookup never returns name/email/address", async () => {
    checkoutSeed += 1;
    const email = `pii-victim-${checkoutSeed}@example.com`;
    const created = (await (
      await checkoutPOST(checkoutBody(email, "203.0.113.21"))
    ).json()) as { orderId: string };
    const res = await lookupGET(
      new Request(`http://x/api/orders/lookup?id=${created.orderId}`, {
        headers: { "X-Forwarded-For": "203.0.113.22" },
      })
    );
    expect(res.status).toBe(200);
    const raw = await res.text();
    expect(raw).not.toContain(email);
    const body = JSON.parse(raw) as { order: Record<string, unknown> };
    for (const key of Object.keys(body.order)) {
      expect(key).not.toMatch(/name|email|address/i);
    }
  });
  it("admin order list omits shipping_address from the overview", async () => {
    const res = await adminOrdersGET(
      new Request("http://x/api/admin/orders?limit=5", {
        headers: withIp(adminHeaders(sessionCookie), "203.0.113.23"),
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orders: Record<string, unknown>[] };
    for (const order of body.orders) {
      expect(order).not.toHaveProperty("shipping_address");
    }
  });
});

describe("client token-storage + logging hygiene (static fences)", () => {
  function sourceFiles(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (entry === "node_modules") continue;
      const stat = statSync(full);
      if (stat.isDirectory()) sourceFiles(full, out);
      else if (/\.(ts|tsx|mjs|js)$/.test(entry)) out.push(full);
    }
    return out;
  }
  it("only non-sensitive cart persistence may use Web storage", () => {
    // Policy: Web storage must never hold tokens, credentials or customer
    // PII. The single allowed key is the anonymous cart ("tea-house-cart":
    // variantId/slug/name/grams/pricePaise/quantity only). The admin token
    // lives in memory (AdminClient state) and is forgotten on tab close.
    const callRe =
      /(sessionStorage|localStorage)\.(getItem|setItem|removeItem)\(\s*"([^"]+)"/g;
    const violations: string[] = [];
    for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(callRe)) {
        if (match[3] !== "tea-house-cart") {
          violations.push(
            `${path.relative(process.cwd(), file)}:${match[1]}:${match[3]}`
          );
        }
      }
    }
    expect(violations).toEqual([]);
  });
  it("console output flows only through the redacting logger", () => {
    // src/lib/logger.ts is the single owned sink: it redacts token/secret/
    // PII keys and emails before emitting. Raw console.* elsewhere is banned.
    const hits: string[] = [];
    for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
      if (file.endsWith(`${path.sep}lib${path.sep}logger.ts`)) continue;
      const text = readFileSync(file, "utf8");
      if (/console\.(log|debug|info|warn|error)/.test(text)) {
        hits.push(path.relative(process.cwd(), file));
      }
    }
    expect(hits).toEqual([]);
  });
  it("the logger redacts tokens, secrets, PII keys and emails", async () => {
    const { redactValue, redactText } = await import(
      "../../src/lib/logger"
    );
    expect(redactValue("adminToken", "sec-admin-token-abc123")).toBe(
      "[redacted]"
    );
    expect(redactValue("customer_email", "pii-victim@example.com")).toBe(
      "[redacted]"
    );
    expect(redactValue("shipping_address", "9 Adversarial Lane")).toBe(
      "[redacted]"
    );
    expect(redactValue("authorization", "Bearer x")).toBe("[redacted]");
    expect(redactValue("orderId", "o-123")).toBe("o-123");
    expect(redactText("contact pii-victim@example.com now")).toBe(
      "contact [redacted-email] now"
    );
  });
});

describe("dev-only surface fence", () => {
  it("exposes no debug/dev/test/mock api segments", () => {
    const api = path.join(process.cwd(), "src", "app", "api");
    const segments: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = path.join(dir, entry);
        if (statSync(full).isDirectory()) {
          const rel = path.relative(api, full);
          // Allow production admin action endpoints (e.g. sending a test email to verify templates)
          if (rel === path.join("admin", "email-templates", "[key]", "test")) {
            continue;
          }
          segments.push(entry);
          walk(full);
        }
      }
    };
    walk(api);
    expect(
      segments.filter((s) => /^(debug|dev|test|mock|stub|playground)/i.test(s))
    ).toEqual([]);
  });
});
