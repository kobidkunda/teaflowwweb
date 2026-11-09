import { z } from "zod";
import { getDb } from "@/lib/db";

export const shippingSettingsSchema = z.object({
  min_delivery_order_rupees: z.coerce.number().min(0).default(0),
  free_shipping_threshold_rupees: z.coerce.number().min(0, "Free shipping threshold cannot be negative"),
  free_shipping_enabled: z.boolean().default(true),
  shipping_flat_fee_rupees: z.coerce.number().min(0, "Shipping fee cannot be negative"),
  shipping_calculation_mode: z.enum(["flat", "live"]).default("flat"),
  dispatch_commitment: z.string().max(200).default("24-48 hours from Siliguri hub"),
  announcement_auto_sync: z.boolean().default(true),
  // Cash on Delivery (COD) Rules
  cod_enabled: z.boolean().default(true),
  cod_fee_rupees: z.coerce.number().min(0).default(50),
  cod_min_rupees: z.coerce.number().min(0).default(100),
  cod_max_rupees: z.coerce.number().min(0).default(5000),
  cod_postcodes: z.union([
    z.array(z.string().regex(/^\d{6}$/, "Must be a 6-digit Indian PIN code")),
    z.string().transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter((s) => /^\d{6}$/.test(s))
    ),
  ]).default([]),
  cod_blocked_skus: z.union([
    z.array(z.string().max(100)),
    z.string().transform((v) =>
      v
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    ),
  ]).default([]),
  // Environment & Dispatch Trigger
  shiprocket_mode: z.enum(["test", "production"]).default("test"),
  shiprocket_order_creation_mode: z.enum(["manual", "auto"]).default("manual"),
  // Shiprocket Logistics
  shiprocket_enabled: z.boolean().default(true),
  shiprocket_email: z.string().max(120).optional(),
  shiprocket_password: z.string().max(200).optional(),
  // Dedicated Test credentials
  shiprocket_test_email: z.string().max(120).optional(),
  shiprocket_test_password: z.string().max(200).optional(),
  // Dedicated Production credentials
  shiprocket_prod_email: z.string().max(120).optional(),
  shiprocket_prod_password: z.string().max(200).optional(),
  // Warehouse & Dimensions
  shiprocket_pickup_location: z.string().min(1).max(100).default("Primary"),
  shiprocket_pickup_postcode: z.string().regex(/^\d{6}$/, "Must be a 6-digit Indian PIN code").default("734015"),
  shiprocket_default_length: z.coerce.number().positive().max(200).default(10),
  shiprocket_default_breadth: z.coerce.number().positive().max(200).default(10),
  shiprocket_default_height: z.coerce.number().positive().max(200).default(10),
  shiprocket_default_tare_grams: z.coerce.number().int().min(0).max(10000).default(100),
  shiprocket_default_hsn: z.string().regex(/^\d{6,10}$/, "Invalid HSN code").default("090230"),
});

export type ShippingSettingsInput = z.infer<typeof shippingSettingsSchema>;

export type ShippingSettings = ShippingSettingsInput & {
  min_delivery_order_paise: number;
  free_shipping_threshold_paise: number;
  shipping_flat_fee_paise: number;
  cod_fee_paise: number;
  cod_min_paise: number;
  cod_max_paise: number;
  active_email: string;
  active_password_configured: boolean;
  shiprocket_password_configured: boolean;
  shiprocket_test_password_configured: boolean;
  shiprocket_prod_password_configured: boolean;
};

