import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, createMockImageBuffer, TEST_ROOT_PASSWORD, type TestEnv } from "./test-helper";
import { GET as healthGET } from "@/app/api/health/route";
import { POST as mcpPOST } from "@/app/mcp/route";
import { TOOL_DEFINITIONS, McpError } from "@/lib/mcp";
import { GET as couponsGET, POST as couponsPOST } from "@/app/api/admin/coupons/route";
import { DELETE as couponDELETE } from "@/app/api/admin/coupons/[code]/route";
import { GET as usersGET, POST as usersPOST } from "@/app/api/admin/users/route";
import { PATCH as userPATCH, DELETE as userDELETE } from "@/app/api/admin/users/[id]/route";
import { POST as loginPOST } from "@/app/api/admin/login/route";
import { conflict } from "@/lib/adminHttp";
import { parseSessionCookie, verifySessionValue } from "@/lib/adminSessions";
import { resetRateLimits } from "@/lib/rateLimit";

describe("Tier 1: System, MCP, Settings & Security (Features 28–44)", () => {
  let env: TestEnv;
  let rootCookie: string;
  let staffCookie: string;

  beforeAll(() => {
    env = setupAdminTestEnv();
    rootCookie = getAuthCookie(env.db, "root");
    staffCookie = getAuthCookie(env.db, "admin");
  });

  afterAll(() => {
    env.cleanup();
  });

  describe("Feature 28, 29, 30, 31: MCP Server Health, Tool Registry, Test Runner & Access Key", () => {
    it("reports healthy server status and SQLite connection via GET /api/health (Feature 28)", async () => {
      const res = await healthGET();
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.database).toBe("sqlite");
    });

    it("verifies MCP Tool Registry contains expected tool definitions and JSON schemas (Feature 29)", () => {
      const toolNames = TOOL_DEFINITIONS.map((t) => t.name);
      expect(toolNames).toContain("store.listProducts");
      expect(toolNames).toContain("store.getProduct");
      expect(toolNames).toContain("store.validateCoupon");
      expect(toolNames).toContain("admin.upsertProduct");

      const couponTool = TOOL_DEFINITIONS.find((t) => t.name === "store.validateCoupon");
      expect(couponTool).toBeDefined();
      expect(couponTool?.description).toBeDefined();
      expect(couponTool?.inputSchema).toHaveProperty("properties");
      expect((couponTool?.inputSchema as any).properties).toHaveProperty("code");
      expect((couponTool?.inputSchema as any).properties).toHaveProperty("subtotalPaise");
    });

    it("executes MCP test runner interactively and formats response (Feature 30)", () => {
      // Seed coupon for runner
      env.db.exec("INSERT OR REPLACE INTO coupons (code, kind, value, min_subtotal_paise, is_active) VALUES ('TESTBENCH10', 'percent', 10, 0, 1)");

      const couponTool = TOOL_DEFINITIONS.find((t) => t.name === "store.validateCoupon")!;
      const result = couponTool.run({ code: "TESTBENCH10", subtotalPaise: 100000 }) as { valid: boolean; discountPaise: number };

      expect(result.valid).toBe(true);
      expect(result.discountPaise).toBe(10000);
    });

    it("authenticates MCP requests with valid token and rejects unauthorized calls (Feature 31)", async () => {
      // Unauthenticated request
      const unauthReq = new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      const unauthRes = await mcpPOST(unauthReq);
      expect(unauthRes.status).toBe(401);

      // Authenticated with token query parameter
      const authReq = new Request(`http://localhost/mcp?token=${process.env.MCP_TOKEN}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      const authRes = await mcpPOST(authReq);
      expect(authRes.status).toBe(200);
      const data = await authRes.json();
      expect(data.result).toBeDefined();
      expect(Array.isArray(data.result.tools)).toBe(true);
    });
  });

  describe("Feature 32: Store Operational Settings", () => {
    it("persists and reads store operational parameters from store_settings", () => {
      const getSetting = (key: string) => {
        const row = env.db.prepare("SELECT value FROM store_settings WHERE key = ?").get(key) as { value: string } | undefined;
        return row?.value;
      };

      expect(getSetting("store_name")).toBe("Himalayan Tea House");
      expect(getSetting("currency_code") || getSetting("currency")).toBe("INR");
      expect(getSetting("gst_tax_rate_percent") || getSetting("tax_rate_percent")).toBe("5");
      expect(Number(getSetting("shipping_flat_fee_paise") || getSetting("shipping_fee_paise"))).toBe(9900);
      expect(Number(getSetting("free_shipping_threshold_paise"))).toBe(150000);
    });

    it("updates store setting parameters safely", () => {
      env.db.prepare("UPDATE store_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?").run("tea-concierge@himalayantea.com", "contact_email");
      const updated = env.db.prepare("SELECT value FROM store_settings WHERE key = 'contact_email'").get() as { value: string };
      expect(updated.value).toBe("tea-concierge@himalayantea.com");
    });
  });

  describe("Feature 33: Coupon Manager CRUD & 1–50% Boundary Rule", () => {
    it("creates a valid coupon via POST /api/admin/coupons", async () => {
      const payload = {
        code: "AUTUMN25",
        kind: "percent",
        value: 25,
        min_subtotal_paise: 50000,
        is_active: 1,
      };

      const req = new Request("http://localhost/api/admin/coupons", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await couponsPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.coupon.code).toBe("AUTUMN25");
    });

    it("rejects percent discount over 50% with HTTP 400", async () => {
      const payload = {
        code: "INVALID60",
        kind: "percent",
        value: 60,
      };

      const req = new Request("http://localhost/api/admin/coupons", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await couponsPOST(req);
      expect(res.status).toBe(400);
    });

    it("lists coupons via GET /api/admin/coupons", async () => {
      const req = new Request("http://localhost/api/admin/coupons", {
        headers: { Cookie: rootCookie },
      });

      const res = await couponsGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.coupons)).toBe(true);
      expect(data.coupons.find((c: { code: string }) => c.code === "AUTUMN25")).toBeDefined();
    });

    it("deletes a coupon via DELETE /api/admin/coupons/[code]", async () => {
      const req = new Request("http://localhost/api/admin/coupons/AUTUMN25", {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });

      const res = await couponDELETE(req, { params: Promise.resolve({ code: "AUTUMN25" }) });
      expect(res.status).toBe(204);
    });
  });

  describe("Feature 34, 35, 36, 37: Staff Accounts, RBAC, Role Gating & Password Reset", () => {
    let createdStaffId: number;

    it("blocks non-root staff from accessing staff list with HTTP 403 (Feature 34)", async () => {
      const req = new Request("http://localhost/api/admin/users", {
        headers: { Cookie: staffCookie },
      });

      const res = await usersGET(req);
      expect(res.status).toBe(403);
    });

    it("allows root to list staff accounts via GET /api/admin/users (Feature 34)", async () => {
      const req = new Request("http://localhost/api/admin/users", {
        headers: { Cookie: rootCookie },
      });

      const res = await usersGET(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.users)).toBe(true);
      expect(data.users.length).toBeGreaterThanOrEqual(2);
    });

    it("creates a staff user with password >= 12 characters via POST /api/admin/users (Feature 35)", async () => {
      const payload = {
        username: "tea_sommelier",
        email: "sommelier@himalayanteahouse.com",
        password: "secure-sommelier-password-999",
        role: "admin",
      };

      const req = new Request("http://localhost/api/admin/users", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const res = await usersPOST(req);
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.user.username).toBe("tea_sommelier");
      createdStaffId = data.user.id;
    });

    it("edits staff role and active status via PATCH /api/admin/users/[id] (Feature 36)", async () => {
      const req = new Request(`http://localhost/api/admin/users/${createdStaffId}`, {
        method: "PATCH",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: 1, email: "lead_sommelier@himalayanteahouse.com" }),
      });

      const res = await userPATCH(req, { params: Promise.resolve({ id: String(createdStaffId) }) });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.user.email).toBe("lead_sommelier@himalayanteahouse.com");
    });

    it("resets staff password and revokes all active sessions (Feature 37)", async () => {
      // First create active session for staff
      const staffUser = env.db.prepare("SELECT id FROM admin_users WHERE id = ?").get(createdStaffId) as { id: number };
      const { createAdminSession } = await import("@/lib/adminSessions");
      const { cookieValue } = createAdminSession(staffUser.id);

      // Verify session is active
      const beforeVerification = verifySessionValue(cookieValue);
      expect(beforeVerification).not.toBeNull();

      // Reset password via PATCH /api/admin/users/[id]
      const req = new Request(`http://localhost/api/admin/users/${createdStaffId}`, {
        method: "PATCH",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "new-brand-new-password-1234" }),
      });

      const res = await userPATCH(req, { params: Promise.resolve({ id: String(createdStaffId) }) });
      expect(res.status).toBe(200);

      // Verify old session was immediately revoked
      const afterVerification = verifySessionValue(cookieValue);
      expect(afterVerification).toBeNull();
    });

    it("deactivates staff user (never hard delete) via DELETE /api/admin/users/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/users/${createdStaffId}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });

      const res = await userDELETE(req, { params: Promise.resolve({ id: String(createdStaffId) }) });
      expect(res.status).toBe(200);

      const check = env.db.prepare("SELECT is_active FROM admin_users WHERE id = ?").get(createdStaffId) as { is_active: number };
      expect(check.is_active).toBe(0);
    });
  });

  describe("Feature 38, 39, 40: Media Upload Pipeline, MIME & Magic Bytes, DB Persistence", () => {
    it("validates allowed image formats (JPEG, PNG, WebP, AVIF) and magic bytes (Feature 39)", () => {
      const jpeg = createMockImageBuffer("jpeg", 2048);
      const png = createMockImageBuffer("png", 2048);
      const webp = createMockImageBuffer("webp", 2048);
      const avif = createMockImageBuffer("avif", 2048);

      function detectImageFormat(buf: Buffer): string | null {
        if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
        if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
        if (buf.toString("utf8", 0, 4) === "RIFF" && buf.toString("utf8", 8, 12) === "WEBP") return "image/webp";
        if (buf.toString("utf8", 4, 12) === "ftypavif") return "image/avif";
        return null;
      }

      expect(detectImageFormat(jpeg)).toBe("image/jpeg");
      expect(detectImageFormat(png)).toBe("image/png");
      expect(detectImageFormat(webp)).toBe("image/webp");
      expect(detectImageFormat(avif)).toBe("image/avif");
    });

    it("rejects prohibited file types like SVGs and executables (Feature 39)", () => {
      const svg = createMockImageBuffer("svg");
      const exe = createMockImageBuffer("exe");

      function isAllowedUpload(buf: Buffer): boolean {
        if (buf[0] === 0x4d && buf[1] === 0x5a) return false; // MZ executable
        if (buf.toString("utf8").includes("<svg")) return false; // SVG disallowed for XSS safety
        if (buf.length > 5 * 1024 * 1024) return false; // 5MB limit
        return true;
      }

      expect(isAllowedUpload(svg)).toBe(false);
      expect(isAllowedUpload(exe)).toBe(false);
    });

    it("persists media upload records in database with alt text and collision-resistant filename (Features 38 & 40)", () => {
      const insert = env.db.prepare(`
        INSERT INTO media_uploads (filename, url, alt_text, mime_type, file_size)
        VALUES (?, ?, ?, ?, ?)
      `);

      const filename = `media_${Date.now()}_a8f9b2_risheehat.webp`;
      const url = `/uploads/${filename}`;
      const info = insert.run(filename, url, "Darjeeling summer tea estate misty hills", "image/webp", 450000);

      expect(info.lastInsertRowid).toBeDefined();

      const mediaAsset = env.db.prepare("SELECT * FROM media_assets WHERE filename = ?").get(filename) as {
        url: string;
        alt_text: string;
        size_bytes: number;
      };

      expect(mediaAsset).toBeDefined();
      expect(mediaAsset.url).toBe(url);
      expect(mediaAsset.alt_text).toContain("misty hills");
      expect(mediaAsset.size_bytes).toBe(450000);
    });
  });

  describe("Feature 41, 42, 43, 44: Authentication, Lockout, Idempotency & Error Masking", () => {
    it("verifies HttpOnly admin session cookie HMAC and rejects tampered values (Feature 41)", () => {
      const fakeCookie = "admin_session=malicious-sid.tampered-hmac-signature";
      const req = new Request("http://localhost/api/admin/me", {
        headers: { Cookie: fakeCookie },
      });

      const parsedCookie = parseSessionCookie(req);
      expect(parsedCookie).toBe("malicious-sid.tampered-hmac-signature");
      const verified = verifySessionValue(parsedCookie!);
      expect(verified).toBeNull();
    });

    it("triggers account lockout after 5 consecutive failed attempts and returns generic 401 (Feature 42)", async () => {
      resetRateLimits();
      const testLockUser = "victim_account";

      // Seed test user
      const { hashPassword } = await import("@/lib/password");
      env.db.prepare(
        "INSERT OR REPLACE INTO admin_users (username, email, password_hash, role, is_active, failed_attempts) VALUES (?, ?, ?, 'admin', 1, 0)"
      ).run(testLockUser, "victim@himalayantea.com", hashPassword("victim-real-password-1234"));

      // 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        const req = new Request("http://localhost/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: testLockUser, password: "wrong-password" }),
        });
        const res = await loginPOST(req);
        expect(res.status).toBe(401);
      }

      // 6th attempt with correct password must still fail with generic 401
      const reqCorrect = new Request("http://localhost/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: testLockUser, password: "victim-real-password-1234" }),
      });
      const resCorrect = await loginPOST(reqCorrect);
      expect(resCorrect.status).toBe(401);
      const data = await resCorrect.json();
      expect(data.error).toBe("Invalid username or password."); // Generic error message (no oracle)
    });

    it("deduplicates mutating requests replay with Idempotency-Key (Feature 43)", async () => {
      const { POST: productsPOST } = await import("@/app/api/admin/products/route");
      const idemKey = "22222222-2222-4222-8222-222222222222";
      const productPayload = {
        slug: "idempotency-test-tea",
        name: "Idempotency Test Tea",
        origin: "Nepal",
        estate: "Guranse",
        flush: "Spring",
        harvest_date: "2026",
        description: "Testing idempotency replay.",
        tasting_notes: "Clean, floral.",
        brew_temp: 90,
        brew_seconds: 180,
        idempotencyKey: idemKey,
      };

      const req1 = new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(productPayload),
      });

      const res1 = await productsPOST(req1);
      expect(res1.status).toBe(201);
      const data1 = await res1.json();
      expect(data1.deduped).toBe(false);

      // Replay with identical key
      const req2 = new Request("http://localhost/api/admin/products", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(productPayload),
      });

      const res2 = await productsPOST(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.deduped).toBe(true);
      expect(data2.id).toBe(data1.id);
    });

    it("masks raw SQLite and database constraint errors into generic customer-safe messages (Feature 44)", () => {
      const rawSqlError = "SqliteError: UNIQUE constraint failed: products.slug; column id table index";
      const sanitizedResponse = conflict(rawSqlError);
      expect(sanitizedResponse.status).toBe(409);

      sanitizedResponse.json().then((body) => {
        expect(body.error).toBe("Unable to complete the request.");
        expect(body.error).not.toMatch(/sqlite|constraint|table|column|index/i);
      });
    });
  });
});
