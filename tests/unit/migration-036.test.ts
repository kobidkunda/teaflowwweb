import { describe, it, expect } from "vitest";
import { getDb } from "@/lib/db";

describe("Database Migration 036 — Customer Schema Parity", () => {
  it("has customers, customer_sessions, customer_addresses tables and customer_id on orders", () => {
    const db = getDb();

    // Verify customers table
    const customersCols = (
      db.prepare("PRAGMA table_info(customers)").all() as { name: string }[]
    ).map((c) => c.name);
    expect(customersCols).toContain("id");
    expect(customersCols).toContain("email");
    expect(customersCols).toContain("password_hash");
    expect(customersCols).toContain("is_active");

    // Verify customer_sessions table
    const sessionCols = (
      db.prepare("PRAGMA table_info(customer_sessions)").all() as { name: string }[]
    ).map((c) => c.name);
    expect(sessionCols).toContain("token_hash");
    expect(sessionCols).toContain("customer_id");
    expect(sessionCols).toContain("expires_at");

    // Verify customer_addresses table
    const addressCols = (
      db.prepare("PRAGMA table_info(customer_addresses)").all() as { name: string }[]
    ).map((c) => c.name);
    expect(addressCols).toContain("id");
    expect(addressCols).toContain("customer_id");
    expect(addressCols).toContain("name");
    expect(addressCols).toContain("phone");
    expect(addressCols).toContain("address_line1");
    expect(addressCols).toContain("city");
    expect(addressCols).toContain("state");
    expect(addressCols).toContain("postal_code");
    expect(addressCols).toContain("is_default");

    // Verify orders table has customer_id
    const orderCols = (
      db.prepare("PRAGMA table_info(orders)").all() as { name: string }[]
    ).map((c) => c.name);
    expect(orderCols).toContain("customer_id");
  });
});
