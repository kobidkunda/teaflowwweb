import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { hashPassword, verifyPassword, verifyDummy } from "@/lib/password";
import {
  createCustomerSession,
  type SafeCustomer,
} from "./customerSessions";

export const customerRegisterSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address.")
    .max(120),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters long.")
    .max(128),
  name: z.string().trim().max(100).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s-]{10,20}$/, "Please enter a valid contact phone number.")
    .optional()
    .or(z.literal("")),
});

export const customerLoginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, "Enter your email or phone number."),
  password: z.string().trim().min(1, "Password is required."),
});

export type CustomerRegisterInput = z.infer<typeof customerRegisterSchema>;
export type CustomerLoginInput = z.infer<typeof customerLoginSchema>;

export class CustomerAuthError extends Error {
  constructor(message: string, public code = 400) {
    super(message);
    this.name = "CustomerAuthError";
  }
}

/**
 * Links any past guest orders placed with this email or phone to the customer ID.
 */
export function linkPastGuestOrders(customerId: string, email: string, phone?: string | null) {
  const db = getDb();
  try {
    const cleanEmail = email.trim().toLowerCase();
    const cleanPhone = phone?.trim();

    if (cleanPhone) {
      db.prepare(
        "UPDATE orders SET customer_id = ? WHERE (LOWER(customer_email) = ? OR customer_phone = ?) AND (customer_id IS NULL OR customer_id = '')"
      ).run(customerId, cleanEmail, cleanPhone);
    } else {
      db.prepare(
        "UPDATE orders SET customer_id = ? WHERE LOWER(customer_email) = ? AND (customer_id IS NULL OR customer_id = '')"
      ).run(customerId, cleanEmail);
    }
  } catch {
    /* non-blocking */
  }
}

/**
 * Registers a new customer and returns their profile with session cookie value.
 */
export function registerCustomer(raw: CustomerRegisterInput): {
  customer: SafeCustomer;
  cookieValue: string;
  expiresAt: string;
} {
  const input = customerRegisterSchema.parse(raw);
  const db = getDb();

  const existing = db
    .prepare("SELECT id FROM customers WHERE email = ?")
    .get(input.email) as { id: string } | undefined;

  if (existing) {
    throw new CustomerAuthError("An account with this email already exists. Please sign in instead.", 409);
  }

  const id = randomUUID();
  const passwordHash = hashPassword(input.password);
  const phone = input.phone && input.phone.trim() ? input.phone.trim() : null;
  const name = input.name && input.name.trim() ? input.name.trim() : null;

  db.prepare(
    `INSERT INTO customers (id, email, phone, name, password_hash, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).run(id, input.email, phone, name, passwordHash);

  // Link any past orders placed with this email/phone
  linkPastGuestOrders(id, input.email, phone);

  const customer: SafeCustomer = {
    id,
    email: input.email,
    name,
    phone,
    created_at: new Date().toISOString(),
  };

  const { cookieValue, expiresAt } = createCustomerSession(id);
  return { customer, cookieValue, expiresAt };
}

/**
 * Authenticates an existing customer via email or phone.
 */
export function authenticateCustomer(raw: CustomerLoginInput): {
  customer: SafeCustomer;
  cookieValue: string;
  expiresAt: string;
} {
  const input = customerLoginSchema.parse(raw);
  const db = getDb();

  const row = db
    .prepare(
      `SELECT id, email, phone, name, password_hash, is_active, created_at
       FROM customers
       WHERE email = ? OR (phone IS NOT NULL AND phone = ?)`
    )
    .get(input.identifier, input.identifier) as
    | {
        id: string;
        email: string;
        phone: string | null;
        name: string | null;
        password_hash: string | null;
        is_active: number;
        created_at: string;
      }
    | undefined;

  if (!row || !row.password_hash || row.is_active !== 1) {
    verifyDummy(input.password);
    throw new CustomerAuthError("Invalid credentials. Please verify your details.", 401);
  }

  const matches = verifyPassword(input.password, row.password_hash);
  if (!matches) {
    throw new CustomerAuthError("Invalid credentials. Please verify your details.", 401);
  }

  // Ensure past guest orders with this email/phone are linked
  linkPastGuestOrders(row.id, row.email, row.phone);

  const customer: SafeCustomer = {
    id: row.id,
    email: row.email,
    name: row.name,
    phone: row.phone,
    created_at: row.created_at,
  };

  const { cookieValue, expiresAt } = createCustomerSession(row.id);
  return { customer, cookieValue, expiresAt };
}

/**
 * Instant Demo Login for testing and seamless review.
 */
export function quickDemoCustomerLogin(): {
  customer: SafeCustomer;
  cookieValue: string;
  expiresAt: string;
} {
  const demoEmail = "tasting.room@teafloww.com";
  const demoName = "Darjeeling Connoisseur";
  const demoPhone = "+91 98765 43210";
  const db = getDb();

  let customerRow = db
    .prepare("SELECT id, email, phone, name, created_at FROM customers WHERE email = ?")
    .get(demoEmail) as SafeCustomer | undefined;

  if (!customerRow) {
    const id = randomUUID();
    const hash = hashPassword("HimalayanTea@2026");
    db.prepare(
      `INSERT INTO customers (id, email, phone, name, password_hash, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(id, demoEmail, demoPhone, demoName, hash);

    // Also seed a default sample address for the demo user
    db.prepare(
      `INSERT INTO customer_addresses (id, customer_id, name, phone, address_line1, address_line2, landmark, city, state, postal_code, country, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'IN', 1)`
    ).run(
      randomUUID(),
      id,
      demoName,
      demoPhone,
      "Heritage Tea Bungalow, Hill Cart Road",
      "Suite 4B",
      "Near Siliguri Junction",
      "Siliguri",
      "West Bengal",
      "734001"
    );

    customerRow = {
      id,
      email: demoEmail,
      name: demoName,
      phone: demoPhone,
      created_at: new Date().toISOString(),
    };
  }

  // Link any demo orders
  linkPastGuestOrders(customerRow.id, demoEmail, demoPhone);

  const { cookieValue, expiresAt } = createCustomerSession(customerRow.id);
  return { customer: customerRow, cookieValue, expiresAt };
}