export function getActiveShiprocketCredentials(): {
  mode: "test" | "production";
  orderCreationMode: "manual" | "auto";
  email: string;
  password: string;
  pickupLocation: string;
  pickupPostcode: string;
  defaultLength: number;
  defaultBreadth: number;
  defaultHeight: number;
  defaultTareGrams: number;
  defaultHsn: string;
} {
  let mode: "test" | "production" = "test";
  let orderCreationMode: "manual" | "auto" = "manual";
  let email = "";
  let password = "";
  let pickupLocation = "Primary";
  let pickupPostcode = "734015";
  let defaultLength = 10;
  let defaultBreadth = 10;
  let defaultHeight = 10;
  let defaultTareGrams = 100;
  let defaultHsn = "090230";

  try {
    const db = getDb();
    const rows = db
      .prepare("SELECT key, value FROM store_settings WHERE key LIKE 'shiprocket_%'")
      .all() as Array<{ key: string; value: string }>;
    const map = new Map(rows.map((r) => [r.key, r.value]));

    const dbMode = map.get("shiprocket_mode") as "test" | "production" | undefined;
    const envMode = process.env.SHIPROCKET_MODE as "test" | "production" | undefined;
    mode = dbMode || envMode || (process.env.COMMERCE_MOCK_PROVIDERS === "1" ? "test" : "test");

    const dbTrigger = map.get("shiprocket_order_creation_mode") as "manual" | "auto" | undefined;
    const envTrigger = process.env.SHIPROCKET_ORDER_CREATION_MODE as "manual" | "auto" | undefined;
    orderCreationMode = dbTrigger || envTrigger || "manual";

    pickupLocation = map.get("shiprocket_pickup_location") || "Primary";
    pickupPostcode = map.get("shiprocket_pickup_postcode") || "734015";
    defaultLength = Number(map.get("shiprocket_default_length")) || 10;
    defaultBreadth = Number(map.get("shiprocket_default_breadth")) || 10;
    defaultHeight = Number(map.get("shiprocket_default_height")) || 10;
    defaultTareGrams = Number(map.get("shiprocket_default_tare_grams")) || 100;
    defaultHsn = map.get("shiprocket_default_hsn") || "090230";

    if (mode === "test") {
      email = map.get("shiprocket_test_email") || process.env.SHIPROCKET_TEST_EMAIL || map.get("shiprocket_email") || process.env.SHIPROCKET_EMAIL || "";
      password = map.get("shiprocket_test_password") || process.env.SHIPROCKET_TEST_PASSWORD || map.get("shiprocket_password") || process.env.SHIPROCKET_PASSWORD || "";
    } else {
      email = map.get("shiprocket_prod_email") || process.env.SHIPROCKET_PROD_EMAIL || map.get("shiprocket_email") || process.env.SHIPROCKET_EMAIL || "";
      password = map.get("shiprocket_prod_password") || process.env.SHIPROCKET_PROD_PASSWORD || map.get("shiprocket_password") || process.env.SHIPROCKET_PASSWORD || "";
    }
  } catch {
    const envMode = (process.env.SHIPROCKET_MODE as "test" | "production") || "test";
    mode = envMode;
    orderCreationMode = (process.env.SHIPROCKET_ORDER_CREATION_MODE as "manual" | "auto") || "manual";
    if (mode === "test") {
      email = process.env.SHIPROCKET_TEST_EMAIL || process.env.SHIPROCKET_EMAIL || "";
      password = process.env.SHIPROCKET_TEST_PASSWORD || process.env.SHIPROCKET_PASSWORD || "";
    } else {
      email = process.env.SHIPROCKET_PROD_EMAIL || process.env.SHIPROCKET_EMAIL || "";
      password = process.env.SHIPROCKET_PROD_PASSWORD || process.env.SHIPROCKET_PASSWORD || "";
    }
  }

  return {
    mode,
    orderCreationMode,
    email,
    password,
    pickupLocation,
    pickupPostcode,
    defaultLength,
    defaultBreadth,
    defaultHeight,
    defaultTareGrams,
    defaultHsn,
  };
}

import { getDeliverySettings, updateDeliverySettings, type DeliverySettings, type DeliverySettingsInput } from "@/lib/deliverySettings";

export function getShippingSettings(): ShippingSettings {
  return getDeliverySettings();
}

export function updateShippingSettings(rawInput: unknown): ShippingSettings {
  const result = updateDeliverySettings(rawInput);
  const parsed = shippingSettingsSchema.parse(rawInput);
  const db = getDb();

  // Synchronize package config in commerce_config if dimensions/hsn are provided
  try {
    const pkg = {
      pickupPostcode: parsed.shiprocket_pickup_postcode,
      pickupLocation: parsed.shiprocket_pickup_location,
      length: parsed.shiprocket_default_length,
      breadth: parsed.shiprocket_default_breadth,
      height: parsed.shiprocket_default_height,
      tareGrams: parsed.shiprocket_default_tare_grams,
      maxGrams: 50000,
      hsn: parsed.shiprocket_default_hsn,
      origin: "IN",
    };
    db.prepare(`
      INSERT INTO commerce_config (key, document)
      VALUES ('package', ?)
      ON CONFLICT(key) DO UPDATE SET document = excluded.document
    `).run(JSON.stringify(pkg));
  } catch {}

  return result;
}
