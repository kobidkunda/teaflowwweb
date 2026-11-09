import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getShiprocketConfig,
  testShiprocketConnection,
  checkPincodeServiceability,
  prepareFullShiprocketShipment,
} from "@/lib/shiprocket";
import { getDb } from "@/lib/db";

describe("Shiprocket Logistics Engine & 1-Click Label Preparation", () => {
  beforeEach(() => {
    vi.stubEnv("COMMERCE_MOCK_PROVIDERS", "1");
    const db = getDb();
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('shiprocket_pickup_postcode', '734015')").run();
    db.prepare("INSERT OR REPLACE INTO store_settings (key, value) VALUES ('shiprocket_default_length', '10')").run();
  });

  it("reads shiprocket configuration defaults", () => {
    const config = getShiprocketConfig();
    expect(config.pickupPostcode).toBe("734015");
    expect(config.defaultLength).toBe(10);
    expect(config.defaultHsn).toBe("090230");
  });

  it("tests shiprocket connection in mock mode", async () => {
    const res = await testShiprocketConnection("test@teafloww.com", "dummy_pass");
    expect(res.success).toBe(true);
    expect(res.message).toContain("Shiprocket");
  });

  it("queries courier serviceability for Indian PIN codes", async () => {
    const res = await checkPincodeServiceability("700001", 0.5, false);
    expect(res.serviceable).toBe(true);
    expect(res.couriers.length).toBeGreaterThan(0);
    expect(res.couriers[0].name).toBeTruthy();
    expect(res.couriers[0].rate).toBeGreaterThan(0);
  });

  it("prepares full 1-click Shiprocket shipment with AWB and printable PDF label", async () => {
    const db = getDb();

    // Create a demo paid order
    const orderId = `test-ord-${Date.now()}`;
    const key = `idem-${Date.now()}`;
    db.prepare(`
      INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise, status, payment_status, dispatch_status)
      VALUES (?, ?, 'Test Customer', 'customer@example.com', 'Flat 4A, Park Street, Kolkata, West Bengal - 700016, India', 85000, 0, 85000, 'paid', 'paid', 'unfulfilled')
    `).run(orderId, key);

    const shipment = await prepareFullShiprocketShipment(orderId, "admin-test");

    expect(shipment.orderId).toBe(orderId);
    expect(shipment.shipmentId).toBeTruthy();
    expect(shipment.awbCode).toMatch(/^AWB/);
    expect(shipment.labelUrl).toContain(".pdf");
    expect(shipment.pickupToken).toContain("PU-");
    expect(shipment.courierName).toContain("Delhivery");

    // Check order dispatch status was updated to shipped
    const updated = db.prepare("SELECT dispatch_status FROM orders WHERE id=?").get(orderId) as { dispatch_status: string };
    expect(updated.dispatch_status).toBe("shipped");
  });

  it("rejects preparing shipment for unpaid orders", async () => {
    const db = getDb();
    const orderId = `unpaid-ord-${Date.now()}`;
    const key = `idem-unpaid-${Date.now()}`;
    db.prepare(`
      INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise, status, payment_status, dispatch_status)
      VALUES (?, ?, 'Unpaid Customer', 'unpaid@example.com', 'Address, 700001', 50000, 9900, 59900, 'unpaid', 'unpaid', 'unfulfilled')
    `).run(orderId, key);

    await expect(prepareFullShiprocketShipment(orderId, "admin")).rejects.toThrow("Only paid or approved COD orders");
  });
});
