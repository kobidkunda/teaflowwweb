import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";

export const customerAddressSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s-]{10,20}$/, "Please enter a valid contact phone number."),
  address_line1: z
    .string()
    .trim()
    .min(3, "Address line 1 is required.")
    .max(150),
  address_line2: z.string().trim().max(150).optional().default(""),
  landmark: z.string().trim().max(100).optional().default(""),
  city: z.string().trim().min(2, "City is required.").max(100),
  state: z.string().trim().min(2, "State is required.").max(100),
  postal_code: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit Indian PIN code (e.g. 734001)."),
  country: z.string().trim().max(10).default("IN"),
  is_default: z.boolean().optional().default(false),
});

export type CustomerAddressInput = z.input<typeof customerAddressSchema>;

export type CustomerAddress = {
  id: string;
  customer_id: string;
  name: string;
  phone: string;
  address_line1: string;
  address_line2: string;
  landmark: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  is_default: number;
  created_at: string;
  updated_at: string;
};

export function listCustomerAddresses(customerId: string): CustomerAddress[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM customer_addresses
       WHERE customer_id = ?
       ORDER BY is_default DESC, created_at DESC`
    )
    .all(customerId) as CustomerAddress[];
}

export function getCustomerAddress(
  customerId: string,
  addressId: string
): CustomerAddress | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM customer_addresses WHERE id = ? AND customer_id = ?")
    .get(addressId, customerId) as CustomerAddress | undefined;
  return row || null;
}

export function createCustomerAddress(
  customerId: string,
  raw: CustomerAddressInput
): CustomerAddress {
  const input = customerAddressSchema.parse(raw);
  const db = getDb();

  return db.transaction(() => {
    // Check if this is the first address, auto-make it default
    const countRow = db
      .prepare("SELECT COUNT(*) as count FROM customer_addresses WHERE customer_id = ?")
      .get(customerId) as { count: number };

    const shouldBeDefault = input.is_default || countRow.count === 0;

    if (shouldBeDefault) {
      db.prepare(
        "UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?"
      ).run(customerId);
    }

    const id = randomUUID();
    db.prepare(
      `INSERT INTO customer_addresses (
        id, customer_id, name, phone, address_line1, address_line2, landmark,
        city, state, postal_code, country, is_default, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(
      id,
      customerId,
      input.name,
      input.phone,
      input.address_line1,
      input.address_line2 || "",
      input.landmark || "",
      input.city,
      input.state,
      input.postal_code,
      input.country || "IN",
      shouldBeDefault ? 1 : 0
    );

    return getCustomerAddress(customerId, id)!;
  })();
}

export function updateCustomerAddress(
  customerId: string,
  addressId: string,
  raw: Partial<CustomerAddressInput>
): CustomerAddress {
  const db = getDb();
  const existing = getCustomerAddress(customerId, addressId);
  if (!existing) throw new Error("Address not found.");

  const merged = {
    name: raw.name ?? existing.name,
    phone: raw.phone ?? existing.phone,
    address_line1: raw.address_line1 ?? existing.address_line1,
    address_line2: raw.address_line2 ?? existing.address_line2,
    landmark: raw.landmark ?? existing.landmark,
    city: raw.city ?? existing.city,
    state: raw.state ?? existing.state,
    postal_code: raw.postal_code ?? existing.postal_code,
    country: raw.country ?? existing.country,
    is_default: raw.is_default !== undefined ? raw.is_default : Boolean(existing.is_default),
  };

  const input = customerAddressSchema.parse(merged);

  return db.transaction(() => {
    if (input.is_default) {
      db.prepare(
        "UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?"
      ).run(customerId);
    }

    db.prepare(
      `UPDATE customer_addresses
       SET name = ?, phone = ?, address_line1 = ?, address_line2 = ?,
           landmark = ?, city = ?, state = ?, postal_code = ?,
           country = ?, is_default = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND customer_id = ?`
    ).run(
      input.name,
      input.phone,
      input.address_line1,
      input.address_line2 || "",
      input.landmark || "",
      input.city,
      input.state,
      input.postal_code,
      input.country || "IN",
      input.is_default ? 1 : 0,
      addressId,
      customerId
    );

    return getCustomerAddress(customerId, addressId)!;
  })();
}

export function deleteCustomerAddress(customerId: string, addressId: string): boolean {
  const db = getDb();
  return db.transaction(() => {
    const target = getCustomerAddress(customerId, addressId);
    if (!target) return false;

    db.prepare("DELETE FROM customer_addresses WHERE id = ? AND customer_id = ?").run(
      addressId,
      customerId
    );

    // If deleted address was default, promote another address to default
    if (target.is_default === 1) {
      const remaining = db
        .prepare(
          "SELECT id FROM customer_addresses WHERE customer_id = ? ORDER BY created_at DESC LIMIT 1"
        )
        .get(customerId) as { id: string } | undefined;
      if (remaining) {
        db.prepare(
          "UPDATE customer_addresses SET is_default = 1 WHERE id = ?"
        ).run(remaining.id);
      }
    }
    return true;
  })();
}

export function setDefaultCustomerAddress(
  customerId: string,
  addressId: string
): CustomerAddress {
  const db = getDb();
  return db.transaction(() => {
    const target = getCustomerAddress(customerId, addressId);
    if (!target) throw new Error("Address not found.");

    db.prepare("UPDATE customer_addresses SET is_default = 0 WHERE customer_id = ?").run(
      customerId
    );
    db.prepare(
      "UPDATE customer_addresses SET is_default = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND customer_id = ?"
    ).run(addressId, customerId);

    return getCustomerAddress(customerId, addressId)!;
  })();
}
