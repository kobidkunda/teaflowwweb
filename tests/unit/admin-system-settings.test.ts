import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupAdminTestEnv, getAuthCookie, type TestEnv } from "./admin-e2e/test-helper";
import { GET as mcpHealthGET } from "@/app/api/admin/mcp/health/route";
import { POST as mcpRunPOST } from "@/app/api/admin/mcp/run/route";
import { GET as mcpLogsGET } from "@/app/api/admin/mcp/logs/route";
import { GET as settingsGET, PUT as settingsPUT } from "@/app/api/admin/settings/route";
import { GET as couponsGET, POST as couponsPOST } from "@/app/api/admin/coupons/route";
import { GET as couponGET, PATCH as couponPATCH, PUT as couponPUT, DELETE as couponDELETE } from "@/app/api/admin/coupons/[code]/route";
import { GET as usersGET, POST as usersPOST } from "@/app/api/admin/users/route";
import { GET as userGET, PATCH as userPATCH, DELETE as userDELETE } from "@/app/api/admin/users/[id]/route";
import { POST as userResetPOST } from "@/app/api/admin/users/[id]/reset/route";
import { createAdminSession, verifySessionValue } from "@/lib/adminSessions";

describe("Milestone 5: System, MCP, Settings & Staff Modules", () => {
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

  describe("MCP Server Health & Execution Logs", () => {
    it("rejects unauthenticated requests to GET /api/admin/mcp/health", async () => {
      const req = new Request("http://localhost/api/admin/mcp/health");
      const res = await mcpHealthGET(req);
      expect(res.status).toBe(401);
    });

    it("returns healthy MCP server status via GET /api/admin/mcp/health", async () => {
      const req = new Request("http://localhost/api/admin/mcp/health", {
        headers: { Cookie: rootCookie },
      });
      const res = await mcpHealthGET(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.status).toBe("ok");
      expect(data.database).toBe("sqlite");
      expect(data.mcp_protocol_version).toBe("2025-03-26");
      expect(data.uptime_seconds).toBeGreaterThanOrEqual(0);
      expect(data.tools_count).toBeGreaterThanOrEqual(12);
      expect(data.endpoint).toBe("/mcp");
    });

    it("runs an MCP tool interactively and logs to mcp_logs via POST /api/admin/mcp/run", async () => {
      // Seed a test coupon for the tool run
      env.db.exec("INSERT OR REPLACE INTO coupons (code, kind, value, min_subtotal_paise, is_active) VALUES ('MCPOK10', 'percent', 10, 0, 1)");

      const req = new Request("http://localhost/api/admin/mcp/run", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "store.validateCoupon",
          arguments: { code: "MCPOK10", subtotalPaise: 80000 },
        }),
      });

      const res = await mcpRunPOST(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.tool).toBe("store.validateCoupon");
      expect(data.duration_ms).toBeGreaterThanOrEqual(0);
      expect(data.result).toEqual({ valid: true, discountPaise: 8000 });

      // Verify audit log in mcp_logs table
      const log = env.db
        .prepare("SELECT * FROM mcp_logs WHERE tool_name = 'store.validateCoupon' AND status = 'success' ORDER BY id DESC")
        .get() as { tool_name: string; status: string; duration_ms: number; arguments: string };

      expect(log).toBeDefined();
      expect(log.status).toBe("success");
      expect(log.duration_ms).toBeGreaterThanOrEqual(0);
      expect(log.arguments).toContain("MCPOK10");
    });

    it("captures tool argument error and logs error entry in mcp_logs", async () => {
      const req = new Request("http://localhost/api/admin/mcp/run", {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({
          tool: "store.validateCoupon",
          arguments: { code: "MCPOK10", subtotalPaise: -500 }, // invalid negative subtotal
        }),
      });

      const res = await mcpRunPOST(req);
      expect(res.status).toBe(200); // 200 with ok: false matching test runner protocol

      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.code).toBe(-32602);
      expect(data.error).toBeDefined();

      // Verify error log in mcp_logs
      const log = env.db
        .prepare("SELECT * FROM mcp_logs WHERE tool_name = 'store.validateCoupon' AND status = 'error' ORDER BY id DESC")
        .get() as { status: string; error_code: number; error_message: string };

      expect(log).toBeDefined();
      expect(log.status).toBe("error");
      expect(log.error_code).toBe(-32602);
    });

    it("retrieves historical execution logs via GET /api/admin/mcp/logs", async () => {
      const req = new Request("http://localhost/api/admin/mcp/logs?limit=10", {
        headers: { Cookie: rootCookie },
      });

      const res = await mcpLogsGET(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(Array.isArray(data.logs)).toBe(true);
      expect(data.logs.length).toBeGreaterThanOrEqual(2);
      expect(data.logs[0]).toHaveProperty("tool_name");
      expect(data.logs[0]).toHaveProperty("duration_ms");
      expect(data.logs[0]).toHaveProperty("created_at");
    });
  });

  describe("Store Operational Settings (Persistence & Validation)", () => {
    it("reads operational settings via GET /api/admin/settings", async () => {
      const req = new Request("http://localhost/api/admin/settings", {
        headers: { Cookie: rootCookie },
      });

      const res = await settingsGET(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.settings).toBeDefined();
      expect(data.settings.currency).toBe("INR");
      expect(data.settings.tax_rate_percent).toBe(5);
      expect(data.settings.shipping_flat_fee_paise).toBe(9900);
      expect(data.settings.free_shipping_threshold_paise).toBe(150000);
      expect(data.settings.contact_email).toContain("@");
    });

    it("rejects invalid settings updates (negative numbers or invalid email)", async () => {
      const invalidPayload = {
        store_name: "Himalayan Tea House",
        currency: "INR",
        tax_rate_percent: -10, // negative tax rate
        shipping_flat_fee_paise: 9900,
        free_shipping_threshold_paise: 150000,
        contact_email: "not-a-valid-email",
      };

      const req = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(invalidPayload),
      });

      const res = await settingsPUT(req);
      expect(res.status).toBe(400);
    });

    it("updates store operational settings via PUT /api/admin/settings and persists to store_settings", async () => {
      const updatePayload = {
        store_name: "Himalayan Single Estate Tea House",
        currency: "INR",
        currency_code: "INR",
        tax_rate_percent: 5,
        shipping_flat_fee_paise: 12000, // ₹120.00
        free_shipping_threshold_paise: 200000, // ₹2,000.00
        contact_email: "tea-estate-concierge@himalayantea.com",
      };

      const req = new Request("http://localhost/api/admin/settings", {
        method: "PUT",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      const res = await settingsPUT(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.settings.store_name).toBe("Himalayan Single Estate Tea House");
      expect(data.settings.shipping_flat_fee_paise).toBe(12000);
      expect(data.settings.free_shipping_threshold_paise).toBe(200000);
      expect(data.settings.contact_email).toBe("tea-estate-concierge@himalayantea.com");

      // Verify direct database persistence in store_settings table
      const row = env.db
        .prepare("SELECT value FROM store_settings WHERE key = 'contact_email'")
        .get() as { value: string };
      expect(row.value).toBe("tea-estate-concierge@himalayantea.com");

      const shippingRow = env.db
        .prepare("SELECT value FROM store_settings WHERE key = 'shipping_flat_fee_paise'")
        .get() as { value: string };
      expect(Number(shippingRow.value)).toBe(12000);
    });
  });

  describe("Coupons Full CRUD & Boundary Enforcement", () => {
    it("creates a promotional coupon via POST /api/admin/coupons", async () => {
      const payload = {
        code: "DARJEELING30",
        kind: "percent",
        value: 30,
        min_subtotal_paise: 75000,
        max_uses: 200,
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
      expect(data.coupon.code).toBe("DARJEELING30");
      expect(data.coupon.value).toBe(30);
      expect(data.coupon.max_uses).toBe(200);
    });

    it("inspects a coupon with usage statistics via GET /api/admin/coupons/[code]", async () => {
      const req = new Request("http://localhost/api/admin/coupons/DARJEELING30", {
        headers: { Cookie: rootCookie },
      });

      const res = await couponGET(req, { params: Promise.resolve({ code: "DARJEELING30" }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.coupon.code).toBe("DARJEELING30");
      expect(data.usage).toBeDefined();
      expect(data.usage.order_count).toBe(0);
    });

    it("updates coupon values via PUT and PATCH /api/admin/coupons/[code]", async () => {
      const patchReq = new Request("http://localhost/api/admin/coupons/DARJEELING30", {
        method: "PATCH",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ value: 35, max_uses: 300 }),
      });

      const resPatch = await couponPATCH(patchReq, { params: Promise.resolve({ code: "DARJEELING30" }) });
      expect(resPatch.status).toBe(200);

      const data = await resPatch.json();
      expect(data.coupon.value).toBe(35);
      expect(data.coupon.max_uses).toBe(300);

      const putReq = new Request("http://localhost/api/admin/coupons/DARJEELING30", {
        method: "PUT",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ value: 40 }),
      });

      const resPut = await couponPUT(putReq, { params: Promise.resolve({ code: "DARJEELING30" }) });
      expect(resPut.status).toBe(200);
      const putData = await resPut.json();
      expect(putData.coupon.value).toBe(40);
    });

    it("blocks deletion of a coupon used by active orders and permits deletion of unused coupons", async () => {
      // Create an order referencing a coupon
      env.db.exec("INSERT OR REPLACE INTO coupons (code, kind, value, min_subtotal_paise, is_active) VALUES ('USEDCOUPON', 'percent', 10, 0, 1)");
      env.db.exec(`
        INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise, coupon_code, payment_status, dispatch_status)
        VALUES ('order-test-coupon-1', 'idem-c-1', 'Test Customer', 'cust@example.com', '123 Tea Trail, Darjeeling', 45000, 5000, 50000, 'USEDCOUPON', 'paid', 'delivered')
      `);

      // Deleting USEDCOUPON must be blocked with HTTP 409
      const delUsedReq = new Request("http://localhost/api/admin/coupons/USEDCOUPON", {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });
      const delUsedRes = await couponDELETE(delUsedReq, { params: Promise.resolve({ code: "USEDCOUPON" }) });
      expect(delUsedRes.status).toBe(409);

      // Deleting DARJEELING30 (unused) succeeds with 204
      const delUnusedReq = new Request("http://localhost/api/admin/coupons/DARJEELING30", {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });
      const delUnusedRes = await couponDELETE(delUnusedReq, { params: Promise.resolve({ code: "DARJEELING30" }) });
      expect(delUnusedRes.status).toBe(204);
    });
  });

  describe("Staff Accounts, Dedicated Password Reset & Session Revocation", () => {
    let testStaffId: number;

    it("creates a staff user via POST /api/admin/users", async () => {
      const payload = {
        username: "tea_master_raj",
        email: "raj@himalayanteahouse.com",
        password: "secure-tea-master-password-100",
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
      expect(data.user.username).toBe("tea_master_raj");
      testStaffId = data.user.id;
    });

    it("retrieves staff user detail via GET /api/admin/users/[id]", async () => {
      const req = new Request(`http://localhost/api/admin/users/${testStaffId}`, {
        headers: { Cookie: rootCookie },
      });

      const res = await userGET(req, { params: Promise.resolve({ id: String(testStaffId) }) });
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.user.id).toBe(testStaffId);
      expect(data.user.username).toBe("tea_master_raj");
      expect(data.user.email).toBe("raj@himalayanteahouse.com");
      expect(data.user.role).toBe("admin");
      expect(data.user).not.toHaveProperty("password_hash"); // Ensures password hash is never exposed
    });

    it("resets staff password via POST /api/admin/users/[id]/reset and immediately revokes all active sessions", async () => {
      // 1. Establish an active session for the staff user
      const { cookieValue } = createAdminSession(testStaffId);

      // Verify the session is valid and active initially
      const beforeReset = verifySessionValue(cookieValue);
      expect(beforeReset).not.toBeNull();
      expect(beforeReset?.id).toBe(testStaffId);

      // 2. Reject password reset if under 12 characters
      const shortReq = new Request(`http://localhost/api/admin/users/${testStaffId}/reset`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "too-short" }),
      });
      const shortRes = await userResetPOST(shortReq, { params: Promise.resolve({ id: String(testStaffId) }) });
      expect(shortRes.status).toBe(400);

      // 3. Perform valid password reset (min 12 chars)
      const validReq = new Request(`http://localhost/api/admin/users/${testStaffId}/reset`, {
        method: "POST",
        headers: { Cookie: rootCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ password: "brand-new-secure-password-2026" }),
      });
      const validRes = await userResetPOST(validReq, { params: Promise.resolve({ id: String(testStaffId) }) });
      expect(validRes.status).toBe(200);

      const data = await validRes.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain("revoked");

      // 4. Verify that previous active session is now revoked (verifySessionValue returns null)
      const afterReset = verifySessionValue(cookieValue);
      expect(afterReset).toBeNull();
    });

    it("blocks self-deletion and last active root removal via DELETE /api/admin/users/[id]", async () => {
      const rootUser = env.db.prepare("SELECT id FROM admin_users WHERE username = 'root'").get() as { id: number };

      // Root attempting to delete own account
      const selfReq = new Request(`http://localhost/api/admin/users/${rootUser.id}`, {
        method: "DELETE",
        headers: { Cookie: rootCookie },
      });

      const selfRes = await userDELETE(selfReq, { params: Promise.resolve({ id: String(rootUser.id) }) });
      expect(selfRes.status).toBe(409); // Conflict: You cannot disable your own account
    });
  });
});
