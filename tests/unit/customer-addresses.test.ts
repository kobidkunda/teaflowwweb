import { describe, it, expect, beforeEach } from "vitest";
import { getDb } from "@/lib/db";
import {
  listCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
} from "@/lib/customerAddresses";
import { randomUUID } from "node:crypto";

describe("Customer Address Book", () => {
  const customerId = randomUUID();

  beforeEach(() => {
    const db = getDb();
    // Seed test customer
    db.prepare(
      "INSERT OR IGNORE INTO customers (id, email, name, password_hash) VALUES (?, ?, 'Address Tester', 'hash')"
    ).run(customerId, `addr.${customerId}@test.com`);
    db.prepare("DELETE FROM customer_addresses WHERE customer_id = ?").run(customerId);
  });

  it("creates address and automatically marks first address as default", () => {
    const addr = createCustomerAddress(customerId, {
      name: "Ananya Roy",
      phone: "+91 98765 43210",
      address_line1: "Flat 4B, Hill Cart Residency",
      address_line2: "Pradhan Nagar",
      city: "Siliguri",
      state: "West Bengal",
      postal_code: "734001",
      country: "IN",
    });

    expect(addr.id).toBeDefined();
    expect(addr.is_default).toBe(1);

    const list = listCustomerAddresses(customerId);
    expect(list.length).toBe(1);
    expect(list[0].city).toBe("Siliguri");
  });

  it("handles multiple addresses and allows changing default address", () => {
    const addr1 = createCustomerAddress(customerId, {
      name: "Home",
      phone: "+91 98765 43210",
      address_line1: "House 10, Mall Road",
      city: "Darjeeling",
      state: "West Bengal",
      postal_code: "734101",
    });

    const addr2 = createCustomerAddress(customerId, {
      name: "Office",
      phone: "+91 98765 43210",
      address_line1: "Works 00, Fulbari Bypass",
      city: "Siliguri",
      state: "West Bengal",
      postal_code: "734015",
      is_default: true,
    });

    expect(addr2.is_default).toBe(1);

    const list = listCustomerAddresses(customerId);
    expect(list.length).toBe(2);
    expect(list[0].id).toBe(addr2.id); // Default sorted first

    // Switch default back to addr1
    const updated = setDefaultCustomerAddress(customerId, addr1.id);
    expect(updated.is_default).toBe(1);

    const recheckList = listCustomerAddresses(customerId);
    expect(recheckList[0].id).toBe(addr1.id);
  });

  it("updates an existing address", () => {
    const addr = createCustomerAddress(customerId, {
      name: "Temporary",
      phone: "+91 98765 00000",
      address_line1: "Old Line 1",
      city: "Siliguri",
      state: "West Bengal",
      postal_code: "734005",
    });

    const updated = updateCustomerAddress(customerId, addr.id, {
      name: "Permanent Residence",
      address_line1: "New Line 1",
    });

    expect(updated.name).toBe("Permanent Residence");
    expect(updated.address_line1).toBe("New Line 1");
  });

  it("deletes an address and promotes remaining to default if needed", () => {
    const addr1 = createCustomerAddress(customerId, {
      name: "Addr 1",
      phone: "+91 98765 11111",
      address_line1: "Street 1",
      city: "Siliguri",
      state: "West Bengal",
      postal_code: "734001",
      is_default: true,
    });

    const addr2 = createCustomerAddress(customerId, {
      name: "Addr 2",
      phone: "+91 98765 22222",
      address_line1: "Street 2",
      city: "Siliguri",
      state: "West Bengal",
      postal_code: "734001",
    });

    deleteCustomerAddress(customerId, addr1.id);

    const remaining = listCustomerAddresses(customerId);
    expect(remaining.length).toBe(1);
    expect(remaining[0].id).toBe(addr2.id);
    expect(remaining[0].is_default).toBe(1);
  });
});
