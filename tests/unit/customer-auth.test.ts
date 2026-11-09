import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import {
  registerCustomer,
  authenticateCustomer,
  quickDemoCustomerLogin,
  CustomerAuthError,
} from "@/lib/customerAuth";
import {
  verifyCustomerSessionValue,
} from "@/lib/customerSessions";
import { randomUUID } from "node:crypto";

describe("Customer Authentication & Session Management", () => {
  beforeEach(() => {
    const db = getDb();
    // Clean test customer entries
    db.prepare("DELETE FROM customers WHERE email LIKE '%@test-auth.com'").run();
  });

  it("registers a new customer with scrypt password hashing and returns session", () => {
    const email = `ananya.${Date.now()}@test-auth.com`;
    const res = registerCustomer({
      email,
      password: "HimalayanSecret99!",
      name: "Ananya Roy",
      phone: "+91 98765 11111",
    });

    expect(res.customer).toBeDefined();
    expect(res.customer.email).toBe(email);
    expect(res.customer.name).toBe("Ananya Roy");
    expect(res.cookieValue).toBeDefined();
    expect(res.cookieValue).toContain(".");

    // Verify session
    const verified = verifyCustomerSessionValue(res.cookieValue);
    expect(verified).not.toBeNull();
    expect(verified?.id).toBe(res.customer.id);
    expect(verified?.email).toBe(email);
  });

  it("rejects duplicate registration with identical email", () => {
    const email = `dup.${Date.now()}@test-auth.com`;
    registerCustomer({
      email,
      password: "HimalayanSecret99!",
      name: "User One",
    });

    expect(() =>
      registerCustomer({
        email,
        password: "AnotherPassword123!",
        name: "User Two",
      })
    ).toThrow(CustomerAuthError);
  });

  it("authenticates an existing customer with correct password and rejects invalid password", () => {
    const email = `login.${Date.now()}@test-auth.com`;
    registerCustomer({
      email,
      password: "CorrectPassword123",
      name: "Login Test",
    });

    const success = authenticateCustomer({
      identifier: email,
      password: "CorrectPassword123",
    });
    expect(success.customer.email).toBe(email);

    expect(() =>
      authenticateCustomer({
        identifier: email,
        password: "WrongPassword999",
      })
    ).toThrow(CustomerAuthError);
  });

  it("creates and verifies the quick demo tasting room account", () => {
    const demo = quickDemoCustomerLogin();
    expect(demo.customer.email).toBe("tasting.room@teafloww.com");
    expect(demo.cookieValue).toBeDefined();

    const verified = verifyCustomerSessionValue(demo.cookieValue);
    expect(verified?.email).toBe("tasting.room@teafloww.com");
  });

  it("automatically links past guest orders when customer registers", () => {
    const db = getDb();
    const guestEmail = `guest.${Date.now()}@test-auth.com`;
    const orderId = randomUUID();

    // Insert guest order without customer_id
    db.prepare(
      `INSERT INTO orders (id, idempotency_key, customer_name, customer_email, shipping_address, subtotal_paise, shipping_paise, total_paise, status)
       VALUES (?, ?, 'Guest Buyer', ?, 'Siliguri, WB', 50000, 0, 50000, 'demo_unpaid')`
    ).run(orderId, randomUUID(), guestEmail);

    // Register with same email
    const reg = registerCustomer({
      email: guestEmail,
      password: "SecurePassword123!",
      name: "Converted Buyer",
    });

    const updatedOrder = db
      .prepare("SELECT customer_id FROM orders WHERE id = ?")
      .get(orderId) as { customer_id: string };

    expect(updatedOrder.customer_id).toBe(reg.customer.id);
  });
});
