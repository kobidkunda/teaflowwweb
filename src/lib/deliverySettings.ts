import { z } from "zod";
import { getDb } from "@/lib/db";
import { getActiveShiprocketCredentials } from "@/lib/shippingSettings";

export const deliverySettingsSchema = z.object({
  // Delivery Orders & Rates
  min_delivery_order_rupees: z.coerce.number().min(0, "Minimum delivery order cannot be negative").default(0),
  shipping_flat_fee_rupees: z.coerce.number().min(0, "Delivery fee cannot be negative").default(99),
  free_shipping_threshold_rupees: z.coerce.number().min(0, "Free delivery threshold cannot be negative").default(599),
  free_shipping_enabled: z.boolean().default(true),
  shipping_calculation_mode: z.enum(["flat", "live"]).default("flat"),
  dispatch_commitment: z.string().max(200).default("24-48 hours from Siliguri hub"),
  announcement_auto_sync: z.boolean().default(true),

  // Cash on Delivery (COD) Rules
  cod_enabled: z.boolean().default(true),
  cod_fee_rupees: z.coerce.number().min(0, "COD fee cannot be negative").default(50),
  cod_min_rupees: z.coerce.number().min(0, "COD minimum cannot be negative").default(100),
  cod_max_rupees: z.coerce.number().min(0, "COD maximum cannot be negative").default(5000),
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

  // Shiprocket Environment & Logistics (Carrier automation)
  shiprocket_mode: z.enum(["test", "production"]).default("test"),
  shiprocket_order_creation_mode: z.enum(["manual", "auto"]).default("manual"),
  shiprocket_enabled: z.boolean().default(true),
  shiprocket_email: z.string().max(120).optional(),
  shiprocket_password: z.string().max(200).optional(),
  shiprocket_test_email: z.string().max(120).optional(),
  shiprocket_test_password: z.string().max(200).optional(),
  shiprocket_prod_email: z.string().max(120).optional(),
  shiprocket_prod_password: z.string().max(200).optional(),
  shiprocket_pickup_location: z.string().min(1).max(100).default("Primary"),
  shiprocket_pickup_postcode: z.string().regex(/^\d{6}$/, "Must be a 6-digit Indian PIN code").default("734015"),
  shiprocket_default_length: z.coerce.number().positive().max(200).default(10),
  shiprocket_default_breadth: z.coerce.number().positive().max(200).default(10),
  shiprocket_default_height: z.coerce.number().positive().max(200).default(10),
  shiprocket_default_tare_grams: z.coerce.number().int().min(0).max(10000).default(100),
  shiprocket_default_hsn: z.string().regex(/^\d{6,10}$/, "Invalid HSN code").default("090230"),
});

export type DeliverySettingsInput = z.infer<typeof deliverySettingsSchema>;

export type DeliverySettings = DeliverySettingsInput & {
  min_delivery_order_paise: number;
  shipping_flat_fee_paise: number;
  free_shipping_threshold_paise: number;
  cod_fee_paise: number;
  cod_min_paise: number;
  cod_max_paise: number;
  active_email: string;
  active_password_configured: boolean;
  shiprocket_password_configured: boolean;
  shiprocket_test_password_configured: boolean;
  shiprocket_prod_password_configured: boolean;
};

/**
 * Loads the unified delivery, COD, and shipping configuration from the database.
 * Single authoritative source of truth.
 */
