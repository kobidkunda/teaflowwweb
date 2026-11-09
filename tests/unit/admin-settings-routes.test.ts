import { describe, it, expect, beforeEach, vi } from "vitest";
import { GET as getShipping, PUT as putShipping } from "@/app/api/admin/settings/shipping/route";
import { POST as testConnection } from "@/app/api/admin/settings/shipping/verify-connection/route";
import { POST as checkServiceability } from "@/app/api/admin/settings/shipping/check-serviceability/route";
import { GET as getPayment, PUT as putPayment } from "@/app/api/admin/settings/payment/route";
import { GET as getShiprocket, POST as postShiprocket } from "@/app/api/admin/orders/[id]/shiprocket/route";
import { createAdminSession } from "@/lib/adminSessions";
import { getDb } from "@/lib/db";

describe("Admin Shipping, Payment & Shiprocket Dispatch API Routes", () => {
  let adminCookie: string;

  beforeEach(() => {
    vi.stubEnv("COMMERCE_MOCK_PROVIDERS", "1");
    vi.stubEnv("SESSION_SECRET", "test_session_secret_for_signing_cookies_32_bytes_long");
    const db = getDb();

    // Ensure root admin user exists
    db.prepare(`
      INSERT OR IGNORE INTO admin_users (id, username, password_hash, role)
      VALUES (1, 'admin', 'hash', 'root')
    `).run();

    const session = createAdminSession(1);
    adminCookie = `admin_session=${session.cookieValue}`;
  });

  it("rejects unauthenticated requests to shipping settings", async () => {
    const res = await getShipping(new Request("http://localhost/api/admin/settings/shipping"));
    expect(res.status).toBe(401);
  });

  it("reads and updates shipping settings with ₹599 free threshold", async () => {
    const getRes = await getShipping(new Request("http://localhost/api/admin/settings/shipping", {
      headers: { Cookie: adminCookie },
    }));
    expect(getRes.status).toBe(200);
    const data = await getRes.json();
    expect(data.settings).toBeDefined();

    const putRes = await putShipping(new Request("http://localhost/api/admin/settings/shipping", {
      method: "PUT",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        free_shipping_threshold_rupees: 599,
        free_shipping_enabled: true,
        shipping_flat_fee_rupees: 99,
        shipping_calculation_mode: "flat",
        dispatch_commitment: "Dispatched within 24 hours",
        announcement_auto_sync: true,
        shiprocket_enabled: true,
        shiprocket_email: "tea@teafloww.com",
        shiprocket_pickup_location: "Primary",
        shiprocket_pickup_postcode: "734015",
        shiprocket_default_length: 10,
        shiprocket_default_breadth: 10,
        shiprocket_default_height: 10,
        shiprocket_default_tare_grams: 100,
        shiprocket_default_hsn: "090230",
      }),
    }));

    expect(putRes.status).toBe(200);
    const putData = await putRes.json();
    expect(putData.settings.free_shipping_threshold_rupees).toBe(599);
    expect(putData.settings.free_shipping_threshold_paise).toBe(59900);
  });

  it("tests shiprocket connection via dedicated endpoint", async () => {
    const res = await testConnection(new Request("http://localhost/api/admin/settings/shipping/verify-connection", {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ops@teafloww.com", password: "password" }),
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("queries courier serviceability via dedicated endpoint", async () => {
    const res = await checkServiceability(new Request("http://localhost/api/admin/settings/shipping/check-serviceability", {
      method: "POST",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({ pincode: "700001", weightKg: 0.5 }),
    }));

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.serviceable).toBe(true);
    expect(data.couriers.length).toBeGreaterThan(0);
  });

  it("reads and updates payment settings", async () => {
    const getRes = await getPayment(new Request("http://localhost/api/admin/settings/payment", {
      headers: { Cookie: adminCookie },
    }));
    expect(getRes.status).toBe(200);

    const putRes = await putPayment(new Request("http://localhost/api/admin/settings/payment", {
      method: "PUT",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        razorpay_enabled: true,
        razorpay_key_id: "rzp_live_abc123",
        razorpay_key_secret: "secret_xyz",
        razorpay_webhook_secret: "wh_secret_xyz",
        cod_enabled: true,
        cod_fee_rupees: 0,
        cod_min_rupees: 0,
        cod_max_rupees: 2000,
      }),
    }));

    expect(putRes.status).toBe(200);
    const putData = await putRes.json();
    expect(putData.settings.razorpay_key_id).toBe("rzp_live_abc123");
    expect(putData.settings.razorpay_key_secret).toBe("••••••••••••");
  });

  it("switches payment gateway between test and production environments", async () => {
    // 1. Configure both test and production keys
    const putRes = await putPayment(new Request("http://localhost/api/admin/settings/payment", {
      method: "PUT",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_mode: "test",
        razorpay_enabled: true,
        razorpay_test_key_id: "rzp_test_999888",
        razorpay_test_key_secret: "test_secret_123",
        razorpay_test_webhook_secret: "test_wh_123",
        razorpay_prod_key_id: "rzp_live_111222",
        razorpay_prod_key_secret: "prod_secret_456",
        razorpay_prod_webhook_secret: "prod_wh_456",
      }),
    }));

    expect(putRes.status).toBe(200);
    const data = await putRes.json();
    expect(data.settings.payment_mode).toBe("test");
    expect(data.settings.active_key_id).toBe("rzp_test_999888");

    // 2. Switch to production mode
    const putProdRes = await putPayment(new Request("http://localhost/api/admin/settings/payment", {
      method: "PUT",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_mode: "production",
        razorpay_enabled: true,
      }),
    }));

    expect(putProdRes.status).toBe(200);
    const prodData = await putProdRes.json();
    expect(prodData.settings.payment_mode).toBe("production");
    expect(prodData.settings.active_key_id).toBe("rzp_live_111222");
  });

  it("switches shipping mode and dispatch trigger between manual and auto", async () => {
    const putRes = await putShipping(new Request("http://localhost/api/admin/settings/shipping", {
      method: "PUT",
      headers: { Cookie: adminCookie, "Content-Type": "application/json" },
      body: JSON.stringify({
        free_shipping_threshold_rupees: 599,
        shipping_flat_fee_rupees: 99,
        shipping_calculation_mode: "flat",
        dispatch_commitment: "Dispatched within 24 hours",
        announcement_auto_sync: true,
        shiprocket_enabled: true,
        shiprocket_mode: "production",
        shiprocket_order_creation_mode: "auto",
        shiprocket_prod_email: "prod_logistics@teafloww.com",
        shiprocket_prod_password: "prod_password_123",
        shiprocket_pickup_location: "Primary",
        shiprocket_pickup_postcode: "734015",
        shiprocket_default_length: 12,
        shiprocket_default_breadth: 12,
        shiprocket_default_height: 12,
        shiprocket_default_tare_grams: 150,
        shiprocket_default_hsn: "090230",
      }),
    }));

    expect(putRes.status).toBe(200);
    const data = await putRes.json();
    expect(data.settings.shiprocket_mode).toBe("production");
    expect(data.settings.shiprocket_order_creation_mode).toBe("auto");
    expect(data.settings.active_email).toBe("prod_logistics@teafloww.com");
  });

  it("executes 1-click Shiprocket preparation for an order via route handler", async () => {
    const db = getDb();
    const orderId = `route-ord-${Date.now()}`;
    const key = `idem-route-${Date.now()}`;

    db.prepare(`
      INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise, status, payment_status, dispatch_status)
      VALUES (?, ?, 'Route Tester', 'route@example.com', 'Lane 1, Siliguri, 734001', 60000, 0, 60000, 'paid', 'paid', 'unfulfilled')
    `).run(orderId, key);

    const postRes = await postShiprocket(
      new Request(`http://localhost/api/admin/orders/${orderId}/shiprocket`, {
        method: "POST",
        headers: { Cookie: adminCookie, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare_full" }),
      }),
      { params: Promise.resolve({ id: orderId }) }
    );

    expect(postRes.status).toBe(200);
    const data = await postRes.json();
    expect(data.shipment.awbCode).toBeTruthy();
    expect(data.shipment.labelUrl).toContain(".pdf");

    // Test GET returns prepared shipment info
    const getRes = await getShiprocket(
      new Request(`http://localhost/api/admin/orders/${orderId}/shiprocket`, {
        headers: { Cookie: adminCookie },
      }),
      { params: Promise.resolve({ id: orderId }) }
    );

    expect(getRes.status).toBe(200);
    const getData = await getRes.json();
    expect(getData.shipment.awbCode).toBe(data.shipment.awbCode);
    expect(getData.shipment.labelUrl).toBe(data.shipment.labelUrl);
  });
});