export function getDeliverySettings(): DeliverySettings {
  const db = getDb();
  let rows: Array<{ key: string; value: string }> = [];
  try {
    rows = db.prepare("SELECT key, value FROM store_settings").all() as Array<{
      key: string;
      value: string;
    }>;
  } catch {
    rows = [];
  }
  const map = new Map(rows.map((r) => [r.key, r.value]));

  // Delivery & Free Shipping
  const minDeliveryPaise = Number(map.get("min_delivery_order_paise") || "0");
  const thresholdPaise = Number(
    map.get("free_shipping_threshold_paise") || map.get("free_shipping_threshold") || "59900"
  );
  const flatFeePaise = Number(
    map.get("shipping_flat_fee_paise") || map.get("shipping_fee_paise") || map.get("shipping_flat_paise") || "9900"
  );
  const calculationMode = (map.get("shipping_calculation_mode") || "flat") as "flat" | "live";
  const freeEnabled = map.get("free_shipping_enabled") !== "0";
  const autoSync = map.get("announcement_auto_sync") !== "0";
  const commitment = map.get("dispatch_commitment") || "24-48 hours from Siliguri hub";

  // Cash on Delivery (COD)
  const codEnabled = map.get("cod_enabled") !== "0";
  const codFeePaise = Number(map.get("cod_fee_paise") || "5000");
  const codMinPaise = Number(map.get("cod_min_paise") || "10000");
  const codMaxPaise = Number(map.get("cod_max_paise") || "500000");

  let codPostcodes: string[] = [];
  try {
    const rawPc = map.get("cod_postcodes");
    if (rawPc) codPostcodes = JSON.parse(rawPc);
  } catch {
    codPostcodes = (map.get("cod_postcodes") || "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => /^\d{6}$/.test(s));
  }

  let codBlockedSkus: string[] = [];
  try {
    const rawSkus = map.get("cod_blocked_skus");
    if (rawSkus) codBlockedSkus = JSON.parse(rawSkus);
  } catch {
    codBlockedSkus = (map.get("cod_blocked_skus") || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  const activeCreds = getActiveShiprocketCredentials();

  // Test mode values
  const srTestEmail = map.get("shiprocket_test_email") || process.env.SHIPROCKET_TEST_EMAIL || "";
  const srTestPassword = map.get("shiprocket_test_password") || process.env.SHIPROCKET_TEST_PASSWORD || "";

  // Prod mode values
  const srProdEmail = map.get("shiprocket_prod_email") || process.env.SHIPROCKET_PROD_EMAIL || "";
  const srProdPassword = map.get("shiprocket_prod_password") || process.env.SHIPROCKET_PROD_PASSWORD || "";

  // Legacy fallback
  const srLegacyEmail = map.get("shiprocket_email") || process.env.SHIPROCKET_EMAIL || activeCreds.email;
  const srLegacyPassword = map.get("shiprocket_password") || process.env.SHIPROCKET_PASSWORD || activeCreds.password;

  const srEnabled = map.get("shiprocket_enabled") !== "0";

  return {
    min_delivery_order_rupees: Math.round(minDeliveryPaise / 100),
    min_delivery_order_paise: minDeliveryPaise,

    free_shipping_threshold_rupees: Math.round(thresholdPaise / 100),
    free_shipping_threshold_paise: thresholdPaise,
    free_shipping_enabled: freeEnabled,

    shipping_flat_fee_rupees: Math.round(flatFeePaise / 100),
    shipping_flat_fee_paise: flatFeePaise,

    shipping_calculation_mode: calculationMode,
    dispatch_commitment: commitment,
    announcement_auto_sync: autoSync,

    cod_enabled: codEnabled,
    cod_fee_rupees: Math.round(codFeePaise / 100),
    cod_fee_paise: codFeePaise,
    cod_min_rupees: Math.round(codMinPaise / 100),
    cod_min_paise: codMinPaise,
    cod_max_rupees: Math.round(codMaxPaise / 100),
    cod_max_paise: codMaxPaise,
    cod_postcodes: codPostcodes,
    cod_blocked_skus: codBlockedSkus,

    shiprocket_mode: activeCreds.mode,
    shiprocket_order_creation_mode: activeCreds.orderCreationMode,
    shiprocket_enabled: srEnabled,
    shiprocket_email: srLegacyEmail,
    shiprocket_password: srLegacyPassword ? "••••••••••••" : "",
    shiprocket_password_configured: Boolean(srLegacyPassword),

    shiprocket_test_email: srTestEmail || (activeCreds.mode === "test" ? srLegacyEmail : ""),
    shiprocket_test_password: srTestPassword ? "••••••••••••" : "",
    shiprocket_test_password_configured: Boolean(srTestPassword || (activeCreds.mode === "test" && srLegacyPassword)),

    shiprocket_prod_email: srProdEmail,
    shiprocket_prod_password: srProdPassword ? "••••••••••••" : "",
    shiprocket_prod_password_configured: Boolean(srProdPassword),

    active_email: activeCreds.email,
    active_password_configured: Boolean(activeCreds.password),

    shiprocket_pickup_location: activeCreds.pickupLocation,
    shiprocket_pickup_postcode: activeCreds.pickupPostcode,
    shiprocket_default_length: activeCreds.defaultLength,
    shiprocket_default_breadth: activeCreds.defaultBreadth,
    shiprocket_default_height: activeCreds.defaultHeight,
    shiprocket_default_tare_grams: activeCreds.defaultTareGrams,
    shiprocket_default_hsn: activeCreds.defaultHsn,
  };
}

/**
 * Updates the unified delivery and COD settings atomically.
 * Updates store_settings, keeps commerce_markets ('IN') in 100% sync,
 * and refreshes the announcement banner if auto-sync is enabled.
 */
export function updateDeliverySettings(rawInput: unknown): DeliverySettings {
  const parsed = deliverySettingsSchema.parse(rawInput);
  const db = getDb();

  const minDeliveryPaise = Math.round(parsed.min_delivery_order_rupees * 100);
  const thresholdPaise = Math.round(parsed.free_shipping_threshold_rupees * 100);
  const flatFeePaise = Math.round(parsed.shipping_flat_fee_rupees * 100);
  const codFeePaise = Math.round(parsed.cod_fee_rupees * 100);
  const codMinPaise = Math.round(parsed.cod_min_rupees * 100);
  const codMaxPaise = Math.round(parsed.cod_max_rupees * 100);

  const updates: Array<[string, string]> = [
    ["min_delivery_order_paise", String(minDeliveryPaise)],
    ["free_shipping_threshold_paise", String(thresholdPaise)],
    ["free_shipping_enabled", parsed.free_shipping_enabled ? "1" : "0"],
    ["shipping_flat_fee_paise", String(flatFeePaise)],
    // Keep legacy aliases aligned
    ["shipping_fee_paise", String(flatFeePaise)],
    ["shipping_flat_paise", String(flatFeePaise)],
    ["shipping_calculation_mode", parsed.shipping_calculation_mode],
    ["dispatch_commitment", parsed.dispatch_commitment],
    ["announcement_auto_sync", parsed.announcement_auto_sync ? "1" : "0"],

    // Cash on Delivery
    ["cod_enabled", parsed.cod_enabled ? "1" : "0"],
    ["cod_fee_paise", String(codFeePaise)],
    ["cod_min_paise", String(codMinPaise)],
    ["cod_max_paise", String(codMaxPaise)],
    ["cod_postcodes", JSON.stringify(parsed.cod_postcodes)],
    ["cod_blocked_skus", JSON.stringify(parsed.cod_blocked_skus)],

    // Logistics & Shiprocket
    ["shiprocket_mode", parsed.shiprocket_mode],
    ["shiprocket_order_creation_mode", parsed.shiprocket_order_creation_mode],
    ["shiprocket_enabled", parsed.shiprocket_enabled ? "1" : "0"],
    ["shiprocket_pickup_location", parsed.shiprocket_pickup_location],
    ["shiprocket_pickup_postcode", parsed.shiprocket_pickup_postcode],
    ["shiprocket_default_length", String(parsed.shiprocket_default_length)],
    ["shiprocket_default_breadth", String(parsed.shiprocket_default_breadth)],
    ["shiprocket_default_height", String(parsed.shiprocket_default_height)],
    ["shiprocket_default_tare_grams", String(parsed.shiprocket_default_tare_grams)],
    ["shiprocket_default_hsn", parsed.shiprocket_default_hsn],
  ];

  if (parsed.shiprocket_test_email !== undefined) {
    updates.push(["shiprocket_test_email", parsed.shiprocket_test_email.trim()]);
  }
  if (parsed.shiprocket_prod_email !== undefined) {
    updates.push(["shiprocket_prod_email", parsed.shiprocket_prod_email.trim()]);
  }

  if (parsed.shiprocket_email !== undefined) {
    const trimmed = parsed.shiprocket_email.trim();
    updates.push(["shiprocket_email", trimmed]);
    if (parsed.shiprocket_mode === "test" && parsed.shiprocket_test_email === undefined) {
      updates.push(["shiprocket_test_email", trimmed]);
    } else if (parsed.shiprocket_mode === "production" && parsed.shiprocket_prod_email === undefined) {
      updates.push(["shiprocket_prod_email", trimmed]);
    }
  }

  if (parsed.shiprocket_test_password && !parsed.shiprocket_test_password.startsWith("•••")) {
    updates.push(["shiprocket_test_password", parsed.shiprocket_test_password.trim()]);
  }

  if (parsed.shiprocket_prod_password && !parsed.shiprocket_prod_password.startsWith("•••")) {
    updates.push(["shiprocket_prod_password", parsed.shiprocket_prod_password.trim()]);
  }

  if (parsed.shiprocket_password && !parsed.shiprocket_password.startsWith("•••")) {
    const trimmed = parsed.shiprocket_password.trim();
    updates.push(["shiprocket_password", trimmed]);
    if (parsed.shiprocket_mode === "test" && !parsed.shiprocket_test_password) {
      updates.push(["shiprocket_test_password", trimmed]);
    } else if (parsed.shiprocket_mode === "production" && !parsed.shiprocket_prod_password) {
      updates.push(["shiprocket_prod_password", trimmed]);
    }
  }

  // Auto-sync top announcement banner
  if (parsed.announcement_auto_sync) {
    const banner = parsed.free_shipping_enabled
      ? `FREE SHIPPING ON ORDERS ABOVE ₹${parsed.free_shipping_threshold_rupees}`
      : `STANDARD DISPATCH FROM SILIGURI HUB (FLAT ₹${parsed.shipping_flat_fee_rupees})`;
    updates.push(["announcement_text", banner]);
    updates.push(["announcement_highlight", `✨ ${banner}`]);
  }

  const upsert = db.prepare(`
    INSERT INTO store_settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `);

  db.transaction(() => {
    for (const [key, val] of updates) {
      upsert.run(key, val);
    }

    // Atomic sync into commerce_markets for 'IN' (India)
    try {
      const inRow = db.prepare("SELECT document FROM commerce_markets WHERE code = 'IN'").get() as
        | { document: string }
        | undefined;
      if (inRow && inRow.document) {
        const doc = JSON.parse(inRow.document);
        doc.flatPaise = flatFeePaise;
        doc.freeAbovePaise = parsed.free_shipping_enabled ? thresholdPaise : null;
        if (!doc.cod) doc.cod = {};
        doc.cod.enabled = parsed.cod_enabled;
        doc.cod.feePaise = codFeePaise;
        doc.cod.minPaise = codMinPaise;
        doc.cod.maxPaise = codMaxPaise;
        doc.cod.postcodes = parsed.cod_postcodes;
        doc.cod.blockedSkus = parsed.cod_blocked_skus;

        db.prepare(
          "UPDATE commerce_markets SET document = ?, version = version + 1 WHERE code = 'IN'"
        ).run(JSON.stringify(doc));
      }
    } catch {}
  })();

  return getDeliverySettings();
}

/**
 * Validates whether an order meets the minimum delivery threshold.
 */
export function validateDeliveryOrder(
  subtotalPaise: number,
  settings: DeliverySettings = getDeliverySettings()
): {
  eligible: boolean;
  minOrderPaise: number;
  minOrderRupees: number;
  remainingPaise: number;
  remainingRupees: number;
  message?: string;
} {
  const minPaise = settings.min_delivery_order_paise || 0;
  if (minPaise <= 0 || subtotalPaise >= minPaise) {
    return {
      eligible: true,
      minOrderPaise: minPaise,
      minOrderRupees: settings.min_delivery_order_rupees,
      remainingPaise: 0,
      remainingRupees: 0,
    };
  }

  const remainingPaise = minPaise - subtotalPaise;
  const remainingRupees = Math.ceil(remainingPaise / 100);
  return {
    eligible: false,
    minOrderPaise: minPaise,
    minOrderRupees: settings.min_delivery_order_rupees,
    remainingPaise,
    remainingRupees,
    message: `Minimum order for delivery is ₹${settings.min_delivery_order_rupees}. Please add ₹${remainingRupees} more to your bag.`,
  };
}

/**
 * Validates Cash on Delivery (COD) eligibility for a given order subtotal,
 * destination postal code, and cart SKUs.
 */
export function validateCodEligibility(
  subtotalPaise: number,
  postcode: string,
  skus: string[] = [],
  settings: DeliverySettings = getDeliverySettings()
): {
  eligible: boolean;
  reason?: string;
} {
  if (!settings.cod_enabled) {
    return {
      eligible: false,
      reason: "Cash on delivery is currently disabled. Please choose UPI, Card, or Netbanking.",
    };
  }

  if (settings.cod_min_paise > 0 && subtotalPaise < settings.cod_min_paise) {
    return {
      eligible: false,
      reason: `Cash on delivery requires a minimum order of ₹${settings.cod_min_rupees}.`,
    };
  }

  if (settings.cod_max_paise > 0 && subtotalPaise > settings.cod_max_paise) {
    return {
      eligible: false,
      reason: `Cash on delivery is only available for orders up to ₹${settings.cod_max_rupees}. Please choose prepaid payment for higher value orders.`,
    };
  }

  const cleanPostcode = (postcode || "").trim().replace(/\s+/g, "");
  if (settings.cod_postcodes.length > 0 && cleanPostcode && !settings.cod_postcodes.includes(cleanPostcode)) {
    return {
      eligible: false,
      reason: `Cash on delivery is not available for PIN code ${cleanPostcode}. Please select an online payment option.`,
    };
  }

  if (settings.cod_blocked_skus.length > 0 && skus.some((s) => settings.cod_blocked_skus.includes(s))) {
    return {
      eligible: false,
      reason: "Cash on delivery is not available for one or more items in your bag.",
    };
  }

  return { eligible: true };
}
